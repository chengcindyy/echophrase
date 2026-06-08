const PLAY_TIMEOUT_MS = 15_000;

let sharedAudio: HTMLAudioElement | null = null;

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = document.getElementById("echophrase-audio") as HTMLAudioElement | null;
    if (!sharedAudio) {
      sharedAudio = document.createElement("audio");
      sharedAudio.id = "echophrase-audio";
      sharedAudio.style.display = "none";
      document.body.appendChild(sharedAudio);
    }
    sharedAudio.setAttribute("playsinline", "");
    sharedAudio.setAttribute("webkit-playsinline", "true");
    sharedAudio.playsInline = true;
  }
  return sharedAudio;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(message));
      },
    );
  });
}

/** Sync marker in tap handler — no await, no play() (iOS play() can hang). */
export function unlockIOSAudio(): void {
  // Intentionally empty; iOS plays from prefetched blob URL on the same tap.
}

export function getAudioDebugInfo(): { ios: boolean; cached: boolean } {
  return { ios: isIOS(), cached: false };
}

export function installGlobalAudioUnlock(): void {
  // Disabled.
}

/** Pause shared playback so iOS can switch the audio session to the microphone. */
export function releaseAudioPlaybackForRecording(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  const audio =
    sharedAudio ?? (document.getElementById("echophrase-audio") as HTMLAudioElement | null);
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute("src");
  audio.load();
}

/** Play a ready blob/object URL. No network I/O — safe for iOS after prefetch. */
export function playCachedUrl(url: string): Promise<void> {
  const audio = getSharedAudio();

  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error("播放失敗"));
      };
      audio.pause();
      audio.currentTime = 0;
      audio.src = url;
      audio.load();
      void audio.play().catch((err: unknown) => {
        cleanup();
        reject(err instanceof Error ? err : new Error("播放被拒絕"));
      });
    }),
    PLAY_TIMEOUT_MS,
    "播放逾時",
  );
}

export function speakWithSystemVoice(text: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export async function playObjectUrl(url: string): Promise<void> {
  await playCachedUrl(url);
}

export async function playBase64Audio(audioBase64: string, contentType: string): Promise<void> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType || "audio/wav" });
  const url = URL.createObjectURL(blob);
  try {
    await playCachedUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
