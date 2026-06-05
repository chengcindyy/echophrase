import { onUnmounted, ref } from "vue";

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

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = isIOS() ? IOS_RECORDER_MIME_CANDIDATES : RECORDER_MIME_CANDIDATES;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useRecorder() {
  const recording = ref(false);
  const error = ref<string | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stream: MediaStream | null = null;

  async function start(): Promise<void> {
    error.value = null;
    chunks = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("此瀏覽器不支援麥克風錄音");
    }

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecorderMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    // Periodic chunks improve stop() reliability across browsers (Edge, mobile).
    mediaRecorder.start(250);
    recording.value = true;
  }

  function stop(): Promise<{ blob: Blob; contentType: string }> {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        reject(new Error("尚未開始錄音"));
        return;
      }

      const recorder = mediaRecorder;

      recorder.onstop = () => {
        recording.value = false;
        const contentType = recorder.mimeType || pickRecorderMimeType() || "audio/mp4";
        const blob = new Blob(chunks, { type: contentType });
        cleanup();
        if (blob.size === 0) {
          error.value = "錄音為空，請再試一次";
          reject(new Error("錄音為空"));
          return;
        }
        resolve({ blob, contentType });
      };

      recorder.onerror = () => {
        recording.value = false;
        cleanup();
        error.value = "錄音失敗";
        reject(new Error("錄音失敗"));
      };

      if (recorder.state === "recording") {
        recorder.requestData();
      }
      recorder.stop();
    });
  }

  function cleanup() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    mediaRecorder = null;
    chunks = [];
  }

  onUnmounted(() => {
    if (recording.value && mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    cleanup();
  });

  return { recording, error, start, stop };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export { blobToBase64 };
