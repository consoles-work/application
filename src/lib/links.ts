import { openExternal } from "./appInfo";

// ══════════════════════════════════════
// Кликабельные ссылки: терминал, wiki, AI-чат, заметка консоли
// ══════════════════════════════════════
// Открываем только http(s) и mailto — file://, javascript: и прочие схемы
// из вывода удалённого сервера или вставленного текста не трогаем.

// Только ссылки со схемой: «main.rs» или «config.py» ссылками не считаем
const URL_RE = /\b(?:https?:\/\/|mailto:)[^\s<>"'`«»]+/gi;
const CLOSING: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Модификатор для открытия ссылки в терминале: Cmd на macOS, Ctrl на остальных */
export const OPEN_LINK_KEY = IS_MAC ? "Cmd" : "Ctrl";

export function isOpenLinkClick(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey;
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);

    if (u.protocol === "mailto:") return u.pathname.length > 0;

    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

/** Открыть ссылку в системном браузере; небезопасные схемы молча игнорируются */
export function openLink(url: string | null | undefined): boolean {
  if (!url || !isSafeExternalUrl(url)) return false;

  openExternal(url);

  return true;
}

export interface FoundLink {
  start: number;
  end: number;
  url: string;
}

export function findLinks(text: string): FoundLink[] {
  return [...text.matchAll(URL_RE)].flatMap((m) => {
    const url = trimUrl(m[0]);

    const start = m.index ?? 0;

    return isSafeExternalUrl(url) ? [{ start, end: start + url.length, url }] : [];
  });
}

/** Разбить текст на куски: обычный текст и ссылки (`url` задан) */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];

  let pos = 0;

  for (const { start, end, url } of findLinks(text)) {
    if (start > pos) parts.push({ text: text.slice(pos, start) });

    parts.push({ text: text.slice(start, end), url });

    pos = end;
  }

  if (pos < text.length) parts.push({ text: text.slice(pos) });

  return parts;
}

// ── Детали ──

/** Срезать хвост, который почти всегда не часть ссылки: пунктуацию, `**` из Markdown,
 *  непарную скобку — «(см. https://x.ru)», «[текст](https://x.ru)». */
function trimUrl(raw: string): string {
  let url = raw;

  while (endsWithJunk(url)) url = url.slice(0, -1);

  return url;
}

function endsWithJunk(url: string): boolean {
  const last = url.slice(-1);

  if (/[.,;:!?*]/.test(last)) return true;

  const open = CLOSING[last];

  return !!open && count(url, last) > count(url, open);
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}
