import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "practice", component: () => import("@/views/PracticeView.vue") },
    { path: "/vocab", name: "vocab", component: () => import("@/views/VocabView.vue") },
    { path: "/tags", name: "tags", component: () => import("@/views/TagsView.vue") },
    { path: "/settings", name: "settings", component: () => import("@/views/SettingsView.vue") },
  ],
});

export default router;
