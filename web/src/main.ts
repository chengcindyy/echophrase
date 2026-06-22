import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { installGlobalAudioUnlock } from "./lib/audioPlayback";
import { seedDemoData } from "./repositories/seedDemoData";
import { useAuthStore } from "./stores/authStore";
import "./styles/main.css";

installGlobalAudioUnlock();

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router);

async function bootstrap() {
  const authStore = useAuthStore(pinia);
  await authStore.restoreSession();
  if (!authStore.isAuthenticated) {
    seedDemoData();
  }
  app.mount("#app");
}

void bootstrap();
