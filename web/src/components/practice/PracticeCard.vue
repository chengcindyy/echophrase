<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { tagRepository, repositoryRevision } from "@/repositories";
import { cloudTagsRef } from "@/repositories/cloudCache";
import { useAuthStore } from "@/stores/authStore";
import { fetchTts } from "@/api/client";
import { getBase64AudioDurationMs, getBlobDurationMs } from "@/lib/audioDuration";
import { useAssess } from "@/composables/useAssess";
import { useRecorder } from "@/composables/useRecorder";
import { useTTS } from "@/composables/useTTS";
import { useSettingsStore } from "@/stores/settingsStore";
import ScoreResult from "@/components/practice/ScoreResult.vue";
import type { PracticeMode, VocabItem } from "@/types";

const props = defineProps<{
  item: VocabItem;
  mode: PracticeMode;
  progress: number;
  total: number;
  hasNext: boolean;
}>();

const emit = defineEmits<{
  next: [];
  exit: [];
  scored: [score: number];
}>();

const phase = ref<"ready" | "preparing" | "recording" | "assessing" | "result">("ready");
const listenPlayed = ref(false);
const actionError = ref<string | null>(null);
const recordingUrl = ref<string | null>(null);
const recordingDurationMs = ref<number | undefined>();
const referenceDurationMs = ref<number | undefined>();
const wordTtsLoading = ref<string | null>(null);

const settingsStore = useSettingsStore();
const authStore = useAuthStore();

const {
  recording,
  preparing: recorderPreparing,
  stopping: recorderStopping,
  error: recorderError,
  start: startRecording,
  stop: stopRecording,
} = useRecorder();
const { loading: ttsLoading, error: ttsError, needsRetap: ttsNeedsRetap, speak, warm } = useTTS();
const { loading: assessLoading, error: assessError, result, assess, reset } = useAssess();

const tags = computed(() => {
  if (authStore.isAuthenticated) {
    return props.item.tagIds
      .map((id) => cloudTagsRef.value.find((tag) => tag.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }
  repositoryRevision.value;
  return props.item.tagIds
    .map((id) => tagRepository.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
});

const busy = computed(
  () =>
    ttsLoading.value ||
    recording.value ||
    recorderPreparing.value ||
    recorderStopping.value ||
    assessLoading.value ||
    phase.value === "assessing" ||
    phase.value === "preparing",
);

const recordButtonDisabled = computed(
  () =>
    phase.value === "preparing" ||
    recorderPreparing.value ||
    phase.value === "assessing" ||
    assessLoading.value ||
    recorderStopping.value,
);

const recordButtonLabel = computed(() => {
  if (phase.value === "preparing" || recorderPreparing.value) return "準備中";
  if (recorderStopping.value) return "停止中";
  if (phase.value === "recording") return "停止";
  return "開始念";
});

function clearRecordingUrl() {
  if (recordingUrl.value) {
    URL.revokeObjectURL(recordingUrl.value);
    recordingUrl.value = null;
  }
  recordingDurationMs.value = undefined;
  referenceDurationMs.value = undefined;
}

async function loadReferenceDuration(text: string): Promise<void> {
  try {
    const tts = await fetchTts({
      text,
      voice: settingsStore.settings.ttsVoice,
      rate: settingsStore.settings.ttsRate,
    });
    referenceDurationMs.value = await getBase64AudioDurationMs(
      tts.audioBase64,
      tts.contentType,
    );
  } catch {
    referenceDurationMs.value = undefined;
  }
}

function resetCard() {
  phase.value = "ready";
  listenPlayed.value = false;
  actionError.value = null;
  clearRecordingUrl();
  reset();
}

watch(
  () => props.item.id,
  () => resetCard(),
);

watch(
  () => [props.item.text, settingsStore.settings.ttsVoice, settingsStore.settings.ttsRate] as const,
  ([text]) => warm(text),
  { immediate: true },
);

onMounted(() => {
  void maybeAutoPlay();
});

onUnmounted(() => {
  clearRecordingUrl();
});

async function playReference() {
  wordTtsLoading.value = null;
  await speak(props.item.text);
}

async function playWord(word: string) {
  wordTtsLoading.value = word;
  try {
    await speak(word);
  } finally {
    wordTtsLoading.value = null;
  }
}

function canAutoPlay(): boolean {
  // iOS blocks autoplay without a user gesture.
  return !/iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function maybeAutoPlay() {
  if (
    canAutoPlay() &&
    props.mode === "listen-first" &&
    !listenPlayed.value &&
    phase.value === "ready"
  ) {
    listenPlayed.value = true;
    try {
      await playReference();
    } catch {
      // User can tap play manually.
    }
  }
}

async function handleRecordToggle() {
  actionError.value = null;

  if (recordButtonDisabled.value) {
    return;
  }

  if (phase.value === "recording") {
    try {
      const { blob, contentType } = await stopRecording();
      phase.value = "assessing";
      clearRecordingUrl();
      recordingUrl.value = URL.createObjectURL(blob);
      const [score, recMs] = await Promise.all([
        assess(props.item.text, blob, contentType),
        getBlobDurationMs(blob),
      ]);
      recordingDurationMs.value = recMs;
      void loadReferenceDuration(props.item.text);
      phase.value = "result";
      emit("scored", score.accuracyScore);
    } catch (e) {
      phase.value = "ready";
      clearRecordingUrl();
      actionError.value =
        assessError.value ??
        recorderError.value ??
        (e instanceof Error ? e.message : "評分失敗，請再試一次");
    }
    return;
  }

  reset();
  phase.value = "preparing";
  try {
    await startRecording();
    phase.value = "recording";
  } catch (e) {
    phase.value = "ready";
    actionError.value = e instanceof Error ? e.message : "無法開始錄音";
  }
}

function handleNext() {
  emit("next");
}

function handleRetry() {
  resetCard();
  void maybeAutoPlay();
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between text-xs text-slate-500">
      <span>{{ progress }} / {{ total }}</span>
      <button type="button" class="text-slate-400 hover:text-slate-200" @click="emit('exit')">
        結束
      </button>
    </div>

    <article class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="break-words text-2xl font-semibold leading-snug text-white">
            {{ item.text }}
          </p>
          <p v-if="item.ipa" class="mt-2 font-mono text-sm text-indigo-300">{{ item.ipa }}</p>
          <p v-if="item.translation" class="mt-1 text-sm text-slate-400">{{ item.translation }}</p>
          <p v-if="item.notes" class="mt-2 text-xs leading-relaxed text-slate-500">{{ item.notes }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50"
          :disabled="busy"
          @click.stop="playReference"
        >
          {{ ttsLoading ? "播放中…" : ttsNeedsRetap ? "🔊 再點播放" : "🔊 播放" }}
        </button>
      </div>

      <div v-if="tags.length" class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="tag in tags"
          :key="tag.id"
          class="rounded-full px-2.5 py-0.5 text-xs text-white"
          :style="{ backgroundColor: tag.color }"
        >
          {{ tag.name }}
        </span>
      </div>
    </article>

    <p v-if="ttsError" class="text-sm text-rose-400">{{ ttsError }}</p>
    <p v-if="actionError || assessError" class="text-sm text-rose-400">
      {{ actionError ?? assessError }}
    </p>

    <div v-if="phase !== 'result'" class="flex flex-col items-center gap-3 py-4">
      <p class="text-sm text-slate-400">
        {{
          phase === "preparing" || recorderPreparing
            ? "麥克風準備中… 請稍候"
            : recorderStopping
              ? "正在停止錄音…"
              : phase === "recording"
                ? "正在錄音… 念完按停止"
                : phase === "assessing"
                ? "AI 評分中…"
                : mode === "listen-first" && !listenPlayed
                  ? "準備播放參考發音…"
                  : "準備好了就按下方按鈕開始念"
        }}
      </p>
      <button
        type="button"
        class="flex h-20 w-20 items-center justify-center rounded-full text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
        :class="
          phase === 'preparing' || recorderPreparing
            ? 'bg-slate-600'
            : phase === 'recording' || recorderStopping
              ? 'bg-rose-600 hover:bg-rose-500'
              : 'bg-indigo-600 hover:bg-indigo-500'
        "
        :disabled="recordButtonDisabled"
        @click="handleRecordToggle"
      >
        {{ recordButtonLabel }}
      </button>
    </div>

    <div v-else-if="result" class="space-y-4">
      <ScoreResult
        :accuracy-score="result.accuracyScore"
        :fluency-score="result.fluencyScore"
        :completeness-score="result.completenessScore"
        :pronunciation-score="result.pronunciationScore"
        :words="result.words"
        :recording-url="recordingUrl"
        :recording-duration-ms="recordingDurationMs"
        :reference-duration-ms="referenceDurationMs"
        :tts-loading="ttsLoading"
        :word-tts-loading="wordTtsLoading"
        @play-reference="playReference"
        @play-word="playWord"
      />
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:border-slate-600"
          @click="handleRetry"
        >
          重錄
        </button>
        <button
          type="button"
          class="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          @click="handleNext"
        >
          {{ hasNext ? "下一題 →" : "完成" }}
        </button>
      </div>
    </div>
  </div>
</template>
