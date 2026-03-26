import { create } from "zustand";
import type {
  Workspace,
  Project,
  ConsoleConfig,
  TerminalSession,
  WikiPage,
  SelectedNode,
  TreeNode,
} from "../types";

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

  // ── Wiki ──
  currentWikiPages: WikiPage[];
  activeWikiPageId: string | null;

  // ── UI State ──
  showTreePanel: boolean;
  showWikiPanel: boolean;
  treePanelWidth: number;
  wikiPanelWidth: number;

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

  // ── Actions: терминал ──
  openSession: (session: TerminalSession) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;

  // ── Actions: wiki ──
  setWikiPages: (pages: WikiPage[]) => void;
  setActiveWikiPage: (id: string | null) => void;
  addWikiPage: (page: WikiPage) => void;
  updateWikiPage: (id: string, updates: Partial<WikiPage>) => void;
  removeWikiPage: (id: string) => void;

  // ── Actions: UI ──
  toggleTreePanel: () => void;
  toggleWikiPanel: () => void;
  setTreePanelWidth: (width: number) => void;
  setWikiPanelWidth: (width: number) => void;

  // ── Toast ──
  toasts: Toast[];
  showToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;

  // ── Helpers ──
  getFlatTree: () => TreeNode[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Initial state ──
  workspaces: [],
  selectedNode: null,
  sessions: [],
  activeSessionId: null,
  currentWikiPages: [],
  activeWikiPageId: null,
  showTreePanel: true,
  showWikiPanel: true,
  treePanelWidth: 250,
  wikiPanelWidth: 350,
  toasts: [],

  // ── Дерево ──
  setWorkspaces: (workspaces) => set({ workspaces }),

  selectNode: (node) => set({ selectedNode: node }),

  toggleNodeExpanded: (type, id) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) => {
        if (type === "workspace" && ws.id === id) {
          return { ...ws, is_expanded: !ws.is_expanded };
        }
        return {
          ...ws,
          projects: ws.projects.map((proj) => {
            if (type === "project" && proj.id === id) {
              return { ...proj, is_expanded: !proj.is_expanded };
            }
            return proj;
          }),
        };
      }),
    })),

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

  // ── Терминал ──
  openSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    })),

  closeSession: (sessionId) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== sessionId);
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === sessionId
            ? remaining[remaining.length - 1]?.id ?? null
            : state.activeSessionId,
      };
    }),

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

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
  toggleTreePanel: () =>
    set((state) => ({ showTreePanel: !state.showTreePanel })),
  toggleWikiPanel: () =>
    set((state) => ({ showWikiPanel: !state.showWikiPanel })),
  setTreePanelWidth: (width) => set({ treePanelWidth: width }),
  setWikiPanelWidth: (width) => set({ wikiPanelWidth: width }),

  // ── Toast ──
  showToast: (type, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${Date.now()}`, type, message }],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

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
                icon: "terminal",
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
