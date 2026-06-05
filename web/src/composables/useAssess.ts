import { ref } from "vue";
import { assessPronunciation } from "@/api/client";
import { blobToBase64 } from "@/composables/useRecorder";
import type { AssessResult } from "@/types";

export function useAssess() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<AssessResult | null>(null);

  async function assess(text: string, blob: Blob, contentType: string): Promise<AssessResult> {
    loading.value = true;
    error.value = null;
    result.value = null;
    try {
      const audioBase64 = await blobToBase64(blob);
      const response = await assessPronunciation({ text, audioBase64, contentType });
      result.value = response;
      return response;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "評分失敗";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    result.value = null;
    error.value = null;
  }

  return { loading, error, result, assess, reset };
}
