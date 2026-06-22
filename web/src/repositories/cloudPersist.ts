import { fetchSyncData, mergeSyncData, updateRemoteVocab } from "@/api/sync";
import { normalizeTextKey, type ParsedVocabRow } from "@/lib/vocabCsv";
import type { Tag, VocabInput, VocabItem } from "@/types";
import { TAG_COLORS } from "@/types";
import {
  addCloudTag,
  getCloudTags,
  getCloudVocab,
  replaceCloudVocab,
  setCloudData,
} from "./cloudCache";
import { localTagRepository } from "./local/localTagStore";
import { localVocabRepository } from "./local/localVocabStore";
import { useAuthStore } from "@/stores/authStore";

function tokenOrThrow(): string {
  const token = useAuthStore().getToken();
  if (!token) throw new Error("登入已過期，請重新登入");
  return token;
}

function newId(): string {
  return crypto.randomUUID();
}

function buildVocabItem(input: VocabInput, now = Date.now()): VocabItem {
  return {
    id: newId(),
    type: input.type,
    text: input.text.trim(),
    ipa: input.ipa?.trim() || undefined,
    translation: input.translation?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    tagIds: [...input.tagIds],
    practiceCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function ensureTagInCache(name: string): Tag {
  const trimmed = name.trim();
  const existing = getCloudTags().find((tag) => tag.name === trimmed);
  if (existing) return existing;

  const maxOrder = getCloudTags().reduce((max, tag) => Math.max(max, tag.sortOrder), -1);
  const tag: Tag = {
    id: newId(),
    name: trimmed,
    color: TAG_COLORS[maxOrder % TAG_COLORS.length],
    sortOrder: maxOrder + 1,
  };
  addCloudTag(tag);
  return tag;
}

export async function reloadCloudData(): Promise<void> {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) return;
  const token = tokenOrThrow();
  const data = await fetchSyncData(token);
  setCloudData(data.tags, data.vocab);
}

async function mergeToCloud(tags: Tag[], vocab: VocabItem[]): Promise<void> {
  await mergeSyncData(tokenOrThrow(), tags, vocab);
  await reloadCloudData();
}

export async function createVocabAsync(input: VocabInput): Promise<VocabItem> {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    return localVocabRepository.create(input);
  }

  await reloadCloudData();
  const item = buildVocabItem(input);
  const tags = getCloudTags().filter((tag) => item.tagIds.includes(tag.id));

  await mergeToCloud(tags, [item]);
  return getCloudVocab().find((entry) => entry.text === item.text) ?? item;
}

export async function createManyVocabAsync(inputs: VocabInput[]): Promise<number> {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    localVocabRepository.createMany(inputs);
    return inputs.length;
  }

  if (inputs.length === 0) return 0;

  await reloadCloudData();

  const now = Date.now();
  const created = inputs.map((input) => buildVocabItem(input, now));
  return persistCreatedVocabBatch(created);
}

/** CSV 匯入：先 reload，再解析 tag，避免 reload 清掉預先建立的 tag。 */
export async function importParsedVocabRowsAsync(rows: ParsedVocabRow[]): Promise<number> {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    const inputs = parsedRowsToInputsForImport(rows);
    localVocabRepository.createMany(inputs);
    return inputs.length;
  }

  if (rows.length === 0) return 0;

  await reloadCloudData();

  const existingKeys = new Set(getCloudVocab().map((item) => normalizeTextKey(item.text)));
  const pending = rows.filter((row) => !existingKeys.has(normalizeTextKey(row.text)));
  if (pending.length === 0) {
    throw new Error("沒有新的詞彙可匯入（詞庫中已有相同原文）");
  }

  const now = Date.now();
  const created = pending.map((row) => {
    const tagIds = row.tagNames.map((name) => ensureTagInCache(name).id);
    return buildVocabItem(
      {
        type: row.type,
        text: row.text,
        ipa: row.ipa,
        translation: row.translation,
        notes: row.notes,
        tagIds,
      },
      now,
    );
  });

  return persistCreatedVocabBatch(created);
}

async function persistCreatedVocabBatch(created: VocabItem[]): Promise<number> {
  if (created.length === 0) return 0;

  const tagIdSet = new Set(created.flatMap((item) => item.tagIds));
  const tags = getCloudTags().filter((tag) => tagIdSet.has(tag.id));
  const textKeys = new Set(created.map((item) => normalizeTextKey(item.text)));

  await mergeToCloud(tags, created);

  const added = getCloudVocab().filter((item) => textKeys.has(normalizeTextKey(item.text))).length;
  if (added <= 0) {
    throw new Error("匯入未完成，請確認 API 連線或重新登入後再試");
  }
  return added;
}

export async function updateVocabAsync(id: string, input: Partial<VocabInput>): Promise<VocabItem> {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    return localVocabRepository.update(id, input);
  }

  const existing = getCloudVocab().find((item) => item.id === id);
  if (!existing) throw new Error("Vocab item not found");

  const updated: VocabItem = {
    ...existing,
    type: input.type ?? existing.type,
    text: input.text?.trim() ?? existing.text,
    ipa: input.ipa !== undefined ? input.ipa.trim() || undefined : existing.ipa,
    translation:
      input.translation !== undefined ? input.translation.trim() || undefined : existing.translation,
    notes: input.notes !== undefined ? input.notes.trim() || undefined : existing.notes,
    tagIds: input.tagIds ?? existing.tagIds,
    updatedAt: Date.now(),
  };
  replaceCloudVocab(updated);
  try {
    await updateRemoteVocab(tokenOrThrow(), id, input);
    await reloadCloudData();
  } catch (error) {
    replaceCloudVocab(existing);
    throw error;
  }
  return getCloudVocab().find((entry) => entry.id === id) ?? updated;
}

export function parsedRowsToInputsForImport(
  rows: import("@/lib/vocabCsv").ParsedVocabRow[],
): VocabInput[] {
  const auth = useAuthStore();
  const inputs: VocabInput[] = [];

  for (const row of rows) {
    const tagIds: string[] = [];
    for (const name of row.tagNames) {
      if (auth.isAuthenticated) {
        tagIds.push(ensureTagInCache(name).id);
      } else {
        const existing = localTagRepository.list().find((tag) => tag.name === name);
        if (existing) {
          tagIds.push(existing.id);
        } else {
          const color = TAG_COLORS[tagIds.length % TAG_COLORS.length];
          tagIds.push(localTagRepository.create(name, color).id);
        }
      }
    }

    inputs.push({
      type: row.type,
      text: row.text,
      ipa: row.ipa,
      translation: row.translation,
      notes: row.notes,
      tagIds,
    });
  }

  return inputs;
}

/** @deprecated use parsedRowsToInputsForImport */
export async function parsedRowsToInputsAsync(
  rows: import("@/lib/vocabCsv").ParsedVocabRow[],
): Promise<VocabInput[]> {
  return parsedRowsToInputsForImport(rows);
}
