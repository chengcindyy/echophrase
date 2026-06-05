import { fetchTts } from "@/api/client";

export type TtsCacheEntry = {
  url: string;
  contentType: string;
};

const cache = new Map<string, TtsCacheEntry>();
const inflight = new Map<string, Promise<TtsCacheEntry>>();

function cacheKey(text: string, voice: string, rate: number): string {
  return `${voice}|${rate}|${text}`;
}

function base64ToBlob(audioBase64: string, contentType: string): Blob {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType || "audio/wav" });
}

export function getTtsCache(
  text: string,
  voice: string,
  rate: number,
): TtsCacheEntry | undefined {
  return cache.get(cacheKey(text, voice, rate));
}

export function isTtsCached(text: string, voice: string, rate: number): boolean {
  return cache.has(cacheKey(text, voice, rate));
}

export async function prefetchTts(
  text: string,
  voice: string,
  rate: number,
): Promise<TtsCacheEntry> {
  const key = cacheKey(text, voice, rate);
  const hit = cache.get(key);
  if (hit) return hit;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const result = await fetchTts({ text, voice, rate });
      const blob = base64ToBlob(result.audioBase64, result.contentType);
      const entry: TtsCacheEntry = {
        url: URL.createObjectURL(blob),
        contentType: result.contentType,
      };
      cache.set(key, entry);
      inflight.delete(key);
      return entry;
    })();
    inflight.set(key, pending);
  }

  return pending;
}
