<script setup lang="ts">
import { computed, ref } from "vue";
import { tagRepository, repositoryRevision } from "@/repositories";
import { cloudTagsRef } from "@/repositories/cloudCache";
import { useAuthStore } from "@/stores/authStore";
import type { PracticeFilter, PracticeMode } from "@/types";

const authStore = useAuthStore();

const emit = defineEmits<{
  start: [
    payload: {
      filter: PracticeFilter;
      tagIds: string[];
      mode: PracticeMode;
    },
  ];
}>();

const filter = ref<PracticeFilter>("all");
const mode = ref<PracticeMode>("direct");
const selectedTagIds = ref<string[]>([]);

const tags = computed(() => {
  if (authStore.isAuthenticated) {
    return [...cloudTagsRef.value].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }
  repositoryRevision.value;
  return tagRepository.list();
});

function toggleTag(id: string) {
  if (selectedTagIds.value.includes(id)) {
    selectedTagIds.value = selectedTagIds.value.filter((t) => t !== id);
  } else {
    selectedTagIds.value = [...selectedTagIds.value, id];
  }
}

function submit() {
  emit("start", {
    filter: filter.value,
    tagIds: selectedTagIds.value,
    mode: mode.value,
  });
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="mb-3 text-sm font-medium text-slate-300">練習範圍</h2>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="option in [
            { value: 'all', label: '全部' },
            { value: 'tags', label: '標籤' },
            { value: 'wrong', label: '錯題' },
          ]"
          :key="option.value"
          type="button"
          class="rounded-xl border px-3 py-2 text-sm transition-colors"
          :class="
            filter === option.value
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
              : 'border-slate-700 text-slate-400 hover:border-slate-600'
          "
          @click="filter = option.value as PracticeFilter"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="filter === 'tags'" class="space-y-2">
      <p class="text-xs text-slate-500">選擇一個或多個標籤</p>
      <div v-if="tags.length === 0" class="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
        尚無標籤，請先到「標籤」頁建立
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="tag in tags"
          :key="tag.id"
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition-colors"
          :class="
            selectedTagIds.includes(tag.id)
              ? 'border-transparent text-white'
              : 'border-slate-700 text-slate-400'
          "
          :style="
            selectedTagIds.includes(tag.id)
              ? { backgroundColor: tag.color }
              : undefined
          "
          @click="toggleTag(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <div>
      <h2 class="mb-3 text-sm font-medium text-slate-300">練習模式</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-xl border px-3 py-3 text-left text-sm transition-colors"
          :class="
            mode === 'direct'
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
              : 'border-slate-700 text-slate-400'
          "
          @click="mode = 'direct'"
        >
          <div class="font-medium">直接念</div>
          <div class="mt-1 text-xs opacity-70">看文字後開口說</div>
        </button>
        <button
          type="button"
          class="rounded-xl border px-3 py-3 text-left text-sm transition-colors"
          :class="
            mode === 'listen-first'
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
              : 'border-slate-700 text-slate-400'
          "
          @click="mode = 'listen-first'"
        >
          <div class="font-medium">先聽再念</div>
          <div class="mt-1 text-xs opacity-70">AI 先播一次再跟讀</div>
        </button>
      </div>
    </div>

    <button
      type="button"
      class="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
      @click="submit"
    >
      開始練習
    </button>
  </section>
</template>
