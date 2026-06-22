import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getBearerToken, verifyGoogleIdToken } from "../lib/auth.js";
import {
  deleteTag,
  deleteVocab,
  listTags,
  listVocab,
  mergeSyncData,
  upsertTag,
  upsertVocab,
  type TagRow,
  type VocabRow,
} from "../lib/vocabData.js";
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from "../lib/response.js";

async function requireUser(event: APIGatewayProxyEventV2) {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) throw new Error("Unauthorized");
  return verifyGoogleIdToken(token);
}

function tagPathId(path: string): string | null {
  const match = /^\/api\/tags\/([^/]+)$/.exec(path);
  return match?.[1] ?? null;
}

function vocabPathId(path: string): string | null {
  const match = /^\/api\/vocab\/([^/]+)$/.exec(path);
  return match?.[1] ?? null;
}

function isPracticePath(path: string): boolean {
  return /^\/api\/vocab\/[^/]+\/practice$/.test(path);
}

function practicePathId(path: string): string | null {
  const match = /^\/api\/vocab\/([^/]+)\/practice$/.exec(path);
  return match?.[1] ?? null;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") return handleOptions();

  const path = event.rawPath;

  try {
    const user = await requireUser(event);

    if (method === "GET" && path === "/api/sync") {
      const [tags, vocab] = await Promise.all([listTags(user.id), listVocab(user.id)]);
      return jsonResponse(200, { tags, vocab });
    }

    if (method === "POST" && path === "/api/sync/merge") {
      const body = parseJsonBody<{ tags?: TagRow[]; vocab?: VocabRow[] }>(event);
      const merged = await mergeSyncData(user.id, body.tags ?? [], body.vocab ?? []);
      return jsonResponse(200, merged);
    }

    if (path.startsWith("/api/tags")) {
      if (method === "GET" && path === "/api/tags") {
        return jsonResponse(200, { tags: await listTags(user.id) });
      }

      if (method === "POST" && path === "/api/tags") {
        const body = parseJsonBody<Partial<TagRow> & Pick<TagRow, "id">>(event);
        const tag: TagRow = {
          id: body.id,
          name: body.name?.trim() ?? "",
          color: body.color ?? "#6366f1",
          sortOrder: body.sortOrder ?? 0,
          updatedAt: body.updatedAt ?? Date.now(),
        };
        await upsertTag(user.id, tag);
        return jsonResponse(200, { tag });
      }

      const tagId = tagPathId(path);
      if (tagId && method === "PATCH") {
        const body = parseJsonBody<Partial<TagRow>>(event);
        const tags = await listTags(user.id);
        const current = tags.find((tag) => tag.id === tagId);
        if (!current) return errorResponse(404, "Tag not found");
        const updated: TagRow = {
          ...current,
          ...body,
          id: tagId,
          updatedAt: Date.now(),
        };
        if (body.name !== undefined) updated.name = body.name.trim();
        await upsertTag(user.id, updated);
        return jsonResponse(200, { tag: updated });
      }

      if (tagId && method === "DELETE") {
        await deleteTag(user.id, tagId);
        return jsonResponse(200, { ok: true });
      }
    }

    if (path.startsWith("/api/vocab")) {
      if (method === "GET" && path === "/api/vocab") {
        return jsonResponse(200, { vocab: await listVocab(user.id) });
      }

      if (method === "POST" && path === "/api/vocab/batch") {
        const body = parseJsonBody<{ items: VocabRow[] }>(event);
        const items = body.items ?? [];
        await Promise.all(items.map((item) => upsertVocab(user.id, item)));
        return jsonResponse(200, { items });
      }

      if (method === "POST" && path === "/api/vocab") {
        const body = parseJsonBody<Partial<VocabRow> & Pick<VocabRow, "id">>(event);
        const now = Date.now();
        const item: VocabRow = {
          id: body.id,
          type: body.type ?? "word",
          text: body.text?.trim() ?? "",
          ipa: body.ipa,
          translation: body.translation,
          notes: body.notes,
          tagIds: body.tagIds ?? [],
          lastScore: body.lastScore,
          lastPracticedAt: body.lastPracticedAt,
          practiceCount: body.practiceCount ?? 0,
          createdAt: body.createdAt ?? now,
          updatedAt: body.updatedAt ?? now,
        };
        await upsertVocab(user.id, item);
        return jsonResponse(200, { item });
      }

      const practiceId = practicePathId(path);
      if (practiceId && method === "POST" && isPracticePath(path)) {
        const body = parseJsonBody<{ score: number }>(event);
        const vocab = await listVocab(user.id);
        const current = vocab.find((item) => item.id === practiceId);
        if (!current) return errorResponse(404, "Vocab item not found");
        const updated: VocabRow = {
          ...current,
          lastScore: body.score,
          lastPracticedAt: Date.now(),
          practiceCount: current.practiceCount + 1,
          updatedAt: Date.now(),
        };
        await upsertVocab(user.id, updated);
        return jsonResponse(200, { item: updated });
      }

      const vocabId = vocabPathId(path);
      if (vocabId && method === "PATCH") {
        const body = parseJsonBody<Partial<VocabRow>>(event);
        const vocab = await listVocab(user.id);
        const current = vocab.find((item) => item.id === vocabId);
        if (!current) return errorResponse(404, "Vocab item not found");
        const updated: VocabRow = {
          ...current,
          ...body,
          id: vocabId,
          text: body.text?.trim() ?? current.text,
          ipa: body.ipa !== undefined ? body.ipa.trim() || undefined : current.ipa,
          translation:
            body.translation !== undefined ? body.translation.trim() || undefined : current.translation,
          notes: body.notes !== undefined ? body.notes.trim() || undefined : current.notes,
          tagIds: body.tagIds ?? current.tagIds,
          updatedAt: Date.now(),
        };
        await upsertVocab(user.id, updated);
        return jsonResponse(200, { item: updated });
      }

      if (vocabId && method === "DELETE") {
        await deleteVocab(user.id, vocabId);
        return jsonResponse(200, { ok: true });
      }
    }

    return errorResponse(404, "Not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Invalid Google token") {
      return errorResponse(401, message);
    }
    return errorResponse(500, message);
  }
}
