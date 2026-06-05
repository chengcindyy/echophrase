<script setup lang="ts">
import { computed, ref } from "vue";
import { playObjectUrl } from "@/lib/audioPlayback";
import { buildPaceInsight, buildWeakestInsight } from "@/lib/scoreInsights";
import type { WordResult } from "@/types";

const props = defineProps<{
  accuracyScore: number;
  fluencyScore?: number;
  completenessScore?: number;
  pronunciationScore?: number;
  words: WordResult[];
  recordingUrl?: string | null;
  recordingDurationMs?: number;
  referenceDurationMs?: number;
  ttsLoading?: boolean;
  wordTtsLoading?: string | null;
}>();

const emit = defineEmits<{
  playReference: [];
  playWord: [word: string];
}>();

const playingRecording = ref(false);

const lexicalWords = computed(() =>
  props.words.filter((w) => /[\p{L}\p{N}]/u.test(w.word.trim())),
);

const weakestInsight = computed(() => buildWeakestInsight(props.words));
const paceInsight = computed(() =>
  buildPaceInsight(props.recordingDurationMs, props.referenceDurationMs),
);

function scoreBarClass(score: number): string {
  if (score >= 80) return "bg-emerald-500/80";
  if (score >= 60) return "bg-amber-500/80";
  return "bg-rose-500/80";
}

function wordScoreClass(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-rose-400";
}

function segmentFlex(durationMs?: number): number {
  return durationMs && durationMs > 0 ? durationMs : 1;
}

function errorLabel(errorType?: string): string | null {
  switch (errorType) {
    case "Mispronunciation":
      return "發音錯誤";
    case "Omission":
      return "漏念";
    case "Insertion":
      return "多念";
    case "UnexpectedBreak":
      return "不應停頓";
    case "MissingBreak":
      return "缺少停頓";
    default:
      return null;
  }
}

function isWordPlaying(word: string): boolean {
  return props.wordTtsLoading === word;
}

async function playRecording() {
  if (!props.recordingUrl || playingRecording.value) return;
  playingRecording.value = true;
  try {
    await playObjectUrl(props.recordingUrl);
  } finally {
    playingRecording.value = false;
  }
}
</script>

<template>
  <div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">準確度</p>
        <p class="text-3xl font-bold tabular-nums text-white">{{ Math.round(accuracyScore) }}</p>
        <p
          v-if="pronunciationScore !== undefined"
          class="mt-1 text-xs text-slate-400"
        >
          綜合 PronScore
          <span class="font-semibold tabular-nums text-indigo-300">
            {{ Math.round(pronunciationScore) }}
          </span>
        </p>
      </div>
      <div class="text-right text-xs text-slate-500">
        <p v-if="fluencyScore !== undefined">流暢 {{ Math.round(fluencyScore) }}</p>
        <p v-if="completenessScore !== undefined">完整 {{ Math.round(completenessScore) }}</p>
      </div>
    </div>

    <div
      v-if="weakestInsight || paceInsight"
      class="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5"
    >
      <p v-if="weakestInsight" class="text-sm text-indigo-200">{{ weakestInsight }}</p>
      <p v-if="paceInsight" class="text-xs text-slate-400">
        <span
          class="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="
            paceInsight.label === '接近標準'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400'
          "
        >
          {{ paceInsight.label }}
        </span>
        {{ paceInsight.detail }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50"
        :disabled="ttsLoading"
        @click="emit('playReference')"
      >
        {{ ttsLoading && !wordTtsLoading ? "播放中…" : "🔊 標準發音" }}
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50"
        :disabled="!recordingUrl || playingRecording"
        @click="playRecording"
      >
        {{ playingRecording ? "播放中…" : "▶ 我的錄音" }}
      </button>
    </div>

    <div class="space-y-3 border-t border-slate-800 pt-3">
      <div class="flex items-center justify-between">
        <p class="text-xs font-medium text-slate-400">發音分析</p>
        <p class="text-[10px] text-slate-600">綠 ≥80 · 黃 60–79 · 紅 &lt;60</p>
      </div>
      <p class="text-[10px] leading-relaxed text-slate-600">
        色條由左至右對應 Azure 切出的音段；點各詞 🔊 可聽該詞標準發音。
      </p>

      <div
        v-for="word in lexicalWords"
        :key="word.word"
        class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <span class="font-medium text-slate-200">{{ word.word }}</span>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-slate-700 px-2 py-0.5 text-xs transition-colors hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50"
              :disabled="ttsLoading"
              :title="`聽「${word.word}」標準發音`"
              @click="emit('playWord', word.word)"
            >
              {{ isWordPlaying(word.word) ? "…" : "🔊" }}
            </button>
          </div>
          <span
            class="shrink-0 text-sm font-semibold tabular-nums"
            :class="wordScoreClass(word.accuracyScore)"
          >
            {{ Math.round(word.accuracyScore) }}
          </span>
        </div>

        <p v-if="errorLabel(word.errorType)" class="mt-1 text-xs text-amber-400">
          {{ errorLabel(word.errorType) }}
        </p>

        <div v-if="word.phonemes.length" class="mt-3">
          <div class="flex h-9 w-full overflow-hidden rounded-lg bg-slate-800/60">
            <div
              v-for="(segment, idx) in word.phonemes"
              :key="`${word.word}-seg-${idx}`"
              class="min-w-[6px] border-r border-slate-950/40 last:border-r-0"
              :class="scoreBarClass(segment.accuracyScore)"
              :style="{ flex: segmentFlex(segment.durationMs) }"
              :title="`段 ${idx + 1}：${Math.round(segment.accuracyScore)} 分`"
            />
          </div>
          <div class="mt-1 flex justify-between text-[10px] text-slate-600">
            <span>段 1</span>
            <span>段 {{ word.phonemes.length }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
