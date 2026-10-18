import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Версия приложения — единственный источник package.json (tauri.conf.json
// ссылается на него же). Коммит — чтобы различать сборки внутри одной версии.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  // сборка не из git-репозитория — коммит не показываем
}

export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },

  // Tauri expects a fixed port in dev mode
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce output compatible with Tauri
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Десктопное приложение: бандл читается с диска, а не качается по сети,
    // поэтому один чанк ~1.3 МБ (xterm + TipTap + React) — норма, не повод дробить
    chunkSizeWarningLimit: 2000,
  },

  // Clear console on HMR to reduce noise
  clearScreen: false,

  // Environment variables prefixed with TAURI_ are available in the frontend
  envPrefix: ["VITE_", "TAURI_"],
});
