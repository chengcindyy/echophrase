import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "api", "dist");

await mkdir(distDir, { recursive: true });

console.log("Installing Lambda runtime deps (linux x64) in api/dist…");
execSync("npm install --omit=dev --no-package-lock", {
  cwd: distDir,
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_platform: "linux",
    npm_config_arch: "x64",
    npm_config_libc: "glibc",
  },
});

console.log("API package ready for Lambda.");
