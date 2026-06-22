import { getDb } from "./db.js";

export interface TagRow {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  updatedAt: number;
}

export interface VocabRow {
  id: string;
  type: "word" | "sentence";
  text: string;
  ipa?: string;
  translation?: string;
  notes?: string;
  tagIds: string[];
  lastScore?: number;
  lastPracticedAt?: number;
  practiceCount: number;
  createdAt: number;
  updatedAt: number;
}

function mapTag(row: {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  updated_at: string | number;
}): TagRow {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: Number(row.sort_order),
    updatedAt: Number(row.updated_at),
  };
}

function mapVocab(row: {
  id: string;
  type: string;
  text: string;
  ipa: string | null;
  translation: string | null;
  notes: string | null;
  tag_ids: unknown;
  last_score: number | null;
  last_practiced_at: string | number | null;
  practice_count: number;
  created_at: string | number;
  updated_at: string | number;
}): VocabRow {
  return {
    id: row.id,
    type: row.type as VocabRow["type"],
    text: row.text,
    ipa: row.ipa ?? undefined,
    translation: row.translation ?? undefined,
    notes: row.notes ?? undefined,
    tagIds: Array.isArray(row.tag_ids) ? (row.tag_ids as string[]) : [],
    lastScore: row.last_score ?? undefined,
    lastPracticedAt: row.last_practiced_at != null ? Number(row.last_practiced_at) : undefined,
    practiceCount: Number(row.practice_count),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listTags(userId: string): Promise<TagRow[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, color, sort_order, updated_at
    FROM tags
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, name ASC
  `) as Array<{
    id: string;
    name: string;
    color: string;
    sort_order: number;
    updated_at: string | number;
  }>;
  return rows.map((row) => mapTag(row));
}

export async function listVocab(userId: string): Promise<VocabRow[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT
      id, type, text, ipa, translation, notes, tag_ids,
      last_score, last_practiced_at, practice_count, created_at, updated_at
    FROM vocab
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `) as Array<{
    id: string;
    type: string;
    text: string;
    ipa: string | null;
    translation: string | null;
    notes: string | null;
    tag_ids: unknown;
    last_score: number | null;
    last_practiced_at: string | number | null;
    practice_count: number;
    created_at: string | number;
    updated_at: string | number;
  }>;
  return rows.map((row) => mapVocab(row));
}

export async function upsertTag(userId: string, tag: TagRow): Promise<TagRow> {
  const sql = getDb();
  await sql`
    INSERT INTO tags (id, user_id, name, color, sort_order, updated_at)
    VALUES (
      ${tag.id},
      ${userId},
      ${tag.name},
      ${tag.color},
      ${tag.sortOrder},
      ${tag.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
    WHERE tags.user_id = ${userId}
      AND EXCLUDED.updated_at >= tags.updated_at
  `;
  return tag;
}

export async function deleteTag(userId: string, id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM tags WHERE user_id = ${userId} AND id = ${id}`;
}

export async function upsertVocab(userId: string, item: VocabRow): Promise<VocabRow> {
  const sql = getDb();
  await sql`
    INSERT INTO vocab (
      id, user_id, type, text, ipa, translation, notes, tag_ids,
      last_score, last_practiced_at, practice_count, created_at, updated_at
    )
    VALUES (
      ${item.id},
      ${userId},
      ${item.type},
      ${item.text},
      ${item.ipa ?? null},
      ${item.translation ?? null},
      ${item.notes ?? null},
      ${JSON.stringify(item.tagIds)}::jsonb,
      ${item.lastScore ?? null},
      ${item.lastPracticedAt ?? null},
      ${item.practiceCount ?? 0},
      ${item.createdAt},
      ${item.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      type = EXCLUDED.type,
      text = EXCLUDED.text,
      ipa = EXCLUDED.ipa,
      translation = EXCLUDED.translation,
      notes = EXCLUDED.notes,
      tag_ids = EXCLUDED.tag_ids,
      last_score = EXCLUDED.last_score,
      last_practiced_at = EXCLUDED.last_practiced_at,
      practice_count = EXCLUDED.practice_count,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
    WHERE vocab.user_id = ${userId}
      AND EXCLUDED.updated_at >= vocab.updated_at
  `;
  return item;
}

export async function deleteVocab(userId: string, id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM vocab WHERE user_id = ${userId} AND id = ${id}`;
}

function mergeTags(existing: TagRow[], incoming: TagRow[]): TagRow[] {
  const byId = new Map(existing.map((tag) => [tag.id, tag]));
  for (const raw of incoming) {
    const tag: TagRow = {
      ...raw,
      updatedAt: raw.updatedAt ?? Date.now(),
    };
    const current = byId.get(tag.id);
    if (!current || tag.updatedAt >= current.updatedAt) {
      byId.set(tag.id, tag);
    }
  }
  return [...byId.values()];
}

function mergeVocab(existing: VocabRow[], incoming: VocabRow[]): VocabRow[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const current = byId.get(item.id);
    if (!current || item.updatedAt >= current.updatedAt) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function normalizeIncomingVocab(raw: Partial<VocabRow> & Pick<VocabRow, "id">): VocabRow {
  const now = Date.now();
  return {
    id: raw.id,
    type: raw.type ?? "word",
    text: raw.text?.trim() ?? "",
    ipa: raw.ipa,
    translation: raw.translation,
    notes: raw.notes,
    tagIds: raw.tagIds ?? [],
    lastScore: raw.lastScore,
    lastPracticedAt: raw.lastPracticedAt,
    practiceCount: raw.practiceCount ?? 0,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

export async function mergeSyncData(
  userId: string,
  incomingTags: TagRow[],
  incomingVocab: VocabRow[],
): Promise<{ tags: TagRow[]; vocab: VocabRow[] }> {
  const [existingTags, existingVocab] = await Promise.all([listTags(userId), listVocab(userId)]);
  const mergedTags = mergeTags(
    existingTags,
    incomingTags.map((tag) => ({ ...tag, updatedAt: tag.updatedAt ?? Date.now() })),
  );
  const mergedVocab = mergeVocab(
    existingVocab,
    incomingVocab.map((item) => normalizeIncomingVocab(item)),
  );

  async function upsertInBatches<T>(items: T[], upsert: (item: T) => Promise<unknown>): Promise<void> {
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map((item) => upsert(item)));
    }
  }

  await upsertInBatches(mergedTags, (tag) => upsertTag(userId, tag));
  await upsertInBatches(mergedVocab, (item) => upsertVocab(userId, item));

  return { tags: mergedTags, vocab: mergedVocab };
}
