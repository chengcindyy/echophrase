import type { VocabInput, VocabItem } from "@/types";
import type { VocabRepository } from "../types";
import { bumpRepositoryRevision } from "../repositoryRevision";
import { loadLocalVocab, saveLocalVocab } from "./localStorageData";

function newId(): string {
  return crypto.randomUUID();
}

export function createLocalVocabRepository(): VocabRepository {
  let items = loadLocalVocab();

  function persist() {
    saveLocalVocab(items);
    bumpRepositoryRevision();
  }

  return {
    list() {
      return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    get(id) {
      return items.find((v) => v.id === id);
    },

    create(input) {
      const now = Date.now();
      const item: VocabItem = {
        id: newId(),
        type: input.type,
        text: input.text.trim(),
        ipa: input.ipa?.trim() || undefined,
        translation: input.translation?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        tagIds: [...input.tagIds],
        createdAt: now,
        updatedAt: now,
      };
      items = [item, ...items];
      persist();
      return item;
    },

    createMany(inputs) {
      if (inputs.length === 0) return [];
      const now = Date.now();
      const created = inputs.map((input) => ({
        id: newId(),
        type: input.type,
        text: input.text.trim(),
        ipa: input.ipa?.trim() || undefined,
        translation: input.translation?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        tagIds: [...input.tagIds],
        createdAt: now,
        updatedAt: now,
      }));
      items = [...created, ...items];
      persist();
      return created;
    },

    update(id, input) {
      const index = items.findIndex((v) => v.id === id);
      if (index < 0) throw new Error("Vocab item not found");
      const current = items[index];
      const updated: VocabItem = {
        ...current,
        type: input.type ?? current.type,
        text: input.text?.trim() ?? current.text,
        ipa: input.ipa !== undefined ? input.ipa.trim() || undefined : current.ipa,
        translation:
          input.translation !== undefined
            ? input.translation.trim() || undefined
            : current.translation,
        notes: input.notes !== undefined ? input.notes.trim() || undefined : current.notes,
        tagIds: input.tagIds ?? current.tagIds,
        updatedAt: Date.now(),
      };
      items = items.map((v) => (v.id === id ? updated : v));
      persist();
      return updated;
    },

    remove(id) {
      items = items.filter((v) => v.id !== id);
      persist();
    },

    recordPractice(id, score) {
      const index = items.findIndex((v) => v.id === id);
      if (index < 0) throw new Error("Vocab item not found");
      const current = items[index];
      const updated: VocabItem = {
        ...current,
        lastScore: score,
        lastPracticedAt: Date.now(),
        practiceCount: (current.practiceCount ?? 0) + 1,
        updatedAt: Date.now(),
      };
      items = items.map((v) => (v.id === id ? updated : v));
      persist();
      return updated;
    },

    listWrong(threshold) {
      return items.filter(
        (v) =>
          v.lastScore !== undefined &&
          v.lastScore < threshold &&
          (v.practiceCount ?? 0) > 0,
      );
    },

    listByTags(tagIds) {
      if (tagIds.length === 0) return [...items];
      return items.filter((v) => tagIds.some((id) => v.tagIds.includes(id)));
    },
  };
}

export const localVocabRepository = createLocalVocabRepository();
