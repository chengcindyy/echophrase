import { onMounted } from "vue";
import { healthCheck } from "@/api/client";

export function useApiWarmup() {
  onMounted(() => {
    void healthCheck().catch(() => {
      // Warmup is best-effort; offline dev without API is fine.
    });
  });
}
