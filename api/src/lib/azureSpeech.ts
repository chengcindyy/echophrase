import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type { AssessResult, PhonemeResult, WordResult } from "./assess.js";

export type { AssessResult, PhonemeResult, WordResult };

/** Azure Speech SDK timestamps are in 100-nanosecond units. */
function ticksToMs(ticks?: number): number | undefined {
  if (ticks === undefined || ticks <= 0) return undefined;
  return ticks / 10_000;
}

interface AzureAssessmentJson {
  AccuracyScore?: number;
  ErrorType?: string;
}

interface AzurePhonemeJson {
  Phoneme?: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: AzureAssessmentJson;
}

interface AzureWordJson {
  Word: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: AzureAssessmentJson;
  Phonemes?: AzurePhonemeJson[];
  Syllables?: Array<{
    Syllable?: string;
    Offset?: number;
    Duration?: number;
    Phonemes?: AzurePhonemeJson[];
  }>;
}

function mapPhoneme(p: AzurePhonemeJson): PhonemeResult {
  return {
    accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 0,
    offsetMs: ticksToMs(p.Offset),
    durationMs: ticksToMs(p.Duration),
  };
}

function extractPhonemes(word: AzureWordJson): PhonemeResult[] {
  if (word.Phonemes?.length) {
    return word.Phonemes.map(mapPhoneme);
  }

  const fromSyllables: PhonemeResult[] = [];
  for (const syllable of word.Syllables ?? []) {
    for (const p of syllable.Phonemes ?? []) {
      fromSyllables.push(mapPhoneme(p));
    }
  }
  return fromSyllables;
}

function mapWord(word: AzureWordJson): WordResult {
  return {
    word: word.Word,
    accuracyScore: word.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType: word.PronunciationAssessment?.ErrorType,
    offsetMs: ticksToMs(word.Offset),
    durationMs: ticksToMs(word.Duration),
    phonemes: extractPhonemes(word),
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static is not available"));
      return;
    }
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

function inputExtension(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("webm")) return "webm";
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("mpeg")) return "mp4";
  if (ct.includes("ogg")) return "ogg";
  if (ct.includes("wav")) return "wav";
  return "bin";
}

async function convertToWavPcm16(input: Buffer, contentType: string): Promise<Buffer> {
  if (contentType.toLowerCase().includes("wav")) return input;
  if (input.length === 0) {
    throw new Error("錄音為空，請再試一次");
  }

  const id = randomUUID();
  const ext = inputExtension(contentType);
  const inputFile = join(tmpdir(), `echophrase-${id}-in.${ext}`);
  const outputPath = join(tmpdir(), `echophrase-${id}-out.wav`);

  try {
    await writeFile(inputFile, input);
    await runFfmpeg([
      "-y",
      "-i",
      inputFile,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);
    return readFile(outputPath);
  } catch {
    throw new Error("錄音格式無法處理，請再試一次");
  } finally {
    await unlink(inputFile).catch(() => undefined);
    await unlink(outputPath).catch(() => undefined);
  }
}

export async function synthesizeSpeech(params: {
  key: string;
  region: string;
  text: string;
  voice: string;
  rate: number;
}): Promise<{ audioBase64: string; contentType: string }> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(params.key, params.region);
  speechConfig.speechSynthesisVoiceName = params.voice;
  // WAV plays reliably on iOS Safari; MP3 data/blob URLs often stall silently.
  speechConfig.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;

  const ratePercent = Math.round((params.rate - 1) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const ssml = `<speak version="1.0" xml:lang="fr-FR"><voice name="${params.voice}"><prosody rate="${rateStr}">${escapeXml(params.text)}</prosody></voice></speak>`;

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve({
            audioBase64: Buffer.from(result.audioData).toString("base64"),
            contentType: "audio/wav",
          });
          return;
        }
        reject(new Error(result.errorDetails || "TTS synthesis failed"));
      },
      (error) => {
        synthesizer.close();
        reject(error);
      },
    );
  });
}

export async function assessPronunciation(params: {
  key: string;
  region: string;
  text: string;
  audio: Buffer;
  contentType: string;
}): Promise<AssessResult> {
  const wavBuffer = await convertToWavPcm16(params.audio, params.contentType);

  const speechConfig = sdk.SpeechConfig.fromSubscription(params.key, params.region);
  speechConfig.speechRecognitionLanguage = "fr-FR";

  const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
    params.text,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true,
  );
  pronunciationConfig.enableProsodyAssessment = true;
  pronunciationConfig.applyTo(recognizer);

  return new Promise((resolve, reject) => {
    recognizer.recognizeOnceAsync(
      (result) => {
        recognizer.close();
        if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
          reject(new Error(result.errorDetails || "Speech not recognized"));
          return;
        }

        const detail = sdk.PronunciationAssessmentResult.fromResult(result);
        const json = JSON.parse(result.properties.getProperty(
          sdk.PropertyId.SpeechServiceResponse_JsonResult,
        )) as {
          NBest?: Array<{
            Words?: AzureWordJson[];
          }>;
        };

        const words: WordResult[] = json.NBest?.[0]?.Words?.map(mapWord) ?? [];

        resolve({
          accuracyScore: detail.accuracyScore,
          fluencyScore: detail.fluencyScore,
          completenessScore: detail.completenessScore,
          pronunciationScore: detail.pronunciationScore,
          words,
        });
      },
      (error) => {
        recognizer.close();
        reject(error);
      },
    );
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
