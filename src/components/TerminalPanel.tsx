import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../stores/appStore";
import { spawnPty, writeToPty, resizePty, killPty } from "../lib/tauriCommands";
import { getThemeById, resolveThemeId } from "../lib/themes";
import type { TerminalSession, ConsoleConfig, Project } from "../types";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";

// ══════════════════════════════════════
// Вспомогательные функции поиска по дереву
// ══════════════════════════════════════

function findConsoleById(consoleId: string): ConsoleConfig | undefined {
  const { workspaces } = useAppStore.getState();
  for (const ws of workspaces) {
    for (const proj of ws.projects) {
      const con = proj.consoles.find((c) => c.id === consoleId);
      if (con) return con;
    }
  }
  return undefined;
}

function findProjectForConsole(consoleId: string): Project | undefined {
  const { workspaces } = useAppStore.getState();
  for (const ws of workspaces) {
    for (const proj of ws.projects) {
      if (proj.consoles.some((c) => c.id === consoleId)) return proj;
    }
  }
  return undefined;
}

// ══════════════════════════════════════
// TerminalPanel — вкладки + терминалы
// ══════════════════════════════════════

export function TerminalPanel() {
  const { sessions, activeSessionId, setActiveSession, closeSession, terminalSelection, showAiPanel } =
    useAppStore();
  const { t } = useTranslation();

  const handleCloseTab = async (e: React.MouseEvent, session: TerminalSession) => {
    e.stopPropagation();
    const confirmed = await ask(t("terminalPanel.closeTabConfirm", { title: session.title }), {
      title: t("terminalPanel.closeTabTitle"),
      kind: "warning",
    });
    if (confirmed) closeSession(session.id);
  };

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* ── Вкладки ── */}
      <div className="h-9 flex items-center bg-surface-1 border-b border-border shrink-0 overflow-x-auto">
        {sessions.map((session) => {
          const con = findConsoleById(session.console_id);
          const isDanger = con?.isDanger ?? false;
          const dangerLabel = con?.dangerLabel ?? "DANGER";
          const isActive = session.id === activeSessionId;

          return (
            <div
              key={session.id}
              className={`terminal-tab ${isActive ? "active" : ""} ${
                isDanger ? "border-b-red-500/60" : ""
              }`}
              onClick={() => setActiveSession(session.id)}
            >
              {isDanger && (
                <span className="text-red-400 text-xs mr-1">⚠</span>
              )}
              <span className="truncate max-w-[120px]">{session.title}</span>
              {isDanger && (
                <span className="ml-1 text-2xs px-1 rounded bg-red-500/20 text-red-400 font-mono shrink-0">
                  {dangerLabel}
                </span>
              )}
              <button
                className="ml-1.5 text-text-muted hover:text-danger text-xs shrink-0"
                style={{ opacity: isActive ? 0.6 : 0 }}
                onClick={(e) => handleCloseTab(e, session)}
              >
                ×
              </button>
            </div>
          );
        })}

        {sessions.length === 0 && (
          <span className="px-3 text-xs text-text-muted">
            {t("terminalPanel.selectConsole")}
          </span>
        )}

        {/* Индикатор выделения текста — точка в правом углу таббара */}
        {terminalSelection && !showAiPanel && (
          <div className="ml-auto px-3 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent block" title="Текст выделен — Cmd+I для AI" />
          </div>
        )}
      </div>

      {/* ── Терминальные инстансы (все рендерятся, только активный виден) ── */}
      <div className="flex-1 overflow-hidden relative">
        {sessions.map((session) => {
          const con = findConsoleById(session.console_id);
          return (
            <TerminalView
              key={`${session.id}-${session.reconnectKey ?? 0}`}
              session={session}
              isActive={session.id === activeSessionId}
              isDanger={con?.isDanger ?? false}
              dangerLabel={con?.dangerLabel ?? "DANGER"}
            />
          );
        })}
        {sessions.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// TerminalView — один xterm.js инстанс
// ══════════════════════════════════════

function getTerminalSettings() {
  const { settings } = useAppStore.getState();
  const fontSize = parseInt(settings["terminal.fontSize"] ?? "14");
  const fontFamily = settings["terminal.fontFamily"] ?? "Menlo";
  const scrollback = parseInt(settings["terminal.scrollback"] ?? "5000");
  const cursorStyle = (settings["terminal.cursorStyle"] ?? "block") as "block" | "underline" | "bar";
  return { fontSize, fontFamily: `${fontFamily}, monospace`, scrollback, cursorStyle };
}

function TerminalView({
  session,
  isActive,
  isDanger,
  dangerLabel,
}: {
  session: TerminalSession;
  isActive: boolean;
  isDanger: boolean;
  dangerLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const { settings } = useAppStore();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  // ── Применение настроек к уже запущенному терминалу ──
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const { fontSize, fontFamily, scrollback, cursorStyle } = getTerminalSettings();
    const themeId = resolveThemeId(settings["ui.theme"] ?? "dark");
    const xtermTheme = getThemeById(themeId).xterm;
    term.options.fontSize = fontSize;
    term.options.fontFamily = fontFamily;
    term.options.scrollback = scrollback;
    term.options.cursorStyle = cursorStyle;
    term.options.theme = xtermTheme;
    fitAddonRef.current?.fit();
  }, [settings]);

  // ── Инициализация: создаём terminal и PTY ──
  useEffect(() => {
    if (!containerRef.current) return;

    const { fontSize, fontFamily, scrollback, cursorStyle } = getTerminalSettings();
    const themeId = resolveThemeId(useAppStore.getState().settings["ui.theme"] ?? "dark");
    const xtermTheme = getThemeById(themeId).xterm;

    const term = new Terminal({
      fontFamily,
      fontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle,
      scrollback,
      theme: xtermTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Отслеживаем выделение текста для AI панели
    term.onSelectionChange(() => {
      useAppStore.getState().setTerminalSelection(term.getSelection());
    });

    // Cmd+C (при наличии выделения) — копировать.
    // Вставку (Cmd/Ctrl+V) НЕ перехватываем: xterm обрабатывает системное
    // событие `paste` сам (через скрытый textarea), с поддержкой bracketed-paste.
    // Дублировать её ручным readText→writeToPty нельзя — будет двойная вставка.
    // Только metaKey, чтобы не перехватывать Ctrl+C (SIGINT) в шелле.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !e.metaKey) return true;
      if (e.key === "c" && term.hasSelection()) {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }
      return true;
    });

    // Находим консоль и проект для определения шелла и рабочей директории
    const consoleConfig = findConsoleById(session.console_id);
    const project = findProjectForConsole(session.console_id);

    let shell = consoleConfig?.shellOverride || project?.default_shell || "";
    let cwd = consoleConfig?.cwdOverride || project?.path || "";
    const envVars = { ...project?.env_vars, ...consoleConfig?.envVars };

    // SSH: строим команду подключения
    let sshKeyPath: string | undefined;
    let sshPassphrase: string | undefined;
    let sshPassword: string | undefined;
    if (consoleConfig?.connectionType === "ssh") {
      const host = consoleConfig.sshHost || "";
      const port = consoleConfig.sshPort || 22;
      const user = consoleConfig.sshUser || "";
      const keyPath = consoleConfig.sshKeyPath || "";
      const extraArgs = consoleConfig.sshExtraArgs || "";

      let sshCmd = "ssh";
      if (port !== 22) sshCmd += ` -p ${port}`;
      if (keyPath) sshCmd += ` -i "${keyPath}"`;
      if (extraArgs) sshCmd += ` ${extraArgs}`;
      sshCmd += user ? ` ${user}@${host}` : ` ${host}`;

      shell = sshCmd;
      cwd = "";
      sshKeyPath = keyPath || undefined;
      sshPassphrase = consoleConfig.sshPassphrase || undefined;
      sshPassword = consoleConfig.sshPassword || undefined;
    }

    // Запускаем PTY и подключаем всё
    let disposed = false;

    (async () => {
      try {
        const ptyId = await spawnPty(shell, cwd, envVars ?? {}, sshKeyPath, sshPassphrase, sshPassword);
        if (disposed) {
          killPty(ptyId).catch(() => {});
          return;
        }
        ptyIdRef.current = ptyId;

        // Подписываемся на вывод из PTY
        const unlisten = await listen<{ pty_id: number; data: string }>(
          "pty-output",
          (event) => {
            if (event.payload.pty_id === ptyId) {
              term.write(event.payload.data);
            }
          }
        );
        unlistenRef.current = unlisten;

        // Ввод пользователя → PTY
        term.onData((data) => writeToPty(ptyId, data));

        // Синхронизируем PTY с реальным размером xterm (fit уже был вызван до spawn)
        resizePty(ptyId, term.cols, term.rows).catch(() => {});

        // Изменение размера → PTY
        term.onResize(({ cols, rows }) => resizePty(ptyId, cols, rows));

        // Стартовые команды — каждая строка выполняется с задержкой
        if (consoleConfig?.startupCmd) {
          const lines = consoleConfig.startupCmd
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          lines.forEach((line, i) => {
            setTimeout(() => writeToPty(ptyId, line + "\n"), 500 + i * 400);
          });
        }
      } catch (e) {
        term.write(`\x1b[31m${i18n.t("terminalPanel.ptyError", { error: e })}\x1b[0m\r\n`);
      }
    })();

    return () => {
      disposed = true;
      unlistenRef.current?.();
      if (ptyIdRef.current !== null) {
        killPty(ptyIdRef.current).catch(() => {});
      }
      term.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fit при переключении на активную вкладку ──
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      // display:none → display:flex требует один rAF чтобы браузер пересчитал layout
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [isActive]);

  // ── ResizeObserver: fit при изменении размера панели ──
  useEffect(() => {
    if (!containerRef.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      // Немедленный fit + отложенный, чтобы поймать финальный размер после анимаций сплиттера
      fitAddonRef.current?.fit();
      clearTimeout(timer);
      timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
    });
    observer.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // ── Действия контекстного меню ──
  const menuCopy = () => {
    const term = termRef.current;
    const sel = term?.getSelection();
    if (sel) navigator.clipboard.writeText(sel).catch(() => {});
  };
  const menuPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) termRef.current?.paste(text);
    } catch {
      /* буфер недоступен */
    }
  };
  const menuSelectAll = () => termRef.current?.selectAll();
  // Ctrl+E (в конец строки) + Ctrl+U (удалить до начала) — очищает всю строку ввода
  const menuClearLine = () => {
    if (ptyIdRef.current !== null) writeToPty(ptyIdRef.current, "\x05\x15");
  };
  // term.clear() оставляет текущую строку приглашения, убирает историю выше
  const menuClearScreen = () => termRef.current?.clear();
  // Полный сброс xterm (включая «залипшие» SGR-цвета) + перерисовка приглашения шелла
  const menuReset = () => {
    termRef.current?.reset();
    if (ptyIdRef.current !== null) writeToPty(ptyIdRef.current, "\x0c");
    requestAnimationFrame(() => fitAddonRef.current?.fit());
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
          onSelectAll={menuSelectAll}
          onClearLine={menuClearLine}
          onClearScreen={menuClearScreen}
          onReset={menuReset}
        />
      )}
      {/* Danger banner */}
      {isDanger && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b-2 border-red-500/70" style={{ background: "rgba(220,38,38,0.18)" }}>
          <span className="text-red-400 text-sm leading-none">⚠</span>
          <span className="text-red-300 font-bold text-xs tracking-widest uppercase">{dangerLabel}</span>
          <span className="text-red-400/50 text-xs">—</span>
          <DangerWarning label={dangerLabel} />
        </div>
      )}
      {/* Terminal container с красноватым фоном для опасных */}
      <div
        className="flex-1 overflow-hidden p-1"
        style={isDanger ? { backgroundColor: "rgba(220,38,38,0.045)" } : undefined}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function DangerWarning({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <span className="text-red-400/60 text-2xs">
      {t("terminalPanel.dangerWarning", { label })}
    </span>
  );
}

// ══════════════════════════════════════
// Контекстное меню терминала (ПКМ)
// ══════════════════════════════════════

function TerminalContextMenu({
  x,
  y,
  hasSelection,
  onClose,
  onCopy,
  onPaste,
  onSelectAll,
  onClearLine,
  onClearScreen,
  onReset,
}: {
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
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuWidth = 200;
  const px = Math.min(x, window.innerWidth - menuWidth - 8);
  const py = Math.min(y, window.innerHeight - 240);

  const wrap = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const items: ({ label: string; icon: string; action: () => void; disabled?: boolean } | "separator")[] = [
    { label: t("terminalContextMenu.copy"), icon: "⧉", action: wrap(onCopy), disabled: !hasSelection },
    { label: t("terminalContextMenu.paste"), icon: "⇪", action: wrap(onPaste) },
    { label: t("terminalContextMenu.selectAll"), icon: "▦", action: wrap(onSelectAll) },
    "separator",
    { label: t("terminalContextMenu.clearLine"), icon: "⌫", action: wrap(onClearLine) },
    { label: t("terminalContextMenu.clearScreen"), icon: "▢", action: wrap(onClearScreen) },
    { label: t("terminalContextMenu.reset"), icon: "↺", action: wrap(onReset) },
  ];

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ top: py, left: px, width: menuWidth }}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-3 flex items-center gap-2 text-text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default"
            onClick={item.action}
          >
            <span className="w-4 text-center opacity-60">{item.icon}</span>
            {item.label}
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