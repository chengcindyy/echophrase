import { ref } from "vue";
import type { Tag, VocabItem } from "@/types";
import { bumpRepositoryRevision } from "./repositoryRevision";

export const cloudTagsRef = ref<Tag[]>([]);
export const cloudVocabRef = ref<VocabItem[]>([]);

export function getCloudTags(): Tag[] {
  return cloudTagsRef.value;
}

export function getCloudVocab(): VocabItem[] {
  return cloudVocabRef.value;
}

export function setCloudData(nextTags: Tag[], nextVocab: VocabItem[]): void {
  cloudTagsRef.value = [...nextTags];
  cloudVocabRef.value = [...nextVocab];
  bumpRepositoryRevision();
}

export function clearCloudData(): void {
  cloudTagsRef.value = [];
  cloudVocabRef.value = [];
  bumpRepositoryRevision();
}

export function replaceCloudTag(updated: Tag): void {
  cloudTagsRef.value = cloudTagsRef.value.map((tag) => (tag.id === updated.id ? updated : tag));
  bumpRepositoryRevision();
}

export function addCloudTag(tag: Tag): void {
  cloudTagsRef.value = [...cloudTagsRef.value, tag];
  bumpRepositoryRevision();
}

export function removeCloudTag(id: string): void {
  cloudTagsRef.value = cloudTagsRef.value.filter((tag) => tag.id !== id);
  bumpRepositoryRevision();
}

export function replaceCloudVocab(updated: VocabItem): void {
  cloudVocabRef.value = cloudVocabRef.value.map((item) => (item.id === updated.id ? updated : item));
  bumpRepositoryRevision();
}

export function addCloudVocab(items: VocabItem | VocabItem[]): void {
  const created = Array.isArray(items) ? items : [items];
  cloudVocabRef.value = [...created, ...cloudVocabRef.value];
  bumpRepositoryRevision();
}

export function removeCloudVocab(id: string): void {
  cloudVocabRef.value = cloudVocabRef.value.filter((item) => item.id !== id);
  bumpRepositoryRevision();
}
