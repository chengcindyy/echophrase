import { ApiError, apiEndpoint } from "./client";
import type { Tag, VocabInput, VocabItem } from "@/types";

function authHeaders(idToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchSyncData(idToken: string): Promise<{ tags: Tag[]; vocab: VocabItem[] }> {
  const res = await fetch(apiEndpoint("/api/sync"), {
    headers: authHeaders(idToken),
  });
  return parseJson(res);
}

export async function mergeSyncData(
  idToken: string,
  tags: Tag[],
  vocab: VocabItem[],
): Promise<{ tags: Tag[]; vocab: VocabItem[] }> {
  const res = await fetch(apiEndpoint("/api/sync/merge"), {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify({ tags, vocab }),
  });
  return parseJson(res);
}

export async function createRemoteTag(idToken: string, tag: Tag): Promise<Tag> {
  const res = await fetch(apiEndpoint("/api/tags"), {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify({ ...tag, updatedAt: Date.now() }),
  });
  const body = await parseJson<{ tag: Tag }>(res);
  return body.tag;
}

export async function updateRemoteTag(
  idToken: string,
  id: string,
  patch: Partial<Pick<Tag, "name" | "color" | "sortOrder">>,
): Promise<Tag> {
  const res = await fetch(apiEndpoint(`/api/tags/${id}`), {
    method: "PATCH",
    headers: authHeaders(idToken),
    body: JSON.stringify(patch),
  });
  const body = await parseJson<{ tag: Tag }>(res);
  return body.tag;
}

export async function deleteRemoteTag(idToken: string, id: string): Promise<void> {
  const res = await fetch(apiEndpoint(`/api/tags/${id}`), {
    method: "DELETE",
    headers: authHeaders(idToken),
  });
  await parseJson(res);
}

export async function createRemoteVocab(idToken: string, item: VocabItem): Promise<VocabItem> {
  const res = await fetch(apiEndpoint("/api/vocab"), {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify({ ...item, practiceCount: item.practiceCount ?? 0 }),
  });
  const body = await parseJson<{ item: VocabItem }>(res);
  return body.item;
}

export async function createRemoteVocabBatch(
  idToken: string,
  items: VocabItem[],
): Promise<VocabItem[]> {
  const payload = items.map((item) => ({
    ...item,
    practiceCount: item.practiceCount ?? 0,
  }));
  const res = await fetch(apiEndpoint("/api/vocab/batch"), {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify({ items: payload }),
  });
  const body = await parseJson<{ items: VocabItem[] }>(res);
  return body.items;
}

export async function updateRemoteVocab(
  idToken: string,
  id: string,
  input: Partial<VocabInput>,
): Promise<VocabItem> {
  const res = await fetch(apiEndpoint(`/api/vocab/${id}`), {
    method: "PATCH",
    headers: authHeaders(idToken),
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ item: VocabItem }>(res);
  return body.item;
}

export async function deleteRemoteVocab(idToken: string, id: string): Promise<void> {
  const res = await fetch(apiEndpoint(`/api/vocab/${id}`), {
    method: "DELETE",
    headers: authHeaders(idToken),
  });
  await parseJson(res);
}

export async function recordRemotePractice(
  idToken: string,
  id: string,
  score: number,
): Promise<VocabItem> {
  const res = await fetch(apiEndpoint(`/api/vocab/${id}/practice`), {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify({ score }),
  });
  const body = await parseJson<{ item: VocabItem }>(res);
  return body.item;
}
