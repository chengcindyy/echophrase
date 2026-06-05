import { tagRepository } from "@/repositories";
import type { TagRepository } from "@/repositories/types";
import { TAG_COLORS, type VocabInput, type VocabItem, type VocabType } from "@/types";

export interface ParsedVocabRow {
  type: VocabType;
  text: string;
  ipa?: string;
  translation?: string;
  notes?: string;
  tagNames: string[];
}

const HEADER_ALIASES: Record<string, keyof CsvVocabRow> = {
  text: "text",
  法文: "text",
  french: "text",
  translation: "translation",
  释义: "translation",
  翻譯: "translation",
  meaning: "translation",
  tags: "tags",
  tag: "tags",
  標籤: "tags",
  type: "type",
  類型: "type",
  ipa: "ipa",
  notes: "notes",
  備註: "notes",
};

interface CsvVocabRow {
  text?: string;
  translation?: string;
  tags?: string;
  type?: string;
  ipa?: string;
  notes?: string;
}

export interface ImportRowPreview {
  lineNumber: number;
  row: ParsedVocabRow | null;
  status: "new" | "duplicate" | "invalid";
  message?: string;
}

export interface ImportPlan {
  rows: ImportRowPreview[];
  toCreateRows: ParsedVocabRow[];
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      if (char === "\r") i++;
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): keyof CsvVocabRow | null {
  const key = value.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

function inferVocabType(text: string, explicit?: string): VocabType {
  const normalized = explicit?.trim().toLowerCase();
  if (normalized === "word" || normalized === "單字") return "word";
  if (normalized === "sentence" || normalized === "句子") return "sentence";
  const trimmed = text.trim();
  if (/\s/.test(trimmed) || /[.?!…,;:]/.test(trimmed)) return "sentence";
  return "word";
}

function parseTagNames(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split("|").map((name) => name.trim()).filter(Boolean))];
}

export function normalizeTextKey(text: string): string {
  return text.trim().toLowerCase();
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToParsedVocab(row: CsvVocabRow): ParsedVocabRow | null {
  const text = row.text?.trim();
  if (!text) return null;

  return {
    type: inferVocabType(text, row.type),
    text,
    ipa: row.ipa?.trim() || undefined,
    translation: row.translation?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    tagNames: parseTagNames(row.tags),
  };
}

function mapCsvRows(rows: string[][]): Array<{ lineNumber: number; row: CsvVocabRow }> {
  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => normalizeHeader(cell));
  const hasHeader = header.some((column) => column !== null);

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const columns = hasHeader ? header : null;

  return dataRows.map((cells, index) => {
    const row: CsvVocabRow = {};
    cells.forEach((cell, cellIndex) => {
      const field = columns ? columns[cellIndex] : cellIndex === 0 ? "text" : cellIndex === 1 ? "translation" : cellIndex === 2 ? "tags" : null;
      if (!field) return;
      row[field] = cell.trim();
    });
    return { lineNumber: hasHeader ? index + 2 : index + 1, row };
  });
}

export function createTagResolver(tags: TagRepository = tagRepository) {
  let colorIndex = tags.list().length;

  return function resolveTagIds(names: string[]): string[] {
    const ids: string[] = [];
    for (const name of names) {
      const existing = tags.list().find((tag) => tag.name === name);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const color = TAG_COLORS[colorIndex % TAG_COLORS.length];
      colorIndex += 1;
      ids.push(tags.create(name, color).id);
    }
    return ids;
  };
}

export function parsedRowsToInputs(
  rows: ParsedVocabRow[],
  tags: TagRepository = tagRepository,
): VocabInput[] {
  const resolveTagIds = createTagResolver(tags);
  return rows.map((row) => ({
    type: row.type,
    text: row.text,
    ipa: row.ipa,
    translation: row.translation,
    notes: row.notes,
    tagIds: resolveTagIds(row.tagNames),
  }));
}

export function buildImportPlan(csvText: string, existing: VocabItem[]): ImportPlan {
  const parsedRows = mapCsvRows(parseCsv(csvText.trim()));
  const existingKeys = new Set(existing.map((item) => normalizeTextKey(item.text)));

  const rows: ImportRowPreview[] = [];
  const toCreateRows: ParsedVocabRow[] = [];
  const seenInFile = new Set<string>();

  for (const { lineNumber, row } of parsedRows) {
    const parsed = rowToParsedVocab(row);
    if (!parsed) {
      rows.push({
        lineNumber,
        row: null,
        status: "invalid",
        message: "缺少法文原文",
      });
      continue;
    }

    const key = normalizeTextKey(parsed.text);
    if (existingKeys.has(key)) {
      rows.push({
        lineNumber,
        row: parsed,
        status: "duplicate",
        message: "詞庫已有相同原文",
      });
      continue;
    }

    if (seenInFile.has(key)) {
      rows.push({
        lineNumber,
        row: parsed,
        status: "duplicate",
        message: "CSV 內重複列",
      });
      continue;
    }

    seenInFile.add(key);
    toCreateRows.push(parsed);
    rows.push({ lineNumber, row: parsed, status: "new" });
  }

  return {
    rows,
    toCreateRows,
    newCount: toCreateRows.length,
    duplicateCount: rows.filter((row) => row.status === "duplicate").length,
    invalidCount: rows.filter((row) => row.status === "invalid").length,
  };
}

export function exportVocabCsv(items: VocabItem[], tagName: (id: string) => string): string {
  const header = "text,type,translation,ipa,notes,tags";
  const lines = items.map((item) => {
    const tagNames = item.tagIds.map(tagName).join("|");
    return [
      escapeCsvCell(item.text),
      item.type,
      escapeCsvCell(item.translation ?? ""),
      escapeCsvCell(item.ipa ?? ""),
      escapeCsvCell(item.notes ?? ""),
      escapeCsvCell(tagNames),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
