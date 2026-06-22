import type { Tag, VocabItem } from "@/types";

const TAGS_KEY = "echophrase:tags:v1";
const VOCAB_KEY = "echophrase:vocab:v1";

export function loadLocalTags(): Tag[] {
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tag[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadLocalVocab(): VocabItem[] {
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VocabItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalTags(tags: Tag[]): void {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function saveLocalVocab(items: VocabItem[]): void {
  localStorage.setItem(VOCAB_KEY, JSON.stringify(items));
}
