<script setup lang="ts">
import { computed, ref } from "vue";
import { tagRepository, vocabRepository } from "@/repositories";
import { TAG_COLORS } from "@/types";

const tags = computed(() => tagRepository.list());
const newName = ref("");
const editingId = ref<string | null>(null);
const editName = ref("");
const editColor = ref(TAG_COLORS[0]);

function countForTag(tagId: string): number {
  return vocabRepository.list().filter((v) => v.tagIds.includes(tagId)).length;
}

function createTag() {
  const name = newName.value.trim();
  if (!name) return;
  const color = TAG_COLORS[tags.value.length % TAG_COLORS.length];
  tagRepository.create(name, color);
  newName.value = "";
}

function startEdit(id: string) {
  const tag = tagRepository.get(id);
  if (!tag) return;
  editingId.value = id;
  editName.value = tag.name;
  editColor.value = tag.color;
}

function saveEdit() {
  if (!editingId.value || !editName.value.trim()) return;
  tagRepository.update(editingId.value, {
    name: editName.value,
    color: editColor.value,
  });
  editingId.value = null;
}

function removeTag(id: string) {
  const count = countForTag(id);
  const msg =
    count > 0
      ? `此標籤有 ${count} 筆詞庫使用。刪除後詞庫仍保留，但會移除此標籤。確定？`
      : "確定刪除此標籤？";
  if (confirm(msg)) {
    tagRepository.remove(id);
    for (const item of vocabRepository.list()) {
      if (item.tagIds.includes(id)) {
        vocabRepository.update(item.id, {
          tagIds: item.tagIds.filter((t) => t !== id),
        });
      }
    }
  }
}
</script>

<template>
  <div class="space-y-4">
    <form class="flex gap-2" @submit.prevent="createTag">
      <input
        v-model="newName"
        placeholder="新標籤名稱"
        class="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <button
        type="submit"
        class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        :disabled="!newName.trim()"
      >
        新增
      </button>
    </form>

    <ul v-if="tags.length" class="space-y-2">
      <li
        v-for="tag in tags"
        :key="tag.id"
        class="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <div v-if="editingId === tag.id" class="space-y-2">
          <input
            v-model="editName"
            class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in TAG_COLORS"
              :key="color"
              type="button"
              class="h-7 w-7 rounded-full border-2"
              :class="editColor === color ? 'border-white' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="editColor = color"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg border border-slate-700 py-2 text-sm"
              @click="editingId = null"
            >
              取消
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-indigo-600 py-2 text-sm text-white"
              @click="saveEdit"
            >
              儲存
            </button>
          </div>
        </div>

        <div v-else class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="h-4 w-4 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" />
            <div>
              <p class="font-medium text-white">{{ tag.name }}</p>
              <p class="text-xs text-slate-500">{{ countForTag(tag.id) }} 筆詞庫</p>
            </div>
          </div>
          <div class="flex gap-1">
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white"
              @click="startEdit(tag.id)"
            >
              編輯
            </button>
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-xs text-rose-400"
              @click="removeTag(tag.id)"
            >
              刪除
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
      尚無標籤。建立分類後可在詞庫中套用，並依標籤練習。
    </p>
  </div>
</template>
