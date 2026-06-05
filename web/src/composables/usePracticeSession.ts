import { computed, ref } from "vue";
import { vocabRepository } from "@/repositories";
import type { PracticeMode, PracticeSetup, VocabItem } from "@/types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function usePracticeSession() {
  const active = ref(false);
  const queue = ref<VocabItem[]>([]);
  const index = ref(0);
  const setup = ref<PracticeSetup | null>(null);

  const current = computed(() => queue.value[index.value] ?? null);
  const total = computed(() => queue.value.length);
  const progress = computed(() => (total.value === 0 ? 0 : index.value + 1));
  const hasNext = computed(() => index.value < queue.value.length - 1);
  const isComplete = computed(() => active.value && index.value >= queue.value.length - 1 && total.value > 0);

  function buildQueue(config: PracticeSetup, wrongThreshold: number): VocabItem[] {
    let pool: VocabItem[];

    if (config.filter === "wrong") {
      pool = vocabRepository.listWrong(wrongThreshold);
    } else if (config.filter === "tags") {
      pool = vocabRepository.listByTags(config.tagIds);
    } else {
      pool = vocabRepository.list();
    }

    return shuffle(pool);
  }

  function start(config: PracticeSetup, wrongThreshold: number): boolean {
    const items = buildQueue(config, wrongThreshold);
    if (items.length === 0) return false;

    setup.value = config;
    queue.value = items;
    index.value = 0;
    active.value = true;
    return true;
  }

  function next(): boolean {
    if (!hasNext.value) return false;
    index.value += 1;
    return true;
  }

  function stop() {
    active.value = false;
    queue.value = [];
    index.value = 0;
    setup.value = null;
  }

  function recordScore(vocabId: string, score: number) {
    vocabRepository.recordPractice(vocabId, score);
  }

  return {
    active,
    setup,
    current,
    total,
    progress,
    hasNext,
    isComplete,
    start,
    next,
    stop,
    recordScore,
  };
}

export type { PracticeMode, PracticeSetup };
