import { onUnmounted, ref } from "vue";
import { isIOS, releaseAudioPlaybackForRecording } from "@/lib/audioPlayback";

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const IOS_RECORDER_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const IOS_MIC_RELEASE_DELAY_MS = 150;
const IOS_TIMESLICE_MS = 250;
const IOS_STOP_DATA_DELAY_MS = 100;

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = isIOS() ? IOS_RECORDER_MIME_CANDIDATES : RECORDER_MIME_CANDIDATES;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function stopChunkQuietMs(): number {
  return isIOS() ? 650 : 300;
}

function stopMaxWaitMs(): number {
  return isIOS() ? 8_000 : 5_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useRecorder() {
  const recording = ref(false);
  const preparing = ref(false);
  const stopping = ref(false);
  const error = ref<string | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let startInFlight = false;
  let awaitingStopChunks = false;
  let stopQuietTimer: ReturnType<typeof setTimeout> | undefined;
  let stopDeadlineTimer: ReturnType<typeof setTimeout> | undefined;

  function clearStopTimers() {
    if (stopQuietTimer !== undefined) {
      clearTimeout(stopQuietTimer);
      stopQuietTimer = undefined;
    }
    if (stopDeadlineTimer !== undefined) {
      clearTimeout(stopDeadlineTimer);
      stopDeadlineTimer = undefined;
    }
  }

  function cleanup() {
    clearStopTimers();
    awaitingStopChunks = false;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.onended = null;
        track.stop();
      }
      stream = null;
    }
    mediaRecorder = null;
    chunks = [];
  }

  function attachTrackEndedHandlers() {
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.onended = () => {
        if (!recording.value || stopping.value) return;
        error.value = "麥克風已中斷，請再試一次";
        void stop().catch(() => {
          recording.value = false;
          cleanup();
        });
      };
    }
  }

  function pushChunk(event: BlobEvent) {
    if (event.data.size > 0) chunks.push(event.data);
  }

  function buildResult(recorder: MediaRecorder): { blob: Blob; contentType: string } {
    const contentType = recorder.mimeType || pickRecorderMimeType() || "audio/mp4";
    const blob = new Blob(chunks, { type: contentType });
    return { blob, contentType };
  }

  function startRecorder(recorder: MediaRecorder) {
    // iOS Safari needs timeslice or stop() often yields an empty blob.
    if (isIOS()) {
      recorder.start(IOS_TIMESLICE_MS);
      return;
    }
    recorder.start();
  }

  async function start(): Promise<void> {
    if (startInFlight || recording.value || stopping.value) {
      throw new Error("已在準備或錄音中");
    }

    startInFlight = true;
    preparing.value = true;
    error.value = null;

    try {
      cleanup();
      releaseAudioPlaybackForRecording();

      if (isIOS()) {
        await delay(IOS_MIC_RELEASE_DELAY_MS);
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("此瀏覽器不支援麥克風錄音");
      }

      chunks = [];
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      attachTrackEndedHandlers();

      const mimeType = pickRecorderMimeType();
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = pushChunk;
      startRecorder(mediaRecorder);
      recording.value = true;
    } catch (e) {
      cleanup();
      recording.value = false;
      throw e;
    } finally {
      preparing.value = false;
      startInFlight = false;
    }
  }

  async function stop(): Promise<{ blob: Blob; contentType: string }> {
    if (stopping.value) {
      throw new Error("正在停止錄音");
    }

    const recorder = mediaRecorder;
    if (!recorder) {
      throw new Error("尚未開始錄音");
    }

    stopping.value = true;

    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        stopping.value = false;
        awaitingStopChunks = false;
        clearStopTimers();
        action();
      };

      const finalize = (force = false) => {
        const { blob, contentType } = buildResult(recorder);

        if (blob.size === 0 && !force) {
          scheduleFinalize();
          return;
        }

        recording.value = false;
        cleanup();

        if (blob.size === 0) {
          error.value = "錄音為空，請再試一次";
          settle(() => reject(new Error("錄音為空")));
          return;
        }

        settle(() => resolve({ blob, contentType }));
      };

      const scheduleFinalize = () => {
        if (settled || !awaitingStopChunks) return;
        if (stopQuietTimer !== undefined) clearTimeout(stopQuietTimer);
        stopQuietTimer = setTimeout(() => finalize(false), stopChunkQuietMs());
      };

      const beginStopFlush = () => {
        awaitingStopChunks = true;
        scheduleFinalize();
        stopDeadlineTimer = window.setTimeout(() => finalize(true), stopMaxWaitMs());
      };

      recorder.onerror = () => {
        recording.value = false;
        cleanup();
        error.value = "錄音失敗";
        settle(() => reject(new Error("錄音失敗")));
      };

      recorder.ondataavailable = (event) => {
        pushChunk(event);
        if (awaitingStopChunks) scheduleFinalize();
      };

      if (recorder.state === "inactive") {
        if (chunks.length === 0) {
          stopping.value = false;
          reject(new Error("尚未開始錄音"));
          return;
        }
        beginStopFlush();
        return;
      }

      recorder.onstop = () => {
        scheduleFinalize();
      };

      void (async () => {
        try {
          beginStopFlush();
          if (recorder.state === "recording") {
            recorder.requestData();
            if (isIOS()) {
              await delay(IOS_STOP_DATA_DELAY_MS);
            }
          }
          if (recorder.state === "recording") {
            recorder.stop();
          } else if (recorder.state !== "inactive") {
            recorder.stop();
          }
        } catch (e) {
          recording.value = false;
          cleanup();
          settle(() => reject(e instanceof Error ? e : new Error("停止錄音失敗")));
        }
      })();
    });
  }

  onUnmounted(() => {
    if (recording.value && mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        // Ignore teardown errors.
      }
    }
    cleanup();
  });

  return { recording, preparing, stopping, error, start, stop };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export { blobToBase64 };
