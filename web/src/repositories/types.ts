import type { Tag, VocabInput, VocabItem } from "@/types";

export interface TagRepository {
  list(): Tag[];
  get(id: string): Tag | undefined;
  create(name: string, color?: string): Tag;
  update(id: string, patch: Partial<Pick<Tag, "name" | "color" | "sortOrder">>): Tag;
  reorder(orderedIds: string[]): void;
  remove(id: string): void;
}

export interface VocabRepository {
  list(): VocabItem[];
  get(id: string): VocabItem | undefined;
  create(input: VocabInput): VocabItem;
  createMany(inputs: VocabInput[]): VocabItem[];
  update(id: string, input: Partial<VocabInput>): VocabItem;
  remove(id: string): void;
  recordPractice(id: string, score: number): VocabItem;
  listWrong(threshold: number): VocabItem[];
  listByTags(tagIds: string[]): VocabItem[];
}
