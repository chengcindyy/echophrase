import type { Tag } from "@/types";
import type { TagRepository } from "../types";

const STORAGE_KEY = "echophrase:tags:v1";

function load(): Tag[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tag[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(tags: Tag[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

function newId(): string {
  return crypto.randomUUID();
}

export function createLocalTagRepository(): TagRepository {
  let tags = load();

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
      save(tags);
      return tag;
    },

    update(id, patch) {
      const index = tags.findIndex((t) => t.id === id);
      if (index < 0) throw new Error("Tag not found");
      const updated = { ...tags[index], ...patch };
      if (patch.name !== undefined) updated.name = patch.name.trim();
      tags = tags.map((t) => (t.id === id ? updated : t));
      save(tags);
      return updated;
    },

    remove(id) {
      tags = tags.filter((t) => t.id !== id);
      save(tags);
    },
  };
}

export const tagRepository = createLocalTagRepository();
