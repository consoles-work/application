import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

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
