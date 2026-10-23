import { create } from "zustand";
import { setSetting as persistSetting, setNodeExpanded as persistNodeExpanded } from "../lib/tauriCommands";
import type {
  AiSession,
  ConsoleConfig,
  Project,
  SelectedNode,
  TerminalSession,
  TreeNode,
  WikiPage,
  Workspace,
} from "../types";
import type { ChatMessage } from "../lib/aiProviders";
import { allConsoles, flattenTree } from "../lib/tree";

// ══════════════════════════════════════════════
// App Store — центральное хранилище состояния интерфейса
// ══════════════════════════════════════════════
// Дерево — копия того, что лежит в БД: компоненты сначала вызывают команду,
// потом правят дерево здесь. Сессии терминала, вкладки, тосты и состояние
// панелей живут только в памяти.
//
// Правила:
//  - активная вкладка и выбранный узел дерева синхронны: wiki и AI-панель
//    читают контекст из selectedNode, поэтому переключение вкладки ведёт их за
//    собой так же, как клик по дереву; побеждает последнее действие;
//  - экземпляры одной консоли в `sessions` идут подряд: порядок массива =
//    порядок вкладок (вкладка → подвкладки), по нему же ходит Cmd+Tab;
//  - флаги панелей, раскрытие узлов и недавние консоли сохраняются в БД сразу;
//    не сохранилось — в интерфейсе уже применено, при следующем запуске
//    вернётся прежнее (ошибка — в консоль разработчика).

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

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
  // Перейти к консоли: к последнему открытому экземпляру, а если их нет — открыть.
  // newInstance — всегда новый экземпляр (отдельный PTY в подвкладке).
  openConsole: (consoleId: string, title: string, newInstance?: boolean) => void;
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
  // В стор сразу, в БД — «по возможности» (см. правила в шапке)
  saveSetting: (key: string, value: string) => void;

  // ── Helpers ──
  /** Видимые узлы дерева по порядку: содержимое свёрнутых узлов не попадает */
  getFlatTree: () => TreeNode[];
}

// Недавние консоли: id в порядке использования, свежие первыми, в настройке
// ui.recentConsoles. Храним с запасом — удалённые консоли отсеиваются при показе.
const RECENT_CONSOLES_KEY = "ui.recentConsoles";
const RECENT_CONSOLES_STORED = 20;

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
    const { workspaces } = get();

    const node =
      type === "workspace"
        ? workspaces.find((ws) => ws.id === id)
        : workspaces.flatMap((ws) => ws.projects).find((p) => p.id === id);

    // Консоль не раскрывается
    if (!node) return;

    const isExpanded = !node.isExpanded;

    set((state) => ({
      workspaces:
        type === "workspace"
          ? state.workspaces.map((ws) => (ws.id === id ? { ...ws, isExpanded } : ws))
          : mapProjects(state.workspaces, (p) => (p.id === id ? { ...p, isExpanded } : p)),
    }));

    persist(persistNodeExpanded(id, type, isExpanded), `expanded ${type} ${id}`);
  },

  addWorkspace: (workspace) => set((state) => ({ workspaces: [...state.workspaces, workspace] })),

  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => (ws.id === id ? { ...ws, ...updates } : ws)),
    })),

  removeWorkspace: (id) => set((state) => ({ workspaces: state.workspaces.filter((ws) => ws.id !== id) })),

  addProject: (workspaceId, project) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId ? { ...ws, projects: [...ws.projects, project] } : ws
      ),
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      workspaces: mapProjects(state.workspaces, (p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeProject: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => ({ ...ws, projects: ws.projects.filter((p) => p.id !== id) })),
    })),

  addConsole: (projectId, console_) =>
    set((state) => ({
      workspaces: mapProjects(state.workspaces, (p) =>
        p.id === projectId ? { ...p, consoles: [...p.consoles, console_] } : p
      ),
    })),

  updateConsole: (id, updates) =>
    set((state) => ({
      workspaces: mapProjects(state.workspaces, (p) => ({
        ...p,
        consoles: p.consoles.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
    })),

  removeConsole: (id) =>
    set((state) => ({
      workspaces: mapProjects(state.workspaces, (p) => ({ ...p, consoles: p.consoles.filter((c) => c.id !== id) })),
    })),

  // Консоль встаёт в конец списка проекта-получателя
  moveConsoleToProject: (consoleId, targetProjectId) =>
    set((state) => {
      const moved = allConsoles(state.workspaces).find((ref) => ref.console.id === consoleId)?.console;

      if (!moved) return {};

      const relocated = { ...moved, projectId: targetProjectId };

      return {
        workspaces: mapProjects(state.workspaces, (p) => {
          const consoles = p.consoles.filter((c) => c.id !== consoleId);

          return { ...p, consoles: p.id === targetProjectId ? [...consoles, relocated] : consoles };
        }),
      };
    }),

  // ── Терминал ──
  openConsole: (consoleId, title, newInstance = false) => {
    if (!newInstance && get().activateConsole(consoleId)) return;

    get().openSession({ id: `session-${Date.now()}`, console_id: consoleId, title, is_active: true });
  },

  openSession: (session) => {
    set((state) => {
      const added = { ...session, instance: session.instance ?? nextInstance(state.sessions, session.console_id) };

      return {
        sessions: insertAfterGroup(state.sessions, added),
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

      // Закрыли запомненный экземпляр — помним соседний из той же консоли
      const lastSessionByConsole = { ...state.lastSessionByConsole };

      if (lastSessionByConsole[closed.console_id] === sessionId) {
        const fallback = last(siblings);

        if (fallback) lastSessionByConsole[closed.console_id] = fallback.id;
        else delete lastSessionByConsole[closed.console_id];
      }

      if (state.activeSessionId !== sessionId) return { sessions: remaining, lastSessionByConsole };

      // Закрыли активную вкладку — фокус сначала на другой экземпляр той же
      // консоли, иначе на последнюю вкладку; контекст идёт за ней.
      // Если вкладок не осталось, selectedNode оставляем как есть.
      const next = last(siblings) ?? last(remaining);

      return {
        sessions: remaining,
        activeSessionId: next?.id ?? null,
        lastSessionByConsole,
        selectedNode: next ? { type: "console" as const, id: next.console_id } : state.selectedNode,
      };
    }),

  setActiveSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);

    if (!session) {
      set({ activeSessionId: sessionId });

      return;
    }

    set((state) => ({
      activeSessionId: sessionId,
      selectedNode: { type: "console" as const, id: session.console_id },
      lastSessionByConsole: { ...state.lastSessionByConsole, [session.console_id]: session.id },
    }));

    get().touchRecentConsole(session.console_id);
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

  moveConsoleTab: (consoleId, beforeConsoleId) =>
    set((state) => {
      const sessions = moveConsoleGroup(state.sessions, consoleId, beforeConsoleId);

      return sessions ? { sessions } : {};
    }),

  moveSessionTab: (sessionId, beforeSessionId) =>
    set((state) => {
      const sessions = moveWithinGroup(state.sessions, sessionId, beforeSessionId);

      return sessions ? { sessions } : {};
    }),

  touchRecentConsole: (consoleId) => {
    const ids = parseRecentConsoles(get().settings[RECENT_CONSOLES_KEY]);

    // Уже первая — не пишем в БД на каждое переключение вкладки
    if (ids[0] === consoleId) return;

    saveRecentConsoles([consoleId, ...ids.filter((id) => id !== consoleId)].slice(0, RECENT_CONSOLES_STORED));
  },

  removeRecentConsole: (consoleId) =>
    saveRecentConsoles(parseRecentConsoles(get().settings[RECENT_CONSOLES_KEY]).filter((id) => id !== consoleId)),

  clearRecentConsoles: () => saveRecentConsoles([]),

  reconnectSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, reconnectKey: (s.reconnectKey ?? 0) + 1 } : s)),
    })),

  // ── Wiki ──
  setWikiPages: (pages) => set({ currentWikiPages: pages, activeWikiPageId: pages[0]?.id ?? null }),

  setActiveWikiPage: (id) => set({ activeWikiPageId: id }),

  addWikiPage: (page) =>
    set((state) => ({ currentWikiPages: [page, ...state.currentWikiPages], activeWikiPageId: page.id })),

  updateWikiPage: (id, updates) =>
    set((state) => ({
      currentWikiPages: state.currentWikiPages.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  // Удалили открытую страницу — открывается первая из оставшихся
  removeWikiPage: (id) =>
    set((state) => {
      const remaining = state.currentWikiPages.filter((p) => p.id !== id);

      const activeWikiPageId = state.activeWikiPageId === id ? remaining[0]?.id ?? null : state.activeWikiPageId;

      return { currentWikiPages: remaining, activeWikiPageId };
    }),

  // ── UI ──
  toggleTreePanel: () => {
    const next = !get().showTreePanel;

    set({ showTreePanel: next });

    persist(persistSetting("ui.showTreePanel", String(next)), "ui.showTreePanel");
  },

  toggleWikiPanel: () => {
    const next = !get().showWikiPanel;

    set({ showWikiPanel: next });

    persist(persistSetting("ui.showWikiPanel", String(next)), "ui.showWikiPanel");
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

    persist(persistSetting("ui.showAiPanel", String(next)), "ui.showAiPanel");
  },

  setShowAiPanel: (visible) => set({ showAiPanel: visible }),

  setAiPanelPosition: (pos) => {
    set({ aiPanelPosition: pos });

    get().saveSetting("ui.aiPanelPosition", pos);
  },

  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
  setAiPanelHeight: (h) => set({ aiPanelHeight: h }),
  setAiSessions: (sessions) => set({ aiSessions: sessions }),

  addAiSession: (session) => set((state) => ({ aiSessions: [session, ...state.aiSessions] })),

  updateAiSessionTitle: (id, title) =>
    set((state) => ({ aiSessions: state.aiSessions.map((s) => (s.id === id ? { ...s, title } : s)) })),

  // Удалили открытый чат — открывается первый из оставшихся
  removeAiSession: (id) =>
    set((state) => {
      const activeAiSessionId =
        state.activeAiSessionId === id
          ? state.aiSessions.find((s) => s.id !== id)?.id ?? null
          : state.activeAiSessionId;

      return { aiSessions: state.aiSessions.filter((s) => s.id !== id), activeAiSessionId };
    }),

  setActiveAiSessionId: (id) => set({ activeAiSessionId: id }),

  setAiMessages: (updater) =>
    set((state) => ({ aiMessages: typeof updater === "function" ? updater(state.aiMessages) : updater })),

  setAiStreamingMsgId: (id) => set({ aiStreamingMsgId: id }),
  setAiInput: (input) => set({ aiInput: input }),
  setAiIsStreaming: (v) => set({ aiIsStreaming: v }),

  // ── Toast ──
  showToast: (type, message) =>
    set((state) => ({ toasts: [...state.toasts, { id: `toast-${Date.now()}`, type, message }] })),

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // ── Settings ──
  setSettings: (settings) => set({ settings }),

  setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),

  saveSetting: (key, value) => {
    get().setSetting(key, value);

    persist(persistSetting(key, value), key);
  },

  // ── Дерево для рендера ──
  getFlatTree: () => flattenTree(get().workspaces),
}));

export function parseRecentConsoles(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const ids = JSON.parse(raw);

    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// ── Детали ──

function saveRecentConsoles(ids: string[]) {
  useAppStore.getState().saveSetting(RECENT_CONSOLES_KEY, JSON.stringify(ids));
}

/** Сохранение в БД «по возможности»: в интерфейсе уже применено, при ошибке — только лог */
function persist(saving: Promise<unknown>, what: string) {
  saving.catch((e) => console.warn(`Не сохранилось: ${what}`, e));
}

/** Применить `fn` к каждому проекту дерева */
function mapProjects(workspaces: Workspace[], fn: (p: Project) => Project): Workspace[] {
  return workspaces.map((ws) => ({ ...ws, projects: ws.projects.map(fn) }));
}

/** Номер следующего экземпляра консоли: на 1 больше наибольшего открытого */
function nextInstance(sessions: TerminalSession[], consoleId: string): number {
  const group = sessions.filter((s) => s.console_id === consoleId);

  return Math.max(0, ...group.map((s) => s.instance ?? 1)) + 1;
}

/** Новый экземпляр — сразу за последним экземпляром своей консоли, иначе в конец */
function insertAfterGroup(sessions: TerminalSession[], added: TerminalSession): TerminalSession[] {
  const lastIdx = lastIndexWhere(sessions, (s) => s.console_id === added.console_id);

  if (lastIdx === -1) return [...sessions, added];

  return [...sessions.slice(0, lastIdx + 1), added, ...sessions.slice(lastIdx + 1)];
}

/** Все экземпляры консоли — перед первой вкладкой beforeConsoleId (null или не найдена — в конец).
 *  null — перестановка ничего не меняет. */
function moveConsoleGroup(
  sessions: TerminalSession[],
  consoleId: string,
  beforeConsoleId: string | null
): TerminalSession[] | null {
  if (consoleId === beforeConsoleId) return null;

  const moved = sessions.filter((s) => s.console_id === consoleId);
  const rest = sessions.filter((s) => s.console_id !== consoleId);

  const at = beforeConsoleId ? rest.findIndex((s) => s.console_id === beforeConsoleId) : -1;
  const idx = at === -1 ? rest.length : at;

  return [...rest.slice(0, idx), ...moved, ...rest.slice(idx)];
}

/** Экземпляр — перед beforeSessionId своей же консоли (null или чужая — в конец своей группы).
 *  null — перестановка ничего не меняет. */
function moveWithinGroup(
  sessions: TerminalSession[],
  sessionId: string,
  beforeSessionId: string | null
): TerminalSession[] | null {
  const moved = sessions.find((s) => s.id === sessionId);

  if (!moved || sessionId === beforeSessionId) return null;

  const rest = sessions.filter((s) => s.id !== sessionId);

  const sameGroup = (s: TerminalSession) => s.console_id === moved.console_id;

  // Единственный экземпляр — переставлять внутри группы нечего
  if (!rest.some(sameGroup)) return null;

  const before = beforeSessionId ? rest.findIndex((s) => s.id === beforeSessionId && sameGroup(s)) : -1;
  const idx = before === -1 ? lastIndexWhere(rest, sameGroup) + 1 : before;

  return [...rest.slice(0, idx), moved, ...rest.slice(idx)];
}

// Array.at / findLastIndex — ES2022+, а сборка нацелена на ES2021 (WebKit старых macOS)
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function lastIndexWhere<T>(items: T[], pred: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (pred(items[i])) return i;

  return -1;
}
