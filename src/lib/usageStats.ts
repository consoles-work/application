import { useAppStore } from "../stores/appStore";
import { recordUsageStats, type UsageStat } from "./tauriCommands";
import { findConsole } from "./tree";

// ══════════════════════════════════════
// Сбор статистики использования
// ══════════════════════════════════════
// Приращения копятся в памяти по ключу (день, час, консоль, метрика) и раз в
// FLUSH_MS уходят в БД одним пакетом — терминал не дёргает IPC на каждую клавишу.
// День и час — локальные, на момент события: работа через полночь делится честно.
// Выключено в настройках (stats.enabled = "false") или экран заблокирован — не считаем.
//
// Время (раз в TICK_MS):
//  1. Разрыв с прошлого тика больше MAX_TICK_GAP_MS (сон, окно в трее) или
//     окно не видно — не засчитываем.
//  2. Окно видно — «приложение открыто».
//  3. Окно в фокусе и ввод был не дальше IDLE_MS назад — «активная работа» и
//     время активной вкладки консоли.
// Сброс в БД: в БД — целые; дробные остатки секунд копятся к следующему сбросу.
// Не записалось — пакет возвращается в очередь до следующей попытки.

export const METRICS = {
  appOpen: "app_open_sec",        // окно видно (не в трее), секунды
  active: "active_sec",           // окно в фокусе и пользователь не простаивает
  consoleTime: "console_sec",     // активное время, пока открыта вкладка консоли
  typed: "typed_chars",           // набрано в терминале руками (печатные символы)
  pasted: "pasted_chars",         // вставлено в терминал
  enters: "enter_keys",           // Enter в терминале ≈ введённые вручную команды
  output: "output_chars",         // вывод терминала
  sessions: "sessions_opened",    // открытые сессии (включая переподключения)
  qcRuns: "qc_runs",              // запуски быстрых команд
  qcChars: "qc_saved_chars",      // «не набранные» символы быстрых команд
  aiMessages: "ai_messages",      // отправленные AI-сообщения
  wikiEdits: "wiki_edits",        // сохранения wiki (одна правка ≈ серия изменений)
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

const FLUSH_MS = 30_000;
const TICK_MS = 5_000;
// Без ввода дольше этого — не «активная работа» (читать вывод минуту-другую — нормально)
const IDLE_MS = 5 * 60_000;
// Таймер мог не тикать (сон, окно в трее) — такой разрыв не засчитываем
const MAX_TICK_GAP_MS = 30_000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel"] as const;

let enabled = false;
let paused = false;
let pending = new Map<string, UsageStat>();
let lastActivity = Date.now();

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Приращение метрики. consoleId = "" — уровень приложения. */
export function trackUsage(metric: MetricName, value: number, consoleId = "") {
  // NaN и бесконечность (сбитые часы) не считаем
  if (!enabled || paused || !Number.isFinite(value) || value <= 0) return;

  const now = new Date();

  const row = { day: localDay(now), hour: now.getHours(), consoleId, metric };

  const cur = pending.get(rowKey(row));

  // Вывод терминала приходит часто — проект консоли ищем, только когда строки ещё нет
  if (cur) cur.value += value;
  else addPending({ ...row, projectId: projectOf(consoleId), value });
}

/** Ввод пользователя в терминал (то, что xterm отдаёт в onData) */
export function trackTerminalInput(consoleId: string, data: string) {
  if (!enabled || paused) return;

  const counted = classifyInput(data);

  if (counted) trackUsage(counted.metric, counted.value, consoleId);
}

/** Сбросить накопленное в БД */
export async function flushUsage(): Promise<void> {
  if (pending.size === 0) return;

  const batch = [...pending.values()];

  pending = new Map();

  const rows = batch.filter((row) => Math.floor(row.value) > 0).map((row) => ({ ...row, value: Math.floor(row.value) }));

  // Дробные остатки — обратно в очередь
  batch.filter((row) => row.value % 1 > 0).forEach((row) => addPending({ ...row, value: row.value % 1 }));

  if (rows.length === 0) return;

  try {
    await recordUsageStats(rows);
  } catch (e) {
    console.warn("recordUsageStats failed", e);

    rows.forEach(addPending);
  }
}

export function setUsageEnabled(value: boolean) {
  enabled = value;

  if (!value) pending.clear();
}

/** Пауза на время экрана блокировки */
export function setUsagePaused(value: boolean) {
  paused = value;
  lastActivity = Date.now();
}

/** Запустить учёт времени; возвращает функцию остановки */
export function startUsageTracking(): () => void {
  let lastTick = Date.now();

  const bump = (e: Event) => {
    // Движение мыши над неактивным окном — не активность
    if (e.type === "mousemove" && !document.hasFocus()) return;

    lastActivity = Date.now();
  };

  const tick = () => {
    const now = Date.now();
    const gap = now - lastTick;

    lastTick = now;

    // 1. Разрыв или окно не видно.
    if (gap <= 0 || gap > MAX_TICK_GAP_MS || document.visibilityState !== "visible") return;

    // 2. Приложение открыто.
    const sec = gap / 1000;

    trackUsage(METRICS.appOpen, sec);

    // 3. Активная работа и вкладка консоли.
    if (!document.hasFocus() || now - lastActivity > IDLE_MS) return;

    trackUsage(METRICS.active, sec);

    const { sessions, activeSessionId } = useAppStore.getState();

    const consoleId = sessions.find((s) => s.id === activeSessionId)?.console_id;

    if (consoleId) trackUsage(METRICS.consoleTime, sec, consoleId);
  };

  // Окно ушло — накопленное в БД; вернулось — разрыв не засчитываем
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushUsage();

    lastTick = Date.now();
  };

  const opts = { capture: true, passive: true };

  ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, bump, opts));
  document.addEventListener("visibilitychange", onVisibility);

  const tickTimer = window.setInterval(tick, TICK_MS);
  const flushTimer = window.setInterval(flushUsage, FLUSH_MS);

  return () => {
    ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, bump, opts));
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(tickTimer);
    window.clearInterval(flushTimer);

    tick();
    flushUsage();
  };
}

// ── Детали ──

/**
 * Что считать во вводе: вставка (bracketed paste или несколько символов разом —
 * одна клавиша даёт один) — её длина; управляющие последовательности (стрелки,
 * F-клавиши) — ничего; Enter — команда; печатный символ — набранный.
 */
function classifyInput(data: string): { metric: MetricName; value: number } | null {
  const isEscape = data.startsWith("\x1b");

  if (data.startsWith("\x1b[200~") || (data.length > 1 && !isEscape)) {
    return { metric: METRICS.pasted, value: [...data.replace(/\x1b\[20[01]~/g, "")].length };
  }

  if (isEscape) return null;

  if (data === "\r") return { metric: METRICS.enters, value: 1 };

  const code = data.codePointAt(0) ?? 0;

  return code >= 0x20 && code !== 0x7f ? { metric: METRICS.typed, value: 1 } : null;
}

/** Прибавить строку к очереди: та же (день, час, консоль, метрика) — к её значению */
function addPending(row: UsageStat) {
  const cur = pending.get(rowKey(row));

  if (cur) cur.value += row.value;
  else pending.set(rowKey(row), { ...row });
}

function rowKey(row: Pick<UsageStat, "day" | "hour" | "consoleId" | "metric">): string {
  return `${row.day}|${row.hour}|${row.consoleId}|${row.metric}`;
}

/** Проект консоли на момент записи: время остаётся за проектом, даже если консоль потом перенесут */
function projectOf(consoleId: string): string {
  if (!consoleId) return "";

  return findConsole(useAppStore.getState().workspaces, consoleId)?.project.id ?? "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
