<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiEndpoint, healthCheck } from "@/api/client";
import { mountGoogleSignInButton } from "@/lib/googleAuth";
import { isIOS, playCachedUrl } from "@/lib/audioPlayback";
import { getTtsCache, isTtsCached, prefetchTts } from "@/lib/ttsCache";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { TTS_VOICES } from "@/types";

const TEST_TEXT = "bonjour";

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const isDev = import.meta.env.DEV;
const buildId = __APP_BUILD_ID__;
const apiStatus = ref<"idle" | "checking" | "ok" | "error">("idle");
const apiMessage = ref("");
const audioStatus = ref<"idle" | "checking" | "ok" | "error">("idle");
const audioMessage = ref("");
const ttsReady = ref(false);
const needsRetap = ref(false);
const googleButtonHost = ref<HTMLElement | null>(null);
const googleAuthError = ref<string | null>(null);

function ttsParams() {
  return {
    text: TEST_TEXT,
    voice: settingsStore.settings.ttsVoice,
    rate: settingsStore.settings.ttsRate,
  };
}

onMounted(() => {
  void prefetchTts(TEST_TEXT, settingsStore.settings.ttsVoice, settingsStore.settings.ttsRate)
    .then(() => {
      ttsReady.value = true;
    })
    .catch(() => {
      ttsReady.value = false;
    });

  if (googleButtonHost.value && !authStore.isAuthenticated) {
    void mountGoogleSignInButton(googleButtonHost.value).catch((error) => {
      googleAuthError.value = error instanceof Error ? error.message : "Google 登入載入失敗";
    });
  }
});

async function testAudio() {
  audioStatus.value = "checking";
  audioMessage.value = "";

  try {
    const { text, voice, rate } = ttsParams();

    if (!isTtsCached(text, voice, rate)) {
      await prefetchTts(text, voice, rate);
      ttsReady.value = true;
      if (isIOS()) {
        needsRetap.value = true;
        audioStatus.value = "idle";
        audioMessage.value = "已載入音訊，請再點一次「測試播放」";
        return;
      }
    }

    needsRetap.value = false;
    const cached = getTtsCache(text, voice, rate);
    if (!cached) throw new Error("音訊尚未載入");

    await playCachedUrl(cached.url);
    audioStatus.value = "ok";
    audioMessage.value = `播放成功（iOS=${isIOS()}，格式=${cached.contentType}）`;
  } catch (e) {
    audioStatus.value = "error";
    const detail = e instanceof Error ? e.message : "播放失敗";
    audioMessage.value = `${detail}（iOS=${isIOS()}，ready=${ttsReady.value}）`;
  }
}

async function testApi() {
  apiStatus.value = "checking";
  apiMessage.value = "";
  try {
    await healthCheck();
    apiStatus.value = "ok";
    apiMessage.value = "API 連線正常";
  } catch (e) {
    apiStatus.value = "error";
    const detail = e instanceof Error ? e.message : "連線失敗";
    apiMessage.value = `${detail}（${apiEndpoint("/api/health")}）`;
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="text-sm font-medium text-slate-300">Google 帳號同步</h2>
      <p class="text-xs text-slate-500">
        登入後，詞庫與標籤會存到雲端，手機與電腦可共享同一份資料。
      </p>

      <div v-if="authStore.syncing" class="text-sm text-amber-300">同步中…</div>

      <div v-else-if="authStore.isAuthenticated" class="space-y-3">
        <div class="flex items-center gap-3">
          <img
            v-if="authStore.user?.picture"
            :src="authStore.user.picture"
            alt=""
            class="h-10 w-10 rounded-full"
          />
          <div>
            <p class="text-sm text-white">{{ authStore.user?.name ?? "已登入" }}</p>
            <p class="text-xs text-slate-500">{{ authStore.user?.email }}</p>
          </div>
        </div>
        <button
          type="button"
          class="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-300"
          @click="authStore.signOut()"
        >
          登出
        </button>
      </div>

      <div v-else ref="googleButtonHost" class="flex justify-center py-1" />

      <p v-if="googleAuthError" class="text-sm text-rose-400">{{ googleAuthError }}</p>
      <p v-if="authStore.syncError" class="text-sm text-rose-400">{{ authStore.syncError }}</p>
    </section>

    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="text-sm font-medium text-slate-300">TTS 語音</h2>
      <select
        :value="settingsStore.settings.ttsVoice"
        class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        @change="
          settingsStore.update({
            ttsVoice: ($event.target as HTMLSelectElement).value,
          })
        "
      >
        <option v-for="voice in TTS_VOICES" :key="voice.id" :value="voice.id">
          {{ voice.label }}
        </option>
      </select>
    </section>

    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-slate-300">TTS 語速</h2>
        <span class="text-sm tabular-nums text-slate-400">
          {{ settingsStore.settings.ttsRate.toFixed(1) }}×
        </span>
      </div>
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.1"
        :value="settingsStore.settings.ttsRate"
        class="w-full accent-indigo-500"
        @input="
          settingsStore.update({
            ttsRate: Number(($event.target as HTMLInputElement).value),
          })
        "
      />
    </section>

    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-slate-300">錯題閾值</h2>
        <span class="text-sm tabular-nums text-slate-400">
          {{ settingsStore.settings.wrongThreshold }} 分
        </span>
      </div>
      <input
        type="range"
        min="50"
        max="90"
        step="5"
        :value="settingsStore.settings.wrongThreshold"
        class="w-full accent-indigo-500"
        @input="
          settingsStore.update({
            wrongThreshold: Number(($event.target as HTMLInputElement).value),
          })
        "
      />
      <p class="text-xs text-slate-500">低於此分數的項目會出現在「錯題」練習中</p>
    </section>

    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="text-sm font-medium text-slate-300">音訊播放（手機除錯）</h2>
      <button
        type="button"
        class="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:border-indigo-500"
        :disabled="audioStatus === 'checking'"
        @click="testAudio"
      >
        {{
          audioStatus === "checking"
            ? "測試中…"
            : needsRetap
              ? "再點一次測試播放"
              : ttsReady
                ? "測試 TTS 播放（bonjour）"
                : "載入音訊中…"
        }}
      </button>
      <p
        v-if="audioMessage"
        class="text-sm"
        :class="audioStatus === 'ok' ? 'text-emerald-400' : audioStatus === 'error' ? 'text-rose-400' : 'text-amber-300'"
      >
        {{ audioMessage }}
      </p>
      <p class="text-xs text-slate-500">
        iPhone 需先載入音訊，再點一次播放（Safari 限制）。進練習頁會自動預載。
      </p>
    </section>

    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="text-sm font-medium text-slate-300">API 連線</h2>
      <button
        type="button"
        class="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:border-indigo-500"
        :disabled="apiStatus === 'checking'"
        @click="testApi"
      >
        {{ apiStatus === "checking" ? "測試中…" : "測試 API 連線" }}
      </button>
      <p
        v-if="apiMessage"
        class="text-sm"
        :class="apiStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'"
      >
        {{ apiMessage }}
      </p>
      <p v-if="isDev" class="text-xs text-slate-500">
        本地開發請先啟動 API（<code class="text-slate-400">pnpm --filter @echophrase/api dev</code>）
      </p>
      <p v-else class="text-xs text-slate-500">
        線上版 API 已部署，無需在本機啟動服務。
      </p>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
      <p>EchoPhrase v0.1.0</p>
      <p class="mt-1">Build: {{ buildId }}</p>
      <p class="mt-1">錄音僅用於發音評分，比對完成後不會保留。</p>
    </section>
  </div>
</template>
