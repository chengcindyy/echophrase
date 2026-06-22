import {
  createRemoteTag,
  createRemoteVocab,
  createRemoteVocabBatch,
  deleteRemoteTag,
  deleteRemoteVocab,
  recordRemotePractice,
  updateRemoteTag,
  updateRemoteVocab,
} from "@/api/sync";
import type { Tag, VocabInput, VocabItem } from "@/types";
import type { TagRepository, VocabRepository } from "./types";
import {
  addCloudTag,
  addCloudVocab,
  getCloudTags,
  getCloudVocab,
  removeCloudTag,
  removeCloudVocab,
  replaceCloudTag,
  replaceCloudVocab,
} from "./cloudCache";
import { localTagRepository } from "./local/localTagStore";
import { localVocabRepository } from "./local/localVocabStore";
import { useAuthStore } from "@/stores/authStore";

export { repositoryRevision } from "./repositoryRevision";

function tokenOrThrow(): string {
  const token = useAuthStore().getToken();
  if (!token) throw new Error("請先登入 Google 帳號");
  return token;
}

function newId(): string {
  return crypto.randomUUID();
}

export const tagRepository: TagRepository = {
  list() {
    const auth = useAuthStore();
    if (auth.isAuthenticated) {
      return [...getCloudTags()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    }
    return localTagRepository.list();
  },

  get(id) {
    return this.list().find((tag) => tag.id === id);
  },

  create(name, color) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localTagRepository.create(name, color);
    }

    const maxOrder = getCloudTags().reduce((max, tag) => Math.max(max, tag.sortOrder), -1);
    const tag: Tag = {
      id: newId(),
      name: name.trim(),
      color: color ?? "#6366f1",
      sortOrder: maxOrder + 1,
    };
    addCloudTag(tag);
    void createRemoteTag(tokenOrThrow(), tag).catch(() => {
      removeCloudTag(tag.id);
    });
    return tag;
  },

  update(id, patch) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localTagRepository.update(id, patch);
    }

    const current = getCloudTags().find((tag) => tag.id === id);
    if (!current) throw new Error("Tag not found");
    const updated: Tag = {
      ...current,
      ...patch,
    };
    if (patch.name !== undefined) updated.name = patch.name.trim();
    replaceCloudTag(updated);
    void updateRemoteTag(tokenOrThrow(), id, patch).catch(() => {
      replaceCloudTag(current);
    });
    return updated;
  },

  remove(id) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      localTagRepository.remove(id);
      return;
    }

    const current = getCloudTags().find((tag) => tag.id === id);
    removeCloudTag(id);
    void deleteRemoteTag(tokenOrThrow(), id).catch(() => {
      if (current) addCloudTag(current);
    });
  },
};

export const vocabRepository: VocabRepository = {
  list() {
    const auth = useAuthStore();
    if (auth.isAuthenticated) {
      return [...getCloudVocab()].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return localVocabRepository.list();
  },

  get(id) {
    return this.list().find((item) => item.id === id);
  },

  create(input) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localVocabRepository.create(input);
    }

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
    addCloudVocab(item);
    void createRemoteVocab(tokenOrThrow(), item).catch(() => {
      removeCloudVocab(item.id);
    });
    return item;
  },

  createMany(inputs) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localVocabRepository.createMany(inputs);
    }

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
    addCloudVocab(created);
    void createRemoteVocabBatch(tokenOrThrow(), created).catch(() => {
      for (const item of created) removeCloudVocab(item.id);
    });
    return created;
  },

  update(id, input) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localVocabRepository.update(id, input);
    }

    const current = getCloudVocab().find((item) => item.id === id);
    if (!current) throw new Error("Vocab item not found");
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
    replaceCloudVocab(updated);
    void updateRemoteVocab(tokenOrThrow(), id, input).catch(() => {
      replaceCloudVocab(current);
    });
    return updated;
  },

  remove(id) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      localVocabRepository.remove(id);
      return;
    }

    const current = getCloudVocab().find((item) => item.id === id);
    removeCloudVocab(id);
    void deleteRemoteVocab(tokenOrThrow(), id).catch(() => {
      if (current) addCloudVocab(current);
    });
  },

  recordPractice(id, score) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return localVocabRepository.recordPractice(id, score);
    }

    const current = getCloudVocab().find((item) => item.id === id);
    if (!current) throw new Error("Vocab item not found");
    const updated: VocabItem = {
      ...current,
      lastScore: score,
      lastPracticedAt: Date.now(),
      practiceCount: (current.practiceCount ?? 0) + 1,
      updatedAt: Date.now(),
    };
    replaceCloudVocab(updated);
    void recordRemotePractice(tokenOrThrow(), id, score).catch(() => {
      replaceCloudVocab(current);
    });
    return updated;
  },

  listWrong(threshold) {
    return this.list().filter(
      (item) =>
        item.lastScore !== undefined &&
        item.lastScore < threshold &&
        (item.practiceCount ?? 0) > 0,
    );
  },

  listByTags(tagIds) {
    const items = this.list();
    if (tagIds.length === 0) return items;
    return items.filter((item) => tagIds.some((id) => item.tagIds.includes(id)));
  },
};
