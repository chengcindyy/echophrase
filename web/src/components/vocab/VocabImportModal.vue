<script setup lang="ts">
import { computed, ref } from "vue";
import { vocabRepository } from "@/repositories";
import { importParsedVocabRowsAsync, reloadCloudData } from "@/repositories/cloudPersist";
import { useAuthStore } from "@/stores/authStore";
import { buildImportPlan, type ImportPlan } from "@/lib/vocabCsv";

const authStore = useAuthStore();

const emit = defineEmits<{
  close: [];
  imported: [count: number];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref("");
const parseError = ref<string | null>(null);
const plan = ref<ImportPlan | null>(null);
const importing = ref(false);
const importSuccess = ref<string | null>(null);

const previewRows = computed(() => plan.value?.rows.slice(0, 30) ?? []);
const hiddenRowCount = computed(() =>
  plan.value ? Math.max(0, plan.value.rows.length - previewRows.value.length) : 0,
);

function reset() {
  fileName.value = "";
  parseError.value = null;
  importSuccess.value = null;
  plan.value = null;
  if (fileInput.value) fileInput.value.value = "";
}

function openFilePicker() {
  fileInput.value?.click();
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  reset();
  fileName.value = file.name;

  try {
    if (authStore.isAuthenticated) {
      await reloadCloudData();
    }
    const text = await file.text();
    const nextPlan = buildImportPlan(text, vocabRepository.list());
    if (nextPlan.rows.length === 0) {
      parseError.value = "CSV 沒有可匯入的資料列";
      return;
    }
    plan.value = nextPlan;
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : "無法讀取 CSV";
  }
}

function tagLabels(tagNames: string[]): string {
  return tagNames.join("、");
}

function statusLabel(status: ImportPlan["rows"][number]["status"]): string {
  switch (status) {
    case "new":
      return "新增";
    case "duplicate":
      return "略過";
    case "invalid":
      return "無效";
  }
}

function statusClass(status: ImportPlan["rows"][number]["status"]): string {
  switch (status) {
    case "new":
      return "text-emerald-400";
    case "duplicate":
      return "text-amber-400";
    case "invalid":
      return "text-rose-400";
  }
}

async function confirmImport() {
  if (!plan.value || plan.value.newCount === 0 || importing.value) return;
  importing.value = true;
  parseError.value = null;
  importSuccess.value = null;
  try {
    if (authStore.isAuthenticated) {
      await reloadCloudData();
    }
    const added = await importParsedVocabRowsAsync(plan.value.toCreateRows);
    importSuccess.value = `已成功匯入 ${added} 筆`;
    emit("imported", added);
    window.setTimeout(() => emit("close"), 600);
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : "匯入失敗，請稍後再試";
  } finally {
    importing.value = false;
  }
}

function close() {
  reset();
  emit("close");
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    @click.self="close"
  >
    <div
      class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-white">匯入 CSV</h2>
          <p class="mt-1 text-xs text-slate-500">
            支援欄位：text, translation, tags（進階：type, ipa, notes）
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-white"
          @click="close"
        >
          關閉
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        class="hidden"
        @change="onFileChange"
      />

      <button
        type="button"
        class="mt-4 w-full rounded-xl border border-dashed border-slate-600 py-6 text-sm text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
        @click="openFilePicker"
      >
        {{ fileName ? `已選擇：${fileName}` : "選擇 CSV 檔案" }}
      </button>

      <p v-if="importSuccess" class="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
        {{ importSuccess }}
      </p>

      <p v-if="parseError" class="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
        {{ parseError }}
      </p>

      <div v-if="plan" class="mt-4 space-y-3">
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-lg bg-emerald-500/10 px-2 py-2 text-emerald-400">
            新增 {{ plan.newCount }}
          </div>
          <div class="rounded-lg bg-amber-500/10 px-2 py-2 text-amber-400">
            略過 {{ plan.duplicateCount }}
          </div>
          <div class="rounded-lg bg-rose-500/10 px-2 py-2 text-rose-400">
            無效 {{ plan.invalidCount }}
          </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-950/80 text-slate-500">
              <tr>
                <th class="px-2 py-2">列</th>
                <th class="px-2 py-2">法文</th>
                <th class="px-2 py-2">狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in previewRows"
                :key="row.lineNumber"
                class="border-t border-slate-800/80"
              >
                <td class="px-2 py-2 tabular-nums text-slate-500">{{ row.lineNumber }}</td>
                <td class="px-2 py-2">
                  <p class="text-slate-200">{{ row.row?.text ?? "—" }}</p>
                  <p v-if="row.row?.translation" class="text-slate-500">
                    {{ row.row.translation }}
                  </p>
                  <p v-if="row.row?.tagNames.length" class="text-slate-600">
                    {{ tagLabels(row.row.tagNames) }}
                  </p>
                  <p v-if="row.message" class="text-slate-600">{{ row.message }}</p>
                </td>
                <td class="px-2 py-2 font-medium" :class="statusClass(row.status)">
                  {{ statusLabel(row.status) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="hiddenRowCount > 0" class="text-center text-xs text-slate-500">
          還有 {{ hiddenRowCount }} 列未顯示
        </p>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300"
            @click="close"
          >
            取消
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="plan.newCount === 0 || importing"
            @click="confirmImport"
          >
            {{ importing ? "匯入中…" : `匯入 ${plan.newCount} 筆` }}
          </button>
        </div>
      </div>

      <div v-else class="mt-4 rounded-xl bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-500">
        <p class="font-medium text-slate-400">CSV 範例</p>
        <pre class="mt-2 overflow-x-auto font-mono text-[11px] text-slate-400">text,translation,tags
bonjour,你好,問候|A1
merci,謝謝,問候
Comment allez-vous ?,您好吗？（正式）,問候</pre>
        <p class="mt-2">標籤用 | 分隔；不存在會自動建立。重複原文會略過。</p>
      </div>
    </div>
  </div>
</template>
