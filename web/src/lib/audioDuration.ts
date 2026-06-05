export function getBlobDurationMs(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const finish = (ms: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };

    audio.addEventListener("loadedmetadata", () => {
      const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 : undefined;
      finish(ms);
    });
    audio.addEventListener("error", () => finish(undefined));
  });
}

export function getBase64AudioDurationMs(
  audioBase64: string,
  contentType: string,
): Promise<number | undefined> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  return getBlobDurationMs(blob);
}

export function formatDurationSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`;
}
