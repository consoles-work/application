import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../stores/appStore";
import { spawnPty, writeToPty, resizePty, killPty } from "../lib/tauriCommands";
import type { TerminalSession, ConsoleConfig, Project } from "../types";

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
  const { sessions, activeSessionId, setActiveSession, closeSession } =
    useAppStore();

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* ── Вкладки ── */}
      <div className="h-9 flex items-center bg-surface-1 border-b border-border shrink-0 overflow-x-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`terminal-tab ${
              session.id === activeSessionId ? "active" : ""
            }`}
            onClick={() => setActiveSession(session.id)}
          >
            <span className="truncate max-w-[120px]">{session.title}</span>
            <button
              className="ml-1 text-text-muted hover:text-danger text-xs"
              style={{ opacity: session.id === activeSessionId ? 0.6 : 0 }}
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
            >
              ×
            </button>
          </div>
        ))}

        {sessions.length === 0 && (
          <span className="px-3 text-xs text-text-muted">
            Выберите консоль в дереве →
          </span>
        )}
      </div>

      {/* ── Терминальные инстансы (все рендерятся, только активный виден) ── */}
      <div className="flex-1 overflow-hidden relative">
        {sessions.map((session) => (
          <TerminalView
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
          />
        ))}
        {sessions.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// TerminalView — один xterm.js инстанс
// ══════════════════════════════════════

function TerminalView({
  session,
  isActive,
}: {
  session: TerminalSession;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // ── Инициализация: создаём terminal и PTY ──
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: "JetBrains Mono, Menlo, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
        black: "#484f58",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ff7b72",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Находим консоль и проект для определения шелла и рабочей директории
    const consoleConfig = findConsoleById(session.console_id);
    const project = findProjectForConsole(session.console_id);

    const shell = consoleConfig?.shell_override || project?.default_shell || "";
    const cwd = consoleConfig?.cwd_override || project?.path || "";
    const envVars = { ...project?.env_vars, ...consoleConfig?.env_vars };

    // Запускаем PTY и подключаем всё
    let disposed = false;

    (async () => {
      try {
        const ptyId = await spawnPty(shell, cwd, envVars ?? {});
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

        // Изменение размера → PTY
        term.onResize(({ cols, rows }) => resizePty(ptyId, cols, rows));

        // Стартовая команда (если задана)
        if (consoleConfig?.startup_cmd) {
          setTimeout(
            () => writeToPty(ptyId, consoleConfig.startup_cmd! + "\n"),
            300
          );
        }
      } catch (e) {
        term.write(`\x1b[31mОшибка запуска PTY: ${e}\x1b[0m\r\n`);
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
      // Небольшая задержка чтобы CSS display успел примениться
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [isActive]);

  // ── ResizeObserver: fit при изменении размера панели ──
  useEffect(() => {
    if (!containerRef.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
    });
    observer.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="absolute inset-0 p-1"
      style={{ display: isActive ? "block" : "none" }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-text-muted">
      <div className="text-4xl mb-4">💻</div>
      <div className="text-sm font-medium mb-1">Нет открытых терминалов</div>
      <div className="text-xs">Кликните на консоль в дереве проектов слева</div>
    </div>
  );
}