import { useAppStore } from "../stores/appStore";
import { recordUsageStats, type UsageStat } from "./tauriCommands";

// ══════════════════════════════════════
// Сбор статистики использования
// ══════════════════════════════════════
// Приращения копятся в памяти по ключу (день, час, консоль, метрика) и раз в
// FLUSH_MS уходят в БД одним пакетом — терминал не дёргает IPC на каждую клавишу.
// День и час — локальные, на момент события: работа через полночь делится честно.
// Выключено в настройках (stats.enabled = "false") или экран заблокирован — не считаем.

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

let enabled = false;
let paused = false;
let pending = new Map<string, UsageStat>();
let lastActivity = Date.now();

const pad = (n: number) => String(n).padStart(2, "0");
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function projectIdForConsole(consoleId: string): string {
  if (!consoleId) return "";
  for (const ws of useAppStore.getState().workspaces) {
    for (const p of ws.projects) {
      if (p.consoles.some((c) => c.id === consoleId)) return p.id;
    }
  }
  return "";
}

/** Приращение метрики. consoleId = "" — уровень приложения. */
export function trackUsage(metric: MetricName, value: number, consoleId = "") {
  if (!enabled || paused || !(value > 0)) return;
  const now = new Date();
  const day = localDay(now);
  const hour = now.getHours();
  const key = `${day}|${hour}|${consoleId}|${metric}`;
  const row = pending.get(key);
  if (row) row.value += value;
  else pending.set(key, { day, hour, consoleId, projectId: projectIdForConsole(consoleId), metric, value });
}

/** Ввод пользователя в терминал (то, что xterm отдаёт в onData). */
export function trackTerminalInput(consoleId: string, data: string) {
  if (!enabled || paused) return;
  // Вставка: bracketed paste или несколько символов разом (одна клавиша даёт один)
  if (data.startsWith("\x1b[200~") || (data.length > 1 && !data.startsWith("\x1b"))) {
    const text = data.replace(/\x1b\[20[01]~/g, "");
    trackUsage(METRICS.pasted, [...text].length, consoleId);
    return;
  }
  if (data.startsWith("\x1b")) return; // стрелки, F-клавиши и т.п.
  if (data === "\r") {
    trackUsage(METRICS.enters, 1, consoleId);
    return;
  }
  const code = data.codePointAt(0) ?? 0;
  if (code >= 0x20 && code !== 0x7f) trackUsage(METRICS.typed, 1, consoleId);
}

/** Сбросить накопленное в БД. При ошибке — вернуть в очередь до следующей попытки. */
export async function flushUsage(): Promise<void> {
  if (pending.size === 0) return;
  const batch = pending;
  pending = new Map();
  // В БД — целые; дробные остатки секунд остаются копиться к следующему сбросу
  const rows: UsageStat[] = [];
  for (const [key, row] of batch) {
    const whole = Math.floor(row.value);
    if (whole > 0) rows.push({ ...row, value: whole });
    if (row.value - whole > 0) pending.set(key, { ...row, value: row.value - whole });
  }
  if (rows.length === 0) return;
  try {
    await recordUsageStats(rows);
  } catch (e) {
    console.warn("recordUsageStats failed", e);
    for (const row of rows) {
      const key = `${row.day}|${row.hour}|${row.consoleId}|${row.metric}`;
      const cur = pending.get(key);
      if (cur) cur.value += row.value;
      else pending.set(key, row);
    }
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

/** Запустить учёт времени; возвращает функцию остановки. */
export function startUsageTracking(): () => void {
  let lastTick = Date.now();

  const bump = (e: Event) => {
    if (e.type === "mousemove" && !document.hasFocus()) return;
    lastActivity = Date.now();
  };

  const tick = () => {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if (gap <= 0 || gap > MAX_TICK_GAP_MS) return;
    if (document.visibilityState !== "visible") return;
    const sec = gap / 1000;
    trackUsage(METRICS.appOpen, sec);
    if (!document.hasFocus() || now - lastActivity > IDLE_MS) return;
    trackUsage(METRICS.active, sec);
    const { sessions, activeSessionId } = useAppStore.getState();
    const consoleId = sessions.find((s) => s.id === activeSessionId)?.console_id;
    if (consoleId) trackUsage(METRICS.consoleTime, sec, consoleId);
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushUsage();
    lastTick = Date.now();
  };

  const events = ["mousemove", "mousedown", "keydown", "wheel"] as const;
  const opts = { capture: true, passive: true };
  events.forEach((ev) => window.addEventListener(ev, bump, opts));
  document.addEventListener("visibilitychange", onVisibility);
  const tickTimer = window.setInterval(tick, TICK_MS);
  const flushTimer = window.setInterval(flushUsage, FLUSH_MS);

  return () => {
    events.forEach((ev) => window.removeEventListener(ev, bump, opts));
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(tickTimer);
    window.clearInterval(flushTimer);
    tick();
    flushUsage();
  };
}
