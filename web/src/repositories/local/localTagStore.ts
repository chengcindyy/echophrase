import type { Tag } from "@/types";
import type { TagRepository } from "../types";
import { bumpRepositoryRevision } from "../repositoryRevision";
import { loadLocalTags, saveLocalTags } from "./localStorageData";

function newId(): string {
  return crypto.randomUUID();
}

export function createLocalTagRepository(): TagRepository {
  let tags = loadLocalTags();

  function persist() {
    saveLocalTags(tags);
    bumpRepositoryRevision();
  }

  return {
    list() {
      return [...tags].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    },

    get(id) {
      return tags.find((t) => t.id === id);
    },

    create(name, color) {
      const maxOrder = tags.reduce((max, t) => Math.max(max, t.sortOrder), -1);
      const tag: Tag = {
        id: newId(),
        name: name.trim(),
        color: color ?? "#6366f1",
        sortOrder: maxOrder + 1,
      };
      tags = [...tags, tag];
      persist();
      return tag;
    },

    update(id, patch) {
      const index = tags.findIndex((t) => t.id === id);
      if (index < 0) throw new Error("Tag not found");
      const updated = { ...tags[index], ...patch };
      if (patch.name !== undefined) updated.name = patch.name.trim();
      tags = tags.map((t) => (t.id === id ? updated : t));
      persist();
      return updated;
    },

    reorder(orderedIds) {
      if (orderedIds.length !== tags.length) {
        throw new Error("Tag reorder list length mismatch");
      }
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      if (orderMap.size !== tags.length || tags.some((t) => !orderMap.has(t.id))) {
        throw new Error("Tag reorder list mismatch");
      }
      tags = tags.map((t) => ({ ...t, sortOrder: orderMap.get(t.id)! }));
      persist();
    },

    remove(id) {
      tags = tags.filter((t) => t.id !== id);
      persist();
    },
  };
}

export const localTagRepository = createLocalTagRepository();
