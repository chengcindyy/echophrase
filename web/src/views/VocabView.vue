<script setup lang="ts">

import { computed, reactive, ref } from "vue";

import { tagRepository, vocabRepository, repositoryRevision } from "@/repositories";

import { cloudTagsRef, cloudVocabRef } from "@/repositories/cloudCache";

import { createVocabAsync, updateVocabAsync } from "@/repositories/cloudPersist";

import VocabImportModal from "@/components/vocab/VocabImportModal.vue";

import { downloadCsv, exportVocabCsv } from "@/lib/vocabCsv";

import { useAuthStore } from "@/stores/authStore";

import type { VocabInput, VocabItem, VocabType } from "@/types";



const authStore = useAuthStore();

const items = computed(() => {
  if (authStore.isAuthenticated) {
    return [...cloudVocabRef.value].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  repositoryRevision.value;
  return vocabRepository.list();
});

const tags = computed(() => {
  if (authStore.isAuthenticated) {
    return [...cloudTagsRef.value].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }
  repositoryRevision.value;
  return tagRepository.list();
});

const search = ref("");

const showForm = ref(false);

const showImport = ref(false);

const importMessage = ref<string | null>(null);
const saveError = ref<string | null>(null);

const editingId = ref<string | null>(null);



const form = reactive<VocabInput>({

  type: "word",

  text: "",

  ipa: "",

  translation: "",

  notes: "",

  tagIds: [],

});



const filtered = computed(() => {

  const q = search.value.trim().toLowerCase();

  if (!q) return items.value;

  return items.value.filter(

    (v) =>

      v.text.toLowerCase().includes(q) ||

      v.translation?.toLowerCase().includes(q) ||

      v.notes?.toLowerCase().includes(q),

  );

});



function resetForm() {

  form.type = "word";

  form.text = "";

  form.ipa = "";

  form.translation = "";

  form.notes = "";

  form.tagIds = [];

  editingId.value = null;

}



function openCreate() {

  resetForm();

  showForm.value = true;

}



function openEdit(item: VocabItem) {

  editingId.value = item.id;

  form.type = item.type;

  form.text = item.text;

  form.ipa = item.ipa ?? "";

  form.translation = item.translation ?? "";

  form.notes = item.notes ?? "";

  form.tagIds = [...item.tagIds];

  showForm.value = true;

}



function toggleTag(tagId: string) {

  if (form.tagIds.includes(tagId)) {

    form.tagIds = form.tagIds.filter((id) => id !== tagId);

  } else {

    form.tagIds = [...form.tagIds, tagId];

  }

}



async function save() {

  if (!form.text.trim()) return;

  saveError.value = null;

  const payload: VocabInput = {

    type: form.type,

    text: form.text,

    ipa: form.ipa || undefined,

    translation: form.translation || undefined,

    notes: form.notes || undefined,

    tagIds: form.tagIds,

  };

  try {

    if (editingId.value) {

      await updateVocabAsync(editingId.value, payload);

    } else {

      await createVocabAsync(payload);

    }

    showForm.value = false;

    resetForm();

  } catch (e) {

    saveError.value = e instanceof Error ? e.message : "儲存失敗，請稍後再試";

  }

}



function remove(id: string) {

  if (confirm("確定刪除這筆詞庫？")) {

    vocabRepository.remove(id);

  }

}



function exportCsv() {

  const csv = exportVocabCsv(items.value, tagName);

  const date = new Date().toISOString().slice(0, 10);

  downloadCsv(`echophrase-vocab-${date}.csv`, csv);

}



function onImported(count: number) {

  showImport.value = false;

  importMessage.value = `已匯入 ${count} 筆詞庫`;

  window.setTimeout(() => {

    importMessage.value = null;

  }, 4000);

}



function tagName(tagId: string): string {

  return tagRepository.get(tagId)?.name ?? tagId;

}



function tagColor(tagId: string): string {

  return tagRepository.get(tagId)?.color ?? "#6366f1";

}



function typeLabel(type: VocabType): string {

  return type === "word" ? "單字" : "句子";

}

</script>



<template>

  <div class="space-y-4">

    <div class="flex gap-2">

      <input

        v-model="search"

        type="search"

        placeholder="搜尋詞庫…"

        class="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"

      />

      <button

        type="button"

        class="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"

        @click="openCreate"

      >

        新增

      </button>

    </div>



    <div class="flex flex-wrap gap-2">

      <button

        type="button"

        class="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-indigo-300"

        @click="showImport = true"

      >

        匯入 CSV

      </button>

      <button

        type="button"

        class="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50"

        :disabled="items.length === 0"

        @click="exportCsv"

      >

        匯出 CSV

      </button>

    </div>



    <p v-if="importMessage" class="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">

      {{ importMessage }}

    </p>

    <p v-if="saveError" class="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">

      {{ saveError }}

    </p>



    <div

      v-if="showForm"

      class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"

    >

      <h2 class="text-sm font-medium text-slate-300">

        {{ editingId ? "編輯" : "新增" }}詞庫

      </h2>



      <div class="grid grid-cols-2 gap-2">

        <button

          v-for="t in (['word', 'sentence'] as VocabType[])"

          :key="t"

          type="button"

          class="rounded-lg border py-2 text-sm"

          :class="

            form.type === t

              ? 'border-indigo-500 text-indigo-300'

              : 'border-slate-700 text-slate-400'

          "

          @click="form.type = t"

        >

          {{ typeLabel(t) }}

        </button>

      </div>



      <input

        v-model="form.text"

        placeholder="法文原文 *"

        class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"

      />

      <input

        v-model="form.ipa"

        placeholder="IPA 音標（選填，僅供參考）例 /mɛʁ.si/"

        class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"

      />

      <input

        v-model="form.translation"

        placeholder="释义（選填）"

        class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"

      />

      <textarea

        v-model="form.notes"

        placeholder="備註（選填）"

        rows="2"

        class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"

      />



      <div v-if="tags.length" class="flex flex-wrap gap-2">

        <button

          v-for="tag in tags"

          :key="tag.id"

          type="button"

          class="rounded-full border px-2.5 py-0.5 text-xs"

          :class="

            form.tagIds.includes(tag.id)

              ? 'border-transparent text-white'

              : 'border-slate-700 text-slate-400'

          "

          :style="form.tagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined"

          @click="toggleTag(tag.id)"

        >

          {{ tag.name }}

        </button>

      </div>

      <p v-else class="text-xs text-slate-500">尚無標籤，可至「標籤」頁建立</p>



      <div class="flex gap-2">

        <button

          type="button"

          class="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-300"

          @click="showForm = false"

        >

          取消

        </button>

        <button

          type="button"

          class="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white"

          :disabled="!form.text.trim()"

          @click="save"

        >

          儲存

        </button>

      </div>

    </div>



    <div v-if="filtered.length === 0" class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">

      {{ items.length === 0 ? "詞庫是空的，點「新增」或「匯入 CSV」開始建立" : "沒有符合搜尋的結果" }}

    </div>



    <ul v-else class="space-y-2">

      <li

        v-for="item in filtered"

        :key="item.id"

        class="rounded-xl border border-slate-800 bg-slate-900/40 p-4"

      >

        <div class="flex items-start justify-between gap-2">

          <div class="min-w-0">

            <div class="flex items-center gap-2">

              <span class="text-xs text-slate-500">{{ typeLabel(item.type) }}</span>

              <span v-if="item.lastScore !== undefined" class="text-xs tabular-nums text-slate-500">

                上次 {{ Math.round(item.lastScore) }}

              </span>

            </div>

            <p class="mt-1 font-medium text-white">{{ item.text }}</p>

            <p v-if="item.ipa" class="font-mono text-xs text-indigo-300">{{ item.ipa }}</p>

            <p v-if="item.translation" class="text-sm text-slate-400">{{ item.translation }}</p>

          </div>

          <div class="flex shrink-0 gap-1">

            <button

              type="button"

              class="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white"

              @click="openEdit(item)"

            >

              編輯

            </button>

            <button

              type="button"

              class="rounded-lg px-2 py-1 text-xs text-rose-400 hover:text-rose-300"

              @click="remove(item.id)"

            >

              刪除

            </button>

          </div>

        </div>

        <div v-if="item.tagIds.length" class="mt-2 flex flex-wrap gap-1">

          <span

            v-for="tagId in item.tagIds"

            :key="tagId"

            class="rounded-full px-2 py-0.5 text-xs text-white"

            :style="{ backgroundColor: tagColor(tagId) }"

          >

            {{ tagName(tagId) }}

          </span>

        </div>

      </li>

    </ul>



    <VocabImportModal

      v-if="showImport"

      @close="showImport = false"

      @imported="onImported"

    />

  </div>

</template>


