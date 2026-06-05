import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, ".."), "");
  const apiTarget = env.VITE_API_BASE_URL || "http://localhost:3001";

  return {
    envDir: path.resolve(import.meta.dirname, ".."),
    plugins: [
      vue(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "EchoPhrase",
          short_name: "EchoPhrase",
          description: "French pronunciation practice",
          theme_color: "#1e3a5f",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait",
          lang: "zh-Hant",
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          cacheId: "echophrase-mobile-audio-v7-prefetch",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: "NetworkOnly",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    define: {
      __APP_BUILD_ID__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
