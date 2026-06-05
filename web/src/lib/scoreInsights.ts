import type { WordResult } from "@/types";

export interface WeakestSegment {
  word: string;
  segmentIndex: number;
  score: number;
}

export interface PaceInsight {
  recordingMs: number;
  referenceMs: number;
  label: string;
  detail: string;
}

function isLexicalWord(word: string): boolean {
  return /[\p{L}\p{N}]/u.test(word.trim());
}

export function findWeakestSegment(words: WordResult[]): WeakestSegment | null {
  let weakest: WeakestSegment | null = null;

  for (const word of words) {
    if (!isLexicalWord(word.word)) continue;
    for (let i = 0; i < word.phonemes.length; i++) {
      const score = word.phonemes[i]?.accuracyScore ?? 100;
      if (!weakest || score < weakest.score) {
        weakest = { word: word.word, segmentIndex: i, score };
      }
    }
  }

  return weakest;
}

export function findWeakestWord(words: WordResult[]): { word: string; score: number } | null {
  let weakest: { word: string; score: number } | null = null;
  for (const word of words) {
    if (!isLexicalWord(word.word)) continue;
    if (!weakest || word.accuracyScore < weakest.score) {
      weakest = { word: word.word, score: word.accuracyScore };
    }
  }
  return weakest;
}

export function buildWeakestInsight(words: WordResult[]): string | null {
  const segment = findWeakestSegment(words);
  const word = findWeakestWord(words);

  if (segment && segment.score < 80) {
    return `最需加強：「${segment.word}」第 ${segment.segmentIndex + 1} 段（${Math.round(segment.score)} 分）`;
  }
  if (word && word.score < 80) {
    return `最需加強：「${word.word}」（${Math.round(word.score)} 分）`;
  }
  return null;
}

export function buildPaceInsight(recordingMs?: number, referenceMs?: number): PaceInsight | null {
  if (!recordingMs || !referenceMs || recordingMs <= 0 || referenceMs <= 0) return null;

  const ratio = recordingMs / referenceMs;
  const recordingSec = (recordingMs / 1000).toFixed(1);
  const referenceSec = (referenceMs / 1000).toFixed(1);

  if (ratio > 1.2) {
    return {
      recordingMs,
      referenceMs,
      label: "略慢",
      detail: `你 ${recordingSec} 秒 · 參考 ${referenceSec} 秒 · 可試著緊湊一點`,
    };
  }
  if (ratio < 0.8) {
    return {
      recordingMs,
      referenceMs,
      label: "略快",
      detail: `你 ${recordingSec} 秒 · 參考 ${referenceSec} 秒 · 可試著放慢、咬字清楚`,
    };
  }
  return {
    recordingMs,
    referenceMs,
    label: "接近標準",
    detail: `你 ${recordingSec} 秒 · 參考 ${referenceSec} 秒`,
  };
}
