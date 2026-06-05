export type VocabType = "word" | "sentence";
export type PracticeMode = "direct" | "listen-first";
export type PracticeFilter = "all" | "tags" | "wrong";

export interface Tag {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface VocabItem {
  id: string;
  type: VocabType;
  text: string;
  ipa?: string;
  translation?: string;
  notes?: string;
  tagIds: string[];
  lastScore?: number;
  lastPracticedAt?: number;
  practiceCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface VocabInput {
  type: VocabType;
  text: string;
  ipa?: string;
  translation?: string;
  notes?: string;
  tagIds: string[];
}

export interface PhonemeResult {
  accuracyScore: number;
  durationMs?: number;
  offsetMs?: number;
}

export interface WordResult {
  word: string;
  accuracyScore: number;
  errorType?: string;
  offsetMs?: number;
  durationMs?: number;
  phonemes: PhonemeResult[];
}

export interface AssessResult {
  accuracyScore: number;
  fluencyScore?: number;
  completenessScore?: number;
  pronunciationScore?: number;
  words: WordResult[];
}

export interface PracticeSetup {
  filter: PracticeFilter;
  tagIds: string[];
  mode: PracticeMode;
}

export interface AppSettings {
  ttsVoice: string;
  ttsRate: number;
  wrongThreshold: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ttsVoice: "fr-FR-DeniseNeural",
  ttsRate: 1,
  wrongThreshold: 70,
};

export const TAG_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#3b82f6",
];

export const TTS_VOICES = [
  { id: "fr-FR-DeniseNeural", label: "Denise（女聲）" },
  { id: "fr-FR-HenriNeural", label: "Henri（男聲）" },
  { id: "fr-FR-EloiseNeural", label: "Eloise（女聲）" },
  { id: "fr-FR-RemyMultilingualNeural", label: "Remy（男聲）" },
];
