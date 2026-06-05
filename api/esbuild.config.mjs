import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const handlers = ["health", "tts", "assess"];

await mkdir(new URL("./dist/handlers/", import.meta.url), { recursive: true });

for (const name of handlers) {
  await esbuild.build({
    entryPoints: [`src/handlers/${name}.ts`],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outfile: `dist/handlers/${name}.js`,
    external: ["ffmpeg-static"],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });
}

await writeFile(
  new URL("./dist/package.json", import.meta.url),
  `${JSON.stringify(
    {
      type: "module",
      dependencies: {
        "ffmpeg-static": "^5.2.0",
        "microsoft-cognitiveservices-speech-sdk": "^1.45.0",
      },
    },
    null,
    2,
  )}\n`,
);

console.log("API handlers built.");
