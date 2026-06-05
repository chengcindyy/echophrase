<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useApiWarmup } from "@/composables/useApiWarmup";

useApiWarmup();

const route = useRoute();

const tabs = [
  { to: "/", label: "練習", name: "practice" },
  { to: "/vocab", label: "詞庫", name: "vocab" },
  { to: "/tags", label: "標籤", name: "tags" },
  { to: "/settings", label: "設定", name: "settings" },
];

const activeTab = computed(() => route.name);
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-lg flex-col bg-slate-950">
    <header
      class="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur"
    >
      <h1 class="text-lg font-semibold tracking-tight text-white">EchoPhrase</h1>
      <p class="text-xs text-slate-400">法語發音練習</p>
    </header>

    <main class="flex-1 overflow-y-auto px-4 py-4 pb-24">
      <RouterView />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <div class="mx-auto grid max-w-lg grid-cols-4">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          class="flex flex-col items-center gap-0.5 py-2 text-xs transition-colors"
          :class="
            activeTab === tab.name
              ? 'text-indigo-400'
              : 'text-slate-500 hover:text-slate-300'
          "
        >
          <span
            class="h-1 w-8 rounded-full transition-colors"
            :class="activeTab === tab.name ? 'bg-indigo-500' : 'bg-transparent'"
          />
          {{ tab.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
