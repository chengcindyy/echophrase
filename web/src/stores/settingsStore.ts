import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types";

const STORAGE_KEY = "echophrase:settings:v1";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<AppSettings>(loadSettings());

  watch(
    settings,
    (value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    },
    { deep: true },
  );

  function update(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch };
  }

  return { settings, update };
});
