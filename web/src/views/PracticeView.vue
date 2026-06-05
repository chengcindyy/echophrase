<script setup lang="ts">
import { ref } from "vue";
import PracticeCard from "@/components/practice/PracticeCard.vue";
import PracticeSetup from "@/components/practice/PracticeSetup.vue";
import { usePracticeSession } from "@/composables/usePracticeSession";
import { useSettingsStore } from "@/stores/settingsStore";
import type { PracticeSetup as PracticeSetupType } from "@/types";

const settingsStore = useSettingsStore();
const {
  active,
  current,
  setup,
  progress,
  total,
  hasNext,
  start,
  next,
  stop,
  recordScore,
} = usePracticeSession();
const errorMessage = ref<string | null>(null);
const finished = ref(false);

function handleStart(setup: PracticeSetupType) {
  errorMessage.value = null;
  finished.value = false;
  const ok = start(setup, settingsStore.settings.wrongThreshold);
  if (!ok) {
    if (setup.filter === "wrong") {
      errorMessage.value = "目前沒有錯題。先練習幾題後，低於閾值的項目會出現在這裡。";
    } else if (setup.filter === "tags" && setup.tagIds.length === 0) {
      errorMessage.value = "請至少選擇一個標籤。";
    } else {
      errorMessage.value = "詞庫是空的，請先到「詞庫」新增內容。";
    }
  }
}

function handleScored(score: number) {
  const item = current.value;
  if (item) recordScore(item.id, score);
}

function handleNext() {
  if (hasNext.value) {
    next();
    return;
  }
  finished.value = true;
  stop();
}

function handleExit() {
  finished.value = false;
  stop();
}
</script>

<template>
  <div>
    <PracticeSetup v-if="!active && !finished" @start="handleStart" />

    <div
      v-else-if="finished"
      class="flex flex-col items-center gap-4 py-16 text-center"
    >
      <p class="text-lg font-medium text-white">本次練習完成</p>
      <p class="text-sm text-slate-400">做得好！隨時可以再開一輪。</p>
      <button
        type="button"
        class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
        @click="finished = false"
      >
        返回
      </button>
    </div>

    <PracticeCard
      v-else-if="current && setup"
      :key="current.id"
      :item="current"
      :mode="setup.mode"
      :progress="progress"
      :total="total"
      :has-next="hasNext"
      @scored="handleScored"
      @next="handleNext"
      @exit="handleExit"
    />

    <p v-if="errorMessage" class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      {{ errorMessage }}
    </p>
  </div>
</template>
