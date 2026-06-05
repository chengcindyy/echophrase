import { ref } from "vue";
import { isIOS, playCachedUrl, speakWithSystemVoice } from "@/lib/audioPlayback";
import { getTtsCache, isTtsCached, prefetchTts } from "@/lib/ttsCache";
import { useSettingsStore } from "@/stores/settingsStore";

export function useTTS() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const needsRetap = ref(false);

  async function speak(text: string): Promise<void> {
    const settings = useSettingsStore().settings;
    const { ttsVoice, ttsRate } = settings;

    error.value = null;
    loading.value = true;

    try {
      let cached = getTtsCache(text, ttsVoice, ttsRate);

      // iOS: never fetch then play on the same tap — prefetch first, play on tap.
      if (!cached) {
        cached = await prefetchTts(text, ttsVoice, ttsRate);
        if (isIOS()) {
          needsRetap.value = true;
          error.value = "已載入，請再點一次 🔊 播放";
          return;
        }
      }

      needsRetap.value = false;
      await playCachedUrl(cached.url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "TTS 失敗";
      if (isIOS()) {
        speakWithSystemVoice(text);
        error.value = `Azure 播放失敗，已改用系統語音：${message}`;
      } else {
        error.value = message.includes("播放") ? message : `TTS 失敗：${message}`;
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function warm(text: string): void {
    const settings = useSettingsStore().settings;
    if (isTtsCached(text, settings.ttsVoice, settings.ttsRate)) return;
    void prefetchTts(text, settings.ttsVoice, settings.ttsRate).catch(() => {
      // Warm prefetch is best-effort.
    });
  }

  return { loading, error, needsRetap, speak, warm };
}
