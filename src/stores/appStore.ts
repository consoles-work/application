import { create } from "zustand";
import { setSetting as persistSetting, setNodeExpanded as persistNodeExpanded } from "../lib/tauriCommands";
import type {
  Workspace,
  Project,
  ConsoleConfig,
  TerminalSession,
  WikiPage,
  SelectedNode,
  TreeNode,
} from "../types";
import type { ChatMessage } from "../lib/aiProviders";
import type { AiSession } from "../types";

// Недавние консоли: id в порядке использования, свежие первыми, в настройке
// ui.recentConsoles. Храним с запасом — удалённые консоли отсеиваются при показе.
const RECENT_CONSOLES_KEY = "ui.recentConsoles";
const RECENT_CONSOLES_STORED = 20;

export function parseRecentConsoles(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

// ══════════════════════════════════════════════
// App Store — центральное хранилище состояния
// ══════════════════════════════════════════════

interface AppState {
  // ── Дерево проектов ──
  workspaces: Workspace[];
  selectedNode: SelectedNode | null;

  // ── Терминальные сессии (runtime) ──
  sessions: TerminalSession[];
  activeSessionId: string | null;
  // Последний активный экземпляр каждой консоли — к нему ведёт клик по
  // консоли в дереве и по верхней вкладке, когда экземпляров несколько
  lastSessionByConsole: Record<string, string>;

  // ── Wiki ──
  currentWikiPages: WikiPage[];
  activeWikiPageId: string | null;

  // ── UI State ──
  showTreePanel: boolean;
  showWikiPanel: boolean;
  treePanelWidth: number;
  wikiPanelWidth: number;

  // ── AI Panel ──
  terminalSelection: string;
  setTerminalSelection: (sel: string) => void;
  showAiPanel: boolean;
  toggleAiPanel: () => void;
  setShowAiPanel: (visible: boolean) => void;
  aiPanelPosition: "right" | "bottom";
  setAiPanelPosition: (pos: "right" | "bottom") => void;
  aiPanelWidth: number;
  setAiPanelWidth: (w: number) => void;
  aiPanelHeight: number;
  setAiPanelHeight: (h: number) => void;
  // Сессии чата
  aiSessions: AiSession[];
  setAiSessions: (sessions: AiSession[]) => void;
  addAiSession: (session: AiSession) => void;
  updateAiSessionTitle: (id: string, title: string) => void;
  removeAiSession: (id: string) => void;
  activeAiSessionId: string | null;
  setActiveAiSessionId: (id: string | null) => void;
  // Сообщения чата — в store, чтобы не терялись при смене позиции панели
  aiMessages: ChatMessage[];
  setAiMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  // Маппинг id сессии → id сообщения ассистента (для финализации стриминга)
  aiStreamingMsgId: string | null;
  setAiStreamingMsgId: (id: string | null) => void;
  aiInput: string;
  setAiInput: (input: string) => void;
  aiIsStreaming: boolean;
  setAiIsStreaming: (v: boolean) => void;

  // ── Actions: дерево ──
  setWorkspaces: (workspaces: Workspace[]) => void;
  selectNode: (node: SelectedNode | null) => void;
  toggleNodeExpanded: (type: string, id: string) => void;

  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;

  addProject: (workspaceId: string, project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  addConsole: (projectId: string, console_: ConsoleConfig) => void;
  updateConsole: (id: string, updates: Partial<ConsoleConfig>) => void;
  removeConsole: (id: string) => void;
  moveConsoleToProject: (consoleId: string, targetProjectId: string) => void;

  // ── Actions: терминал ──
  openSession: (session: TerminalSession) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  reconnectSession: (sessionId: string) => void;
  // Активировать последний экземпляр консоли; false — если у неё нет открытых сессий
  activateConsole: (consoleId: string) => boolean;
  // Перетаскивание вкладок: консоль целиком встаёт перед вкладкой beforeConsoleId,
  // экземпляр — перед beforeSessionId своей же консоли (null — в конец)
  moveConsoleTab: (consoleId: string, beforeConsoleId: string | null) => void;
  moveSessionTab: (sessionId: string, beforeSessionId: string | null) => void;
  // Поднять консоль в начало списка недавних
  touchRecentConsole: (consoleId: string) => void;
  removeRecentConsole: (consoleId: string) => void;
  clearRecentConsoles: () => void;

  // ── Actions: wiki ──
  setWikiPages: (pages: WikiPage[]) => void;
  setActiveWikiPage: (id: string | null) => void;
  addWikiPage: (page: WikiPage) => void;
  updateWikiPage: (id: string, updates: Partial<WikiPage>) => void;
  removeWikiPage: (id: string) => void;

  // ── Actions: UI ──
  toggleTreePanel: () => void;
  toggleWikiPanel: () => void;
  setShowTreePanel: (visible: boolean) => void;
  setShowWikiPanel: (visible: boolean) => void;
  setTreePanelWidth: (width: number) => void;
  setWikiPanelWidth: (width: number) => void;

  // ── Toast ──
  toasts: Toast[];
  showToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;

  // ── Settings ──
  settings: Record<string, string>;
  setSettings: (settings: Record<string, string>) => void;
  setSetting: (key: string, value: string) => void;

  // ── Helpers ──
  getFlatTree: () => TreeNode[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Initial state ──
  workspaces: [],
  selectedNode: null,
  sessions: [],
  activeSessionId: null,
  lastSessionByConsole: {},
  currentWikiPages: [],
  activeWikiPageId: null,
  showTreePanel: true,
  showWikiPanel: true,
  treePanelWidth: 280,
  wikiPanelWidth: 350,
  terminalSelection: "",
  showAiPanel: false,
  aiPanelPosition: "right",
  aiPanelWidth: 360,
  aiPanelHeight: 300,
  aiSessions: [],
  activeAiSessionId: null,
  aiMessages: [],
  aiStreamingMsgId: null,
  aiInput: "",
  aiIsStreaming: false,
  toasts: [],
  settings: {},

  // ── Дерево ──
  setWorkspaces: (workspaces) => set({ workspaces }),

  selectNode: (node) => set({ selectedNode: node }),

  toggleNodeExpanded: (type, id) => {
    // Читаем текущее состояние через get() до вызова set()
    const { workspaces } = get();
    let nextExpanded = false;
    outer: for (const ws of workspaces) {
      if (type === "workspace" && ws.id === id) {
        nextExpanded = !ws.is_expanded;
        break;
      }
      for (const proj of ws.projects) {
        if (type === "project" && proj.id === id) {
          nextExpanded = !proj.is_expanded;
          break outer;
        }
      }
    }
    set((state) => ({
      workspaces: state.workspaces.map((ws) => {
        if (type === "workspace" && ws.id === id) {
          return { ...ws, is_expanded: nextExpanded };
        }
        return {
          ...ws,
          projects: ws.projects.map((proj) =>
            type === "project" && proj.id === id
              ? { ...proj, is_expanded: nextExpanded }
              : proj
          ),
        };
      }),
    }));
    persistNodeExpanded(id, type, nextExpanded).catch(() => {});
  },

  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),

  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === id ? { ...ws, ...updates } : ws
      ),
    })),

  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((ws) => ws.id !== id),
    })),

  addProject: (workspaceId, project) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, projects: [...ws.projects, project] }
          : ws
      ),
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
    })),

  removeProject: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.filter((p) => p.id !== id),
      })),
    })),

  addConsole: (projectId, console_) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === projectId
            ? { ...p, consoles: [...p.consoles, console_] }
            : p
        ),
      })),
    })),

  updateConsole: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => ({
          ...p,
          consoles: p.consoles.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      })),
    })),

  removeConsole: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => ({
          ...p,
          consoles: p.consoles.filter((c) => c.id !== id),
        })),
      })),
    })),

  moveConsoleToProject: (consoleId, targetProjectId) =>
    set((state) => {
      let movedConsole: ConsoleConfig | null = null;
      const updated = state.workspaces.map((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => {
          const found = p.consoles.find((c) => c.id === consoleId);
          if (found) {
            movedConsole = { ...found, projectId: targetProjectId } as ConsoleConfig;
            return { ...p, consoles: p.consoles.filter((c) => c.id !== consoleId) };
          }
          return p;
        }),
      }));
      if (!movedConsole) return {};
      const con = movedConsole;
      return {
        workspaces: updated.map((ws) => ({
          ...ws,
          projects: ws.projects.map((p) =>
            p.id === targetProjectId
              ? { ...p, consoles: [...p.consoles, con] }
              : p
          ),
        })),
      };
    }),

  // ── Терминал ──
  // Активная вкладка и выбранный узел дерева держатся синхронно: вики и AI-панель
  // читают контекст из selectedNode, поэтому переключение вкладки должно вести
  // их за собой ровно так же, как клик по дереву. Побеждает последнее действие.
  // Экземпляры одной консоли держим в массиве подряд: так порядок sessions
  // совпадает с визуальным (вкладка → подвкладки) и Cmd+Tab идёт по порядку.
  openSession: (session) => {
    set((state) => {
      const group = state.sessions.filter((s) => s.console_id === session.console_id);
      const instance =
        session.instance ?? Math.max(0, ...group.map((s) => s.instance ?? 1)) + 1;
      const added = { ...session, instance };
      let lastIdx = -1;
      state.sessions.forEach((s, i) => {
        if (s.console_id === session.console_id) lastIdx = i;
      });
      const sessions =
        lastIdx === -1
          ? [...state.sessions, added]
          : [...state.sessions.slice(0, lastIdx + 1), added, ...state.sessions.slice(lastIdx + 1)];
      return {
        sessions,
        activeSessionId: added.id,
        selectedNode: { type: "console", id: added.console_id },
        lastSessionByConsole: { ...state.lastSessionByConsole, [added.console_id]: added.id },
      };
    });
    get().touchRecentConsole(session.console_id);
  },

  closeSession: (sessionId) =>
    set((state) => {
      const closed = state.sessions.find((s) => s.id === sessionId);
      if (!closed) return {};
      const remaining = state.sessions.filter((s) => s.id !== sessionId);
      const siblings = remaining.filter((s) => s.console_id === closed.console_id);

      // Если закрыли запомненный экземпляр — помним соседний из той же группы
      const lastSessionByConsole = { ...state.lastSessionByConsole };
      if (lastSessionByConsole[closed.console_id] === sessionId) {
        if (siblings.length > 0) {
          lastSessionByConsole[closed.console_id] = siblings[siblings.length - 1].id;
        } else {
          delete lastSessionByConsole[closed.console_id];
        }
      }

      if (state.activeSessionId !== sessionId) {
        return { sessions: remaining, lastSessionByConsole };
      }
      // Закрыли активную вкладку — фокус сначала на другой экземпляр той же
      // консоли, иначе на последнюю вкладку; контекст идёт за ней.
      // Если вкладок не осталось, selectedNode оставляем как есть.
      const next =
        (siblings.length > 0 ? siblings[siblings.length - 1] : remaining[remaining.length - 1]) ?? null;
      return {
        sessions: remaining,
        activeSessionId: next?.id ?? null,
        lastSessionByConsole,
        selectedNode: next
          ? { type: "console" as const, id: next.console_id }
          : state.selectedNode,
      };
    }),

  setActiveSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    set((state) => ({
      activeSessionId: sessionId,
      selectedNode: session
        ? { type: "console" as const, id: session.console_id }
        : state.selectedNode,
      lastSessionByConsole: session
        ? { ...state.lastSessionByConsole, [session.console_id]: session.id }
        : state.lastSessionByConsole,
    }));
    if (session) get().touchRecentConsole(session.console_id);
  },

  activateConsole: (consoleId) => {
    const { sessions, lastSessionByConsole, setActiveSession } = get();
    const target =
      sessions.find((s) => s.id === lastSessionByConsole[consoleId]) ??
      sessions.find((s) => s.console_id === consoleId);
    if (!target) return false;
    setActiveSession(target.id);
    return true;
  },

  // Экземпляры консоли переезжают группой — порядок sessions остаётся «подряд»
  moveConsoleTab: (consoleId, beforeConsoleId) =>
    set((state) => {
      if (consoleId === beforeConsoleId) return {};
      const moved = state.sessions.filter((s) => s.console_id === consoleId);
      const rest = state.sessions.filter((s) => s.console_id !== consoleId);
      const at = beforeConsoleId ? rest.findIndex((s) => s.console_id === beforeConsoleId) : -1;
      const idx = at === -1 ? rest.length : at;
      return { sessions: [...rest.slice(0, idx), ...moved, ...rest.slice(idx)] };
    }),

  moveSessionTab: (sessionId, beforeSessionId) =>
    set((state) => {
      const moved = state.sessions.find((s) => s.id === sessionId);
      if (!moved || sessionId === beforeSessionId) return {};
      const rest = state.sessions.filter((s) => s.id !== sessionId);
      if (!rest.some((s) => s.console_id === moved.console_id)) return {};
      let idx = beforeSessionId
        ? rest.findIndex((s) => s.id === beforeSessionId && s.console_id === moved.console_id)
        : -1;
      if (idx === -1) {
        // В конец своей группы
        rest.forEach((s, i) => {
          if (s.console_id === moved.console_id) idx = i;
        });
        idx += 1;
      }
      return { sessions: [...rest.slice(0, idx), moved, ...rest.slice(idx)] };
    }),

  touchRecentConsole: (consoleId) => {
    const ids = parseRecentConsoles(get().settings[RECENT_CONSOLES_KEY]);
    if (ids[0] === consoleId) return; // уже первая — не пишем в БД на каждое переключение
    const value = JSON.stringify(
      [consoleId, ...ids.filter((id) => id !== consoleId)].slice(0, RECENT_CONSOLES_STORED)
    );
    set((state) => ({ settings: { ...state.settings, [RECENT_CONSOLES_KEY]: value } }));
    persistSetting(RECENT_CONSOLES_KEY, value).catch(() => {});
  },

  removeRecentConsole: (consoleId) => {
    const value = JSON.stringify(
      parseRecentConsoles(get().settings[RECENT_CONSOLES_KEY]).filter((id) => id !== consoleId)
    );
    set((state) => ({ settings: { ...state.settings, [RECENT_CONSOLES_KEY]: value } }));
    persistSetting(RECENT_CONSOLES_KEY, value).catch(() => {});
  },

  clearRecentConsoles: () => {
    set((state) => ({ settings: { ...state.settings, [RECENT_CONSOLES_KEY]: "[]" } }));
    persistSetting(RECENT_CONSOLES_KEY, "[]").catch(() => {});
  },

  reconnectSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, reconnectKey: (s.reconnectKey ?? 0) + 1 } : s
      ),
    })),

  // ── Wiki ──
  setWikiPages: (pages) => set({ currentWikiPages: pages, activeWikiPageId: pages[0]?.id ?? null }),
  setActiveWikiPage: (id) => set({ activeWikiPageId: id }),
  addWikiPage: (page) =>
    set((state) => ({
      currentWikiPages: [page, ...state.currentWikiPages],
      activeWikiPageId: page.id,
    })),
  updateWikiPage: (id, updates) =>
    set((state) => ({
      currentWikiPages: state.currentWikiPages.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  removeWikiPage: (id) =>
    set((state) => {
      const remaining = state.currentWikiPages.filter((p) => p.id !== id);
      return {
        currentWikiPages: remaining,
        activeWikiPageId:
          state.activeWikiPageId === id
            ? (remaining[0]?.id ?? null)
            : state.activeWikiPageId,
      };
    }),

  // ── UI ──
  toggleTreePanel: () => {
    const next = !get().showTreePanel;
    set({ showTreePanel: next });
    persistSetting("ui.showTreePanel", next ? "true" : "false").catch(() => {});
  },
  toggleWikiPanel: () => {
    const next = !get().showWikiPanel;
    set({ showWikiPanel: next });
    persistSetting("ui.showWikiPanel", next ? "true" : "false").catch(() => {});
  },
  setShowTreePanel: (visible) => set({ showTreePanel: visible }),
  setShowWikiPanel: (visible) => set({ showWikiPanel: visible }),
  setTreePanelWidth: (width) => set({ treePanelWidth: width }),
  setWikiPanelWidth: (width) => set({ wikiPanelWidth: width }),

  // ── AI Panel ──
  setTerminalSelection: (sel) => set({ terminalSelection: sel }),
  toggleAiPanel: () => {
    const next = !get().showAiPanel;
    set({ showAiPanel: next });
    persistSetting("ui.showAiPanel", next ? "true" : "false").catch(() => {});
  },
  setShowAiPanel: (visible) => set({ showAiPanel: visible }),
  setAiPanelPosition: (pos) => {
    set({ aiPanelPosition: pos });
    persistSetting("ui.aiPanelPosition", pos).catch(() => {});
  },
  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
  setAiPanelHeight: (h) => set({ aiPanelHeight: h }),
  setAiSessions: (sessions) => set({ aiSessions: sessions }),
  addAiSession: (session) =>
    set((state) => ({ aiSessions: [session, ...state.aiSessions] })),
  updateAiSessionTitle: (id, title) =>
    set((state) => ({
      aiSessions: state.aiSessions.map((s) => s.id === id ? { ...s, title } : s),
    })),
  removeAiSession: (id) =>
    set((state) => ({
      aiSessions: state.aiSessions.filter((s) => s.id !== id),
      activeAiSessionId: state.activeAiSessionId === id
        ? (state.aiSessions.find((s) => s.id !== id)?.id ?? null)
        : state.activeAiSessionId,
    })),
  setActiveAiSessionId: (id) => set({ activeAiSessionId: id }),
  setAiMessages: (updater) =>
    set((state) => ({
      aiMessages: typeof updater === "function" ? updater(state.aiMessages) : updater,
    })),
  setAiStreamingMsgId: (id) => set({ aiStreamingMsgId: id }),
  setAiInput: (input) => set({ aiInput: input }),
  setAiIsStreaming: (v) => set({ aiIsStreaming: v }),

  // ── Toast ──
  showToast: (type, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${Date.now()}`, type, message }],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // ── Settings ──
  setSettings: (settings) => set({ settings }),
  setSetting: (key, value) =>
    set((state) => ({ settings: { ...state.settings, [key]: value } })),

  // ── Flat tree для рендера ──
  getFlatTree: () => {
    const { workspaces } = get();
    const nodes: TreeNode[] = [];

    for (const ws of workspaces) {
      nodes.push({
        id: ws.id,
        type: "workspace",
        name: ws.name,
        icon: ws.icon,
        color: ws.color,
        depth: 0,
        is_expanded: ws.is_expanded,
        has_children: ws.projects.length > 0,
        data: ws,
      });

      if (ws.is_expanded) {
        for (const proj of ws.projects) {
          nodes.push({
            id: proj.id,
            type: "project",
            name: proj.name,
            icon: proj.icon,
            color: proj.color,
            depth: 1,
            is_expanded: proj.is_expanded,
            has_children: proj.consoles.length > 0,
            data: proj,
          });

          if (proj.is_expanded) {
            for (const con of proj.consoles) {
              nodes.push({
                id: con.id,
                type: "console",
                name: con.name,
                icon: con.connectionType === "ssh" ? "S" : "L",
                color: proj.color,
                depth: 2,
                is_expanded: false,
                has_children: false,
                data: con,
              });
            }
          }
        }
      }
    }

    return nodes;
  },
}));
