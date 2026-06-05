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
