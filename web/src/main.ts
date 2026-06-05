import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { installGlobalAudioUnlock } from "./lib/audioPlayback";
import { seedDemoData } from "./repositories/seedDemoData";
import "./styles/main.css";

installGlobalAudioUnlock();
seedDemoData();

createApp(App).use(createPinia()).use(router).mount("#app");
