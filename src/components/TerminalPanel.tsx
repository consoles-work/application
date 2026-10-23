import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { StickyNote, ChevronDown, ChevronRight, Zap, Settings2, Play } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { launchRequest, startupLines } from "../lib/connectionString";
import { quickCommandHex } from "../lib/quickCommandColors";
import { ConsoleIcon } from "../lib/consoleIcons";
import { useAppStore } from "../stores/appStore";
import { spawnPty, writeToPty, resizePty, killPty, recordQuickCommandRun } from "../lib/tauriCommands";
import { formatSavedTime } from "../lib/quickCommandStats";
import { trackUsage, trackTerminalInput, METRICS } from "../lib/usageStats";
import { getThemeById, resolveThemeId, type AppTheme } from "../lib/themes";
import { findConsole } from "../lib/tree";
import { isOpenLinkClick, openLink, OPEN_LINK_KEY } from "../lib/links";
import { useEscape } from "../hooks/useEscape";
import i18n from "../lib/i18n";
import type { TerminalSession, QuickCommand } from "../types";
import { QuickCommandsDialog } from "./dialogs/QuickCommandsDialog";
import { LinkifiedText } from "./LinkifiedText";

// ══════════════════════════════════════
// TerminalPanel — вкладки и терминалы консолей
// ══════════════════════════════════════
// Верхние вкладки — консоли, нижние (если их больше одного) — экземпляры
// активной консоли. Вкладки переставляются перетаскиванием; перетащенная
// становится активной. Крестик на вкладке консоли закрывает все её экземпляры,
// на подвкладке — один; оба — после подтверждения.
//
// Терминалы всех вкладок живут одновременно, виден только активный: при
// переключении вкладки сессия не перезапускается. Порядок их DOM-узлов — по
// времени открытия, а не как у вкладок: перестановка вкладок не должна
// пересоздавать xterm.

/** Шаг 3 TerminalView: пауза перед первой стартовой командой и между командами — шелл должен успеть подняться */
const STARTUP_FIRST_DELAY_MS = 500;
const STARTUP_STEP_MS = 400;

const TAB_DRAG_THRESHOLD = 6;

/** Прозрачность водяного знака: на тёмном фоне та же читается бледнее */
const WATERMARK_OPACITY = {
  danger: { dark: 0.26, light: 0.18 },
  plain: { dark: 0.14, light: 0.08 },
};

interface TabDrag {
  id: string;
  /** Место вставки: перед этой вкладкой, null — в конец */
  beforeId: string | null;
}

interface SessionGroup {
  consoleId: string;
  items: TerminalSession[];
}

export function TerminalPanel() {
  const {
    workspaces,
    sessions,
    activeSessionId,
    setActiveSession,
    activateConsole,
    closeSession,
    moveConsoleTab,
    moveSessionTab,
    terminalSelection,
    showAiPanel,
  } = useAppStore();
  const { t } = useTranslation();
  const [quickDialog, setQuickDialog] = useState<{ consoleId: string; editId?: string } | null>(null);

  const groups = groupSessions(sessions);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeGroup = groups.find((g) => g.consoleId === activeSession?.console_id);

  const consoleOf = (consoleId: string) => findConsole(workspaces, consoleId)?.console;

  const consoleDrag = useTabReorder((consoleId, beforeId) => {
    moveConsoleTab(consoleId, beforeId);
    activateConsole(consoleId);
  });

  const sessionDrag = useTabReorder((sessionId, beforeId) => {
    moveSessionTab(sessionId, beforeId);
    setActiveSession(sessionId);
  });

  const consoleMarker = dropMarker(groups.map((g) => g.consoleId), consoleDrag.drag);
  const sessionMarker = dropMarker(activeGroup?.items.map((s) => s.id) ?? [], sessionDrag.drag);

  // Крестик на верхней вкладке закрывает консоль целиком — все её экземпляры
  const handleClose = async (e: React.MouseEvent, items: TerminalSession[]) => {
    e.stopPropagation();

    const message =
      items.length === 1
        ? t("terminalPanel.closeTabConfirm", { title: tabTitle(items[0]) })
        : t("terminalPanel.closeGroupConfirm", { title: items[0].title, count: items.length });

    const confirmed = await ask(message, { title: t("terminalPanel.closeTabTitle"), kind: "warning" });

    if (confirmed) items.forEach((s) => closeSession(s.id));
  };

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* ── Вкладки (консоли) ── */}
      <div data-tab-bar className="h-9 flex items-center bg-surface-1 border-b border-border shrink-0 overflow-x-auto">
        {groups.map(({ consoleId, items }) => {
          const con = consoleOf(consoleId);
          const isDanger = con?.isDanger ?? false;
          const isActive = consoleId === activeSession?.console_id;

          return (
            <div
              key={consoleId}
              data-tab-id={consoleId}
              className={`terminal-tab relative ${isActive ? "active" : ""} ${isDanger ? "border-b-red-500/60" : ""} ${
                consoleDrag.drag?.id === consoleId ? "opacity-40" : ""
              }`}
              onMouseDown={(e) => consoleDrag.onMouseDown(e, consoleId)}
              onClick={() => activateConsole(consoleId)}
            >
              {consoleMarker?.id === consoleId && <DropMarker side={consoleMarker.side} />}
              {isDanger && <span className="text-red-400 text-xs mr-1">⚠</span>}
              {con && <ConsoleIcon con={con} size={14} />}
              <span className="truncate max-w-[120px]">{items[0].title}</span>
              {items.length > 1 && (
                <span className="text-2xs px-1 rounded bg-surface-3 text-text-muted font-mono shrink-0">{items.length}</span>
              )}
              {isDanger && (
                <span className="ml-1 text-2xs px-1 rounded bg-red-500/20 text-red-400 font-mono shrink-0">
                  {con?.dangerLabel ?? "DANGER"}
                </span>
              )}
              <button
                className="terminal-tab-close ml-1.5 text-text-muted hover:text-danger text-xs shrink-0"
                onClick={(e) => handleClose(e, items)}
              >
                ×
              </button>
            </div>
          );
        })}

        {sessions.length === 0 && <span className="px-3 text-xs text-text-muted">{t("terminalPanel.selectConsole")}</span>}

        {/* Индикатор выделения текста — точка в правом углу таббара */}
        {terminalSelection && !showAiPanel && (
          <div className="ml-auto px-3 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent block" title="Текст выделен — Cmd+I для AI" />
          </div>
        )}
      </div>

      {/* ── Подвкладки (экземпляры активной консоли), только если их больше одного ── */}
      {activeGroup && activeGroup.items.length > 1 && (
        <div data-tab-bar className="h-7 flex items-center bg-surface-0 border-b border-border shrink-0 overflow-x-auto">
          {activeGroup.items.map((session) => (
            <div
              key={session.id}
              data-tab-id={session.id}
              className={`terminal-tab relative py-1 ${session.id === activeSessionId ? "active" : ""} ${
                sessionDrag.drag?.id === session.id ? "opacity-40" : ""
              }`}
              onMouseDown={(e) => sessionDrag.onMouseDown(e, session.id)}
              onClick={() => setActiveSession(session.id)}
            >
              {sessionMarker?.id === session.id && <DropMarker side={sessionMarker.side} />}
              <span className="truncate max-w-[140px]">{tabTitle(session)}</span>
              <button
                className="terminal-tab-close ml-1.5 text-text-muted hover:text-danger text-xs shrink-0"
                onClick={(e) => handleClose(e, [session])}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Терминалы: живут все, виден активный; порядок — по времени открытия ── */}
      <div className="flex-1 overflow-hidden relative">
        {[...sessions]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((session) => {
            const con = consoleOf(session.console_id);

            return (
              <TerminalView
                key={`${session.id}-${session.reconnectKey ?? 0}`}
                session={session}
                isActive={session.id === activeSessionId}
                isDanger={con?.isDanger ?? false}
                dangerLabel={con?.dangerLabel ?? "DANGER"}
                consoleName={con?.name ?? ""}
                note={con?.note?.trim() ?? ""}
                quickCommands={con?.quickCommands ?? []}
                onManageQuickCommands={(editId) => setQuickDialog({ consoleId: session.console_id, editId })}
              />
            );
          })}
        {sessions.length === 0 && <EmptyState />}
      </div>

      {quickDialog && (
        <QuickCommandsDialog
          consoleId={quickDialog.consoleId}
          initialEditId={quickDialog.editId}
          onClose={() => setQuickDialog(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════
// TerminalView — один терминал консоли во вкладке
// ══════════════════════════════════════
// Открытие вкладки:
//  1. Создаём xterm с настройками и темой пользователя. Ссылки открываются по
//     Cmd+клик (Ctrl+клик не на macOS) в системном браузере: обычный клик
//     остаётся за выделением, а штатный window.open в Tauri ничего не открывает.
//  2. Решаем, что запускать: локальный шелл в папке проекта или SSH-команду —
//     ту же, что копирует кнопка «Копировать» в диалоге консоли.
//  3. Запускаем сессию в бэкенде. Исходы: а) запустилась — вывод идёт в xterm,
//     ввод — в сессию, затем стартовые команды консоли по строке с паузой;
//     б) не запустилась — ошибка красным в самом терминале; в) вкладку закрыли
//     раньше, чем сессия поднялась, — сразу убиваем её.
// Закрытие вкладки — сессия убивается, xterm освобождается.
// Смена настроек и темы применяется к живому терминалу без перезапуска.

interface TerminalViewProps {
  session: TerminalSession;
  isActive: boolean;
  isDanger: boolean;
  dangerLabel: string;
  consoleName: string;
  note: string;
  quickCommands: QuickCommand[];
  onManageQuickCommands: (editId?: string) => void;
}

function TerminalView({
  session,
  isActive,
  isDanger,
  dangerLabel,
  consoleName,
  note,
  quickCommands,
  onManageQuickCommands,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);

  const { settings, workspaces, updateConsole } = useAppStore();
  const { t } = useTranslation();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [noteExpanded, setNoteExpanded] = useState(false);

  const theme = getThemeById(resolveThemeId(settings["ui.theme"] ?? "dark"));
  const mark = watermark(theme, isDanger, dangerLabel, consoleName);

  // ── Смена настроек и темы — к живому терминалу ──
  useEffect(() => {
    const term = termRef.current;
    const container = containerRef.current;

    if (!term || !container) return;

    applyAppearance(term, container);

    fitAddonRef.current?.fit();
  }, [settings]);

  // ── Жизнь терминала: от открытия вкладки до закрытия ──
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    // 1. xterm.
    const { term, fitAddon } = createTerminal(container);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onSelectionChange(() => useAppStore.getState().setTerminalSelection(term.getSelection()));

    // Cmd+C (при наличии выделения) — копировать.
    // Вставку (Cmd/Ctrl+V) НЕ перехватываем: xterm обрабатывает системное
    // событие `paste` сам (через скрытый textarea), с поддержкой bracketed-paste.
    // Дублировать её ручным readText→writeToPty нельзя — будет двойная вставка.
    // Только metaKey, чтобы не перехватывать Ctrl+C (SIGINT) в шелле.
    term.attachCustomKeyEventHandler((e) => {
      const copy = e.type === "keydown" && e.metaKey && e.key === "c" && term.hasSelection();

      if (copy) copyToClipboard(term.getSelection());

      return !copy;
    });

    // 2. Что запускать.
    const ref = findConsole(useAppStore.getState().workspaces, session.console_id);

    const request = launchRequest(ref?.console, ref?.project);

    // 3. Сессия.
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const connect = async () => {
      const ptyId = await spawnPty(request);

      // в) Вкладку закрыли, пока сессия поднималась. Ошибку убийства не показываем:
      // сессия могла уже завершиться сама.
      if (disposed) {
        killPty(ptyId).catch(ignoreClosedSession);

        return;
      }

      ptyIdRef.current = ptyId;

      // а) Вывод → xterm.
      unlisten = await listen<{ pty_id: number; data: string }>("pty-output", (event) => {
        if (event.payload.pty_id !== ptyId) return;

        term.write(event.payload.data);

        trackUsage(METRICS.output, event.payload.data.length, session.console_id);
      });

      if (disposed) unlisten();

      // Ввод → сессия. Enter и Ctrl+C сбрасывают «протёкший» цвет прерванной программы.
      term.onData((data) => {
        if (/[\r\x03]/.test(data)) resetLeakedSgr(term);

        writeToPty(ptyId, data);

        trackTerminalInput(session.console_id, data);
      });

      trackUsage(METRICS.sessions, 1, session.console_id);

      // Размер: сразу по реальному xterm (fit уже был до запуска), дальше — по событиям
      resizePty(ptyId, term.cols, term.rows).catch(ignoreClosedSession);

      term.onResize(({ cols, rows }) => resizePty(ptyId, cols, rows));

      // Стартовые команды
      startupLines(ref?.console.startupCmd).forEach((line, i) => {
        setTimeout(() => writeToPty(ptyId, line + "\n"), STARTUP_FIRST_DELAY_MS + i * STARTUP_STEP_MS);
      });
    };

    // б) Не запустилась.
    connect().catch((e) => term.write(`\x1b[31m${i18n.t("terminalPanel.ptyError", { error: e })}\x1b[0m\r\n`));

    // Закрытие вкладки.
    return () => {
      disposed = true;

      unlisten?.();

      if (ptyIdRef.current !== null) killPty(ptyIdRef.current).catch(ignoreClosedSession);

      term.dispose();
    };
    // Терминал создаётся один раз на вкладку; новые настройки применяет эффект выше,
    // перезапуск сессии — через смену key (reconnectKey)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fit при переключении на вкладку: display:none → flex требует кадр на пересчёт layout ──
  useEffect(() => {
    if (isActive) requestAnimationFrame(() => fitAddonRef.current?.fit());
  }, [isActive]);

  // ── Fit при изменении размера панели ──
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let timer: ReturnType<typeof setTimeout>;

    // Немедленный fit + отложенный, чтобы поймать финальный размер после анимаций сплиттера
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();

      clearTimeout(timer);

      timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
    });

    observer.observe(container);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const writeToSession = (data: string) => {
    if (ptyIdRef.current !== null) writeToPty(ptyIdRef.current, data);
  };

  // ── Контекстное меню ──
  const menuCopy = () => copyToClipboard(termRef.current?.getSelection() ?? "");

  const menuPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();

      if (text) termRef.current?.paste(text);
    } catch {
      // Буфер недоступен (нет разрешения) — вставлять нечего
    }
  };

  // Ctrl+E (в конец строки) + Ctrl+U (удалить до начала) — очищает всю строку ввода
  const menuClearLine = () => writeToSession("\x05\x15");

  // Полный сброс xterm (включая «залипшие» SGR-цвета) + перерисовка приглашения шелла
  const menuReset = () => {
    termRef.current?.reset();

    writeToSession("\x0c");

    requestAnimationFrame(() => fitAddonRef.current?.fit());
  };

  // ── Быстрая команда ──
  // Строки уходят в сессию как набранные с Enter. Подтверждение — только если у
  // команды включено «Показывать предупреждение». Счётчик запусков считает бэкенд.
  const runQuickCommand = async (cmd: QuickCommand) => {
    // 1. Сессии нет — запускать некуда.
    const ptyId = ptyIdRef.current;

    if (ptyId === null) return;

    // 2. Подтверждение.
    if (cmd.confirm) {
      const confirmed = await ask(i18n.t("quickCommands.runConfirm", { label: cmd.label, command: cmd.command }), {
        title: i18n.t("quickCommands.runConfirmTitle"),
        kind: "warning",
      });

      if (!confirmed) return;
    }

    // 3. В терминал.
    if (termRef.current) resetLeakedSgr(termRef.current);

    writeToPty(ptyId, cmd.command.replace(/\r?\n/g, "\r") + "\r").catch(ignoreClosedSession);

    termRef.current?.focus();

    // 4. Статистика. Символы — та же формула, что в record_quick_command_run: команда + Enter.
    trackUsage(METRICS.qcRuns, 1, session.console_id);
    trackUsage(METRICS.qcChars, [...cmd.command].length + 1, session.console_id);

    try {
      const updated = await recordQuickCommandRun(session.console_id, cmd.id);

      const commands = findConsole(workspaces, session.console_id)?.console.quickCommands ?? [];

      updateConsole(session.console_id, { quickCommands: commands.map((c) => (c.id === updated.id ? updated : c)) });
    } catch (e) {
      // Команда уже выполнена — не сохранился только счётчик
      console.warn("recordQuickCommandRun failed", e);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ display: isActive ? "flex" : "none" }}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {ctxMenu && (
        <TerminalContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          hasSelection={termRef.current?.hasSelection() ?? false}
          onClose={() => setCtxMenu(null)}
          onCopy={menuCopy}
          onPaste={menuPaste}
          onSelectAll={() => termRef.current?.selectAll()}
          onClearLine={menuClearLine}
          // term.clear() оставляет текущую строку приглашения, убирает историю выше
          onClearScreen={() => termRef.current?.clear()}
          onReset={menuReset}
        />
      )}
      {isDanger && (
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b-2 border-red-500/70"
          style={{ background: "rgba(220,38,38,0.18)" }}
        >
          <span className="text-red-400 text-sm leading-none">⚠</span>
          <span className="text-red-300 font-bold text-xs tracking-widest uppercase">{dangerLabel}</span>
          <span className="text-red-400/50 text-xs">—</span>
          <span className="text-red-400/60 text-2xs">{t("terminalPanel.dangerWarning", { label: dangerLabel })}</span>
        </div>
      )}
      {/* Заметка — клик разворачивает многострочную целиком */}
      {note && (
        <div
          className="shrink-0 flex items-start gap-2 px-3 py-1 bg-surface-1 border-b border-border cursor-pointer hover:bg-surface-2"
          onClick={() => setNoteExpanded((v) => !v)}
          title={noteExpanded ? undefined : note}
        >
          <StickyNote size={12} className="text-text-muted shrink-0 mt-0.5" />
          <span
            className={`flex-1 text-2xs text-text-secondary min-w-0 ${
              noteExpanded ? "whitespace-pre-wrap max-h-24 overflow-y-auto" : "truncate"
            }`}
          >
            <LinkifiedText text={note} />
          </span>
          {noteExpanded ? (
            <ChevronDown size={12} className="text-text-muted shrink-0 mt-0.5" />
          ) : (
            <ChevronRight size={12} className="text-text-muted shrink-0 mt-0.5" />
          )}
        </div>
      )}
      {/* Терминал; у опасных — красноватый фон */}
      <div className="relative flex-1 overflow-hidden p-1" style={isDanger ? { backgroundColor: "rgba(220,38,38,0.045)" } : undefined}>
        <div ref={containerRef} className="h-full w-full" />
        {/* Фон xterm непрозрачный, поэтому водяной знак — полупрозрачный слой поверх,
            не перехватывающий мышь. У опасных консолей ещё красная рамка по периметру. */}
        {(isDanger || mark.text) && (
          <div
            className="pointer-events-none select-none absolute inset-0 flex items-end justify-end p-4"
            style={isDanger ? { boxShadow: "inset 0 0 0 2px rgba(220,38,38,0.55), inset 0 0 40px rgba(220,38,38,0.12)" } : undefined}
          >
            {mark.text && (
              <span
                className={`leading-none truncate max-w-full ${
                  mark.isLabel ? "font-black uppercase tracking-widest" : "font-bold tracking-wide"
                }`}
                style={{
                  fontSize: mark.isLabel ? "clamp(28px, 6vw, 72px)" : "clamp(20px, 3.5vw, 44px)",
                  color: mark.color,
                  opacity: mark.opacity,
                }}
              >
                {mark.text}
              </span>
            )}
          </div>
        )}
      </div>
      {quickCommands.length > 0 && (
        <QuickCommandsBar
          commands={quickCommands}
          onRun={runQuickCommand}
          onEdit={(cmd) => onManageQuickCommands(cmd.id)}
          onManage={() => onManageQuickCommands()}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════
// Панель быстрых команд под терминалом
// ══════════════════════════════════════
// Клик — выполнить, ПКМ — редактировать кнопку. Подсказка своя, с задержкой:
// нативные tooltip в WebKit у Tauri показываются ненадёжно.

function QuickCommandsBar({
  commands,
  onRun,
  onEdit,
  onManage,
}: {
  commands: QuickCommand[];
  onRun: (cmd: QuickCommand) => void;
  onEdit: (cmd: QuickCommand) => void;
  onManage: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ cmd: QuickCommand; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const showHint = (cmd: QuickCommand, el: HTMLElement) => {
    clearTimeout(hoverTimer.current);

    hoverTimer.current = setTimeout(() => setHover({ cmd, rect: el.getBoundingClientRect() }), 300);
  };

  const hideHint = () => {
    clearTimeout(hoverTimer.current);

    setHover(null);
  };

  return (
    <div
      className="shrink-0 flex items-center gap-1 px-2 py-1 bg-surface-1 border-t border-border overflow-x-auto"
      onScroll={hideHint}
      // Своё ПКМ-поведение (редактирование кнопки) вместо меню терминала
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Zap size={12} className="text-text-muted shrink-0 mr-0.5" />
      {commands.map((cmd) => {
        const hex = quickCommandHex(cmd.color);

        return (
          <button
            key={cmd.id}
            className={`shrink-0 max-w-[200px] flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs text-text-primary border ${
              hex ? "hover:brightness-125" : "bg-surface-2 border-border hover:border-accent/60 hover:bg-surface-3"
            }`}
            // Цветная кнопка: полупрозрачный фон (~15%) и рамка (~60%) цвета палитры
            style={hex ? { backgroundColor: `${hex}26`, borderColor: `${hex}99` } : undefined}
            onMouseEnter={(e) => showHint(cmd, e.currentTarget)}
            onMouseLeave={hideHint}
            onClick={() => {
              hideHint();
              onRun(cmd);
            }}
            onContextMenu={() => {
              hideHint();
              onEdit(cmd);
            }}
          >
            <Play size={10} className={`shrink-0 fill-current ${hex ? "" : "text-accent"}`} style={hex ? { color: hex } : undefined} />
            <span className="truncate">{cmd.label}</span>
          </button>
        );
      })}
      {hover && (
        <QuickCommandHint
          // Берём актуальную версию команды: счётчик мог обновиться, пока подсказка открыта
          cmd={commands.find((c) => c.id === hover.cmd.id) ?? hover.cmd}
          rect={hover.rect}
        />
      )}
      <button
        className="ml-auto shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-3"
        title={t("quickCommands.manage")}
        onClick={onManage}
      >
        <Settings2 size={13} />
      </button>
    </div>
  );
}

/** Подсказка над кнопкой быстрой команды: подпись, описание, сама команда, статистика */
function QuickCommandHint({ cmd, rect }: { cmd: QuickCommand; rect: DOMRect }) {
  const { t } = useTranslation();

  const width = 340;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const bottom = window.innerHeight - rect.top + 6;

  return createPortal(
    <div
      className="fixed z-50 pointer-events-none bg-surface-2 border border-border rounded-lg shadow-xl px-3 py-2 flex flex-col gap-1.5"
      style={{ left, bottom, maxWidth: width }}
    >
      <div className="text-xs font-semibold text-text-primary break-words">{cmd.label}</div>
      {cmd.description && <div className="text-2xs text-text-secondary whitespace-pre-wrap break-words">{cmd.description}</div>}
      <pre className="text-2xs font-mono text-text-primary bg-surface-0 border border-border rounded px-2 py-1 whitespace-pre-wrap break-all max-h-40 overflow-hidden">
        {cmd.command}
      </pre>
      {cmd.confirm && <div className="text-2xs text-red-400">⚠ {t("quickCommands.confirmHint")}</div>}
      <div className="text-2xs text-text-secondary">
        {cmd.runCount
          ? t("quickCommands.stats", { runs: cmd.runCount, saved: formatSavedTime(cmd.savedChars ?? 0, t) })
          : t("quickCommands.statsNever")}
      </div>
      <div className="text-2xs text-text-muted">{t("quickCommands.barHint")}</div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════
// Контекстное меню терминала (ПКМ)
// ══════════════════════════════════════

interface TerminalContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClearLine: () => void;
  onClearScreen: () => void;
  onReset: () => void;
}

function TerminalContextMenu({ x, y, hasSelection, onClose, ...actions }: TerminalContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("mousedown", onMouseDown);

    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  useEscape(onClose);

  const menuWidth = 200;

  // Действие, затем закрыть меню
  const item = (label: string, icon: string, action: () => void, disabled = false) => ({
    label: t(label),
    icon,
    disabled,
    action: () => {
      action();
      onClose();
    },
  });

  const items = [
    item("terminalContextMenu.copy", "⧉", actions.onCopy, !hasSelection),
    item("terminalContextMenu.paste", "⇪", actions.onPaste),
    item("terminalContextMenu.selectAll", "▦", actions.onSelectAll),
    "separator" as const,
    item("terminalContextMenu.clearLine", "⌫", actions.onClearLine),
    item("terminalContextMenu.clearScreen", "▢", actions.onClearScreen),
    item("terminalContextMenu.reset", "↺", actions.onReset),
  ];

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ top: Math.min(y, window.innerHeight - 240), left: Math.min(x, window.innerWidth - menuWidth - 8), width: menuWidth }}
    >
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-3 flex items-center gap-2 text-text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
            onClick={it.action}
          >
            <span className="w-4 text-center opacity-60">{it.icon}</span>
            {it.label}
          </button>
        )
      )}
    </div>,
    document.body
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col items-center justify-center text-text-muted">
      <div className="text-4xl mb-4">💻</div>
      <div className="text-sm font-medium mb-1">{t("terminalPanel.noTerminals")}</div>
      <div className="text-xs">{t("terminalPanel.clickConsole")}</div>
    </div>
  );
}

// ══════════════════════════════════════
// Перестановка вкладок перетаскиванием
// ══════════════════════════════════════
// HTML5 DnD в Tauri WebKit не работает — как в дереве, слушаем mousemove/mouseup
// на window. Перетаскивание начинается после сдвига на порог, иначе это клик.
// Вкладки размечены data-tab-id, полоса — data-tab-bar.

function useTabReorder(onDrop: (id: string, beforeId: string | null) => void) {
  const [drag, setDrag] = useState<TabDrag | null>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLElement>, id: string) => {
    // С крестика не тащим: отпускание над ним закрыло бы вкладку
    if (e.button !== 0 || (e.target as HTMLElement).closest(".terminal-tab-close")) return;

    const bar = e.currentTarget.closest<HTMLElement>("[data-tab-bar]");

    if (!bar) return;

    const startX = e.clientX;

    let active = false;
    let beforeId: string | null = null;

    const onMove = (ev: MouseEvent) => {
      active ||= Math.abs(ev.clientX - startX) >= TAB_DRAG_THRESHOLD;

      if (!active) return;

      document.body.style.cursor = "grabbing";

      beforeId = tabBefore(bar, ev.clientX);

      setDrag({ id, beforeId });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      if (!active) return;

      document.body.style.cursor = "";

      setDrag(null);

      onDrop(id, beforeId);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { drag, onMouseDown };
}

/** Встаём перед первой вкладкой, чья середина правее курсора; null — в конец */
function tabBefore(bar: HTMLElement, x: number): string | null {
  const target = Array.from(bar.querySelectorAll<HTMLElement>("[data-tab-id]")).find((el) => {
    const r = el.getBoundingClientRect();

    return x < r.left + r.width / 2;
  });

  return target?.dataset.tabId ?? null;
}

/** Где рисовать полоску места вставки; null — перестановка ничего не меняет */
function dropMarker(ids: string[], drag: TabDrag | null): { id: string; side: "left" | "right" } | null {
  if (!drag) return null;

  const from = ids.indexOf(drag.id);
  const to = drag.beforeId ? ids.indexOf(drag.beforeId) : ids.length;

  if (from === -1 || to === from || to === from + 1) return null;

  return to < ids.length ? { id: ids[to], side: "left" } : { id: ids[ids.length - 1], side: "right" };
}

function DropMarker({ side }: { side: "left" | "right" }) {
  return (
    <span
      className={`absolute top-1 bottom-1 w-0.5 rounded bg-accent pointer-events-none ${
        side === "left" ? "-left-px" : "-right-px"
      }`}
    />
  );
}

// ══════════════════════════════════════
// Детали
// ══════════════════════════════════════

/** Верхние вкладки: экземпляры одной консоли в `sessions` идут подряд, порядок групп — как в массиве */
function groupSessions(sessions: TerminalSession[]): SessionGroup[] {
  const groups: SessionGroup[] = [];

  for (const s of sessions) {
    const group = groups.find((g) => g.consoleId === s.console_id);

    if (group) group.items.push(s);
    else groups.push({ consoleId: s.console_id, items: [s] });
  }

  return groups;
}

/** Подпись экземпляра: первый — просто имя консоли, следующие — «имя #N» */
function tabTitle(session: TerminalSession): string {
  const n = session.instance ?? 1;

  return n > 1 ? `${session.title} #${n}` : session.title;
}

/** Шаг 1: xterm с аддонами, открытый в контейнере и подогнанный по размеру */
function createTerminal(container: HTMLDivElement): { term: Terminal; fitAddon: FitAddon } {
  const { fontSize, fontFamily, scrollback, cursorStyle } = terminalSettings();

  const links = {
    activate: (e: MouseEvent, uri: string) => {
      if (isOpenLinkClick(e)) openLink(uri);
    },
    hover: () => {
      container.title = i18n.t("terminalPanel.openLinkHint", { key: OPEN_LINK_KEY });
    },
    leave: () => {
      container.title = "";
    },
  };

  const term = new Terminal({
    fontFamily,
    fontSize,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle,
    scrollback,
    theme: currentTheme().xterm,
    // Unicode-API (term.unicode) в xterm 6 помечен как proposed: без этого флага
    // обращение к нему бросает исключение и терминал не успевает открыться.
    allowProposedApi: true,
    // Гиперссылки OSC 8 (`ls --hyperlink`, вывод компиляторов) — только http(s)
    linkHandler: links,
  });

  const fitAddon = new FitAddon();

  term.loadAddon(fitAddon);
  // Unicode 11: корректная ширина emoji и CJK. Без него xterm считает их
  // по таблицам Unicode 6 → рамки, таблицы и псевдографика съезжают на строку.
  term.loadAddon(new Unicode11Addon());
  // URL в обычном выводе
  term.loadAddon(new WebLinksAddon(links.activate, { hover: links.hover, leave: links.leave }));

  term.unicode.activeVersion = "11";

  applyAppearance(term, container);

  term.open(container);

  fitAddon.fit();

  return { term, fitAddon };
}

/** Шрифт, прокрутка, курсор и тема из настроек — на создании и при каждой их смене */
function applyAppearance(term: Terminal, container: HTMLDivElement) {
  const { fontSize, fontFamily, scrollback, cursorStyle } = terminalSettings();

  const xtermTheme = currentTheme().xterm;

  term.options.fontSize = fontSize;
  term.options.fontFamily = fontFamily;
  term.options.scrollback = scrollback;
  term.options.cursorStyle = cursorStyle;
  term.options.theme = xtermTheme;

  // Фон темы xterm 6 кладёт на .xterm-scrollable-element — тот не покрывает ни
  // padding, ни остаток высоты от деления на строку, а .xterm-viewport под ним
  // чёрный из штатного CSS (там мы его гасим). Красим контейнер сами.
  container.style.backgroundColor = xtermTheme.background;
}

function terminalSettings() {
  const { settings } = useAppStore.getState();

  return {
    fontSize: parseInt(settings["terminal.fontSize"] ?? "14"),
    fontFamily: `${settings["terminal.fontFamily"] ?? "Menlo"}, monospace`,
    scrollback: parseInt(settings["terminal.scrollback"] ?? "5000"),
    cursorStyle: (settings["terminal.cursorStyle"] ?? "block") as "block" | "underline" | "bar",
  };
}

function currentTheme(): AppTheme {
  return getThemeById(resolveThemeId(useAppStore.getState().settings["ui.theme"] ?? "dark"));
}

/**
 * Водяной знак: у опасной консоли с меткой — крупная метка, иначе — имя консоли
 * помельче. Цвет из темы (prod/plain), чтобы на тёмных темах не было тёмных надписей.
 */
function watermark(theme: AppTheme, isDanger: boolean, dangerLabel: string, consoleName: string) {
  const label = dangerLabel.trim();

  const isLabel = isDanger && label !== "";

  const opacity = WATERMARK_OPACITY[isDanger ? "danger" : "plain"][theme.dark ? "dark" : "light"];

  return {
    text: isLabel ? label : consoleName.trim(),
    isLabel,
    color: isDanger ? theme.watermark.prod : theme.watermark.plain,
    opacity,
  };
}

/**
 * Сбрасывает «протёкший» цвет перед Enter / Ctrl+C.
 *
 * Цвет в терминале — общее состояние: программа включает серый (`ESC[90m`),
 * а если её прервать (`^C` у `docker logs -f`) до `ESC[0m`, серыми станут
 * приглашение shell и всё, что после. Сброс пишем только в xterm (не в PTY),
 * и только в обычном буфере — полноэкранные программы (vim, htop, less)
 * работают в альтернативном и сами управляют цветами.
 */
function resetLeakedSgr(term: Terminal) {
  if (term.buffer.active.type === "normal") term.write("\x1b[0m");
}

/** Пустое выделение не копируем */
function copyToClipboard(text: string) {
  if (text) navigator.clipboard.writeText(text).catch((e) => console.warn("clipboard", e));
}

/** Сессия могла завершиться сама (exit в шелле) — команды к ней не доходят, и это не ошибка */
function ignoreClosedSession() {}
