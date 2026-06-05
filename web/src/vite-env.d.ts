/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Safari iOS inline playback (not in standard DOM typings). */
interface HTMLAudioElement {
  playsInline?: boolean;
}

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

declare const __APP_BUILD_ID__: string;
