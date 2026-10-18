import { open as shellOpen } from "@tauri-apps/plugin-shell";

// ══════════════════════════════════════
// Сведения о приложении: версия и внешние ссылки
// ══════════════════════════════════════
// Версия берётся из package.json при сборке (vite.config.ts), поднимается
// скриптом `npm run version:bump` — см. docs/RULES.md, раздел «Версии».

export const APP_NAME = "Consoles.work";
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;

export const SITE_URL = "https://consoles.work";
export const GITHUB_URL = "https://github.com/consoles-work/application";

/** «https://consoles.work» → «consoles.work» — для подписи ссылки */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Открыть ссылку в системном браузере (в `npm run dev` без Tauri — новой вкладкой) */
export function openExternal(url: string): void {
  shellOpen(url).catch(() => window.open(url, "_blank", "noopener"));
}
