import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Search, X } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { updateWorkspace, updateProject, updateConsole, setNodeDanger, cloneConsole, cloneProject } from "../lib/tauriCommands";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { CreateWorkspaceDialog } from "./dialogs/CreateWorkspaceDialog";
import { CreateProjectDialog } from "./dialogs/CreateProjectDialog";
import { CreateConsoleDialog } from "./dialogs/CreateConsoleDialog";
import { EditConsoleDialog } from "./dialogs/EditConsoleDialog";
import type { TreeNode, ConsoleConfig } from "../types";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════
// TreePanel — дерево проектов
// ══════════════════════════════════════

export function TreePanel() {
  const {
    workspaces,
    selectedNode,
    selectNode,
    toggleNodeExpanded,
    getFlatTree,
    updateWorkspace: storeUpdateWorkspace,
    updateProject: storeUpdateProject,
    updateConsole: storeUpdateConsole,
    addConsole: storeAddConsole,
    addProject: storeAddProject,
    openSession,
    sessions,
    setActiveSession,
    showToast,
  } = useAppStore();

  const nodes = getFlatTree();
  const { t } = useTranslation();

  // ── Контекстное меню ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ── Диалоги создания / редактирования ──
  const [createWorkspace, setCreateWorkspace] = useState(false);
  const [createProjectFor, setCreateProjectFor] = useState<string | null>(null);   // workspaceId
  const [createConsoleFor, setCreateConsoleFor] = useState<string | null>(null);   // projectId
  const [editConsole, setEditConsole] = useState<ConsoleConfig | null>(null);

  // ── Поиск по дереву ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus();
  }, [searchActive]);

  // Все узлы (включая свёрнутые) для поиска
  const allNodes = useMemo(() => {
    type FlatNode = { id: string; type: string; name: string; icon: string; color: string; breadcrumb: string; data: unknown };
    const result: FlatNode[] = [];
    for (const ws of workspaces) {
      result.push({ id: ws.id, type: "workspace", name: ws.name, icon: ws.icon, color: ws.color, breadcrumb: "", data: ws });
      for (const proj of ws.projects) {
        result.push({ id: proj.id, type: "project", name: proj.name, icon: proj.icon, color: proj.color, breadcrumb: ws.name, data: proj });
        for (const con of proj.consoles) {
          result.push({ id: con.id, type: "console", name: con.name, icon: "▶", color: proj.color, breadcrumb: `${ws.name} › ${proj.name}`, data: con });
        }
      }
    }
    return result;
  }, [workspaces]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter((n) => n.name.toLowerCase().includes(q));
  }, [searchQuery, allNodes]);

  const handleSearchSelect = (node: typeof allNodes[0]) => {
    selectNode({ type: node.type as "workspace" | "project" | "console", id: node.id });
    if (node.type === "console") {
      const existing = sessions.find((s) => s.console_id === node.id);
      if (existing) setActiveSession(existing.id);
      else openSession({ id: `session-${Date.now()}`, console_id: node.id, title: node.name, is_active: true });
    }
    setSearchQuery("");
    setSearchActive(false);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery("");
  };

  // ── Inline rename ──
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Фокус при начале переименования
  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  // Глобальный F2 для переименования выбранного узла
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2" && selectedNode && !renamingId) {
        const node = nodes.find(
          (n) => n.id === selectedNode.id && n.type === selectedNode.type
        );
        if (node) startRename(node);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNode, renamingId, nodes]);

  const startRename = (node: TreeNode) => {
    setRenamingId(node.id);
    setRenameValue(node.name);
  };

  const commitRename = async (node: TreeNode) => {
    const newName = renameValue.trim();
    setRenamingId(null);
    if (!newName || newName === node.name) return;
    try {
      if (node.type === "workspace") {
        const ws = node.data as { icon: string; color: string };
        await updateWorkspace(node.id, newName, ws.icon, ws.color);
        storeUpdateWorkspace(node.id, { name: newName });
      } else if (node.type === "project") {
        const proj = node.data as { icon: string; color: string; path: string; default_shell: string };
        await updateProject(node.id, newName, proj.icon, proj.color, proj.path, proj.default_shell);
        storeUpdateProject(node.id, { name: newName });
      } else {
        await updateConsole(node.id, newName);
        storeUpdateConsole(node.id, { name: newName });
      }
      showToast("success", t("treePanel.toastRenamedTo", { name: newName }));
    } catch (e) {
      showToast("error", t("treePanel.toastRenameError", { error: e }));
    }
  };

  const handleClick = (node: TreeNode) => {
    if (renamingId) return;
    selectNode({ type: node.type, id: node.id });

    if (node.type === "console") {
      const existing = sessions.find((s) => s.console_id === node.id);
      if (existing) {
        setActiveSession(existing.id);
      } else {
        openSession({
          id: `session-${Date.now()}`,
          console_id: node.id,
          title: node.name,
          is_active: true,
        });
      }
    } else {
      toggleNodeExpanded(node.type, node.id);
    }
  };

  const handleDoubleClick = (node: TreeNode) => {
    startRename(node);
  };

  const handleToggle = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    if (node.has_children || node.type !== "console") {
      toggleNodeExpanded(node.type, node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleToggleDanger = async (node: TreeNode) => {
    const data = node.data as { isDanger?: boolean; dangerLabel?: string };
    if (!data.isDanger) {
      const label = window.prompt(t("treePanel.dangerLabelPrompt"), data.dangerLabel || "PRODUCTION");
      if (label === null) return; // отмена
      const finalLabel = label.trim() || "PRODUCTION";
      try {
        await setNodeDanger(node.id, node.type, true, finalLabel);
        if (node.type === "project") storeUpdateProject(node.id, { isDanger: true, dangerLabel: finalLabel } as any);
        else if (node.type === "console") storeUpdateConsole(node.id, { isDanger: true, dangerLabel: finalLabel } as any);
      } catch (e) {
        showToast("error", t("treePanel.toastDangerError", { error: e }));
      }
    } else {
      try {
        await setNodeDanger(node.id, node.type, false, data.dangerLabel || "PRODUCTION");
        if (node.type === "project") storeUpdateProject(node.id, { isDanger: false } as any);
        else if (node.type === "console") storeUpdateConsole(node.id, { isDanger: false } as any);
      } catch (e) {
        showToast("error", t("treePanel.toastDangerError", { error: e }));
      }
    }
  };

  const handleCloneConsole = async (node: TreeNode) => {
    try {
      const cloned = await cloneConsole(node.id);
      // Ищем родительский проект через workspaces (project_id может быть projectId из-за camelCase)
      let projectId = "";
      for (const ws of workspaces) {
        for (const proj of ws.projects) {
          if (proj.consoles.some((c) => c.id === node.id)) {
            projectId = proj.id;
            break;
          }
        }
        if (projectId) break;
      }
      if (!projectId) {
        showToast("error", t("treePanel.toastParentProjectNotFound"));
        return;
      }
      storeAddConsole(projectId, cloned);
      showToast("success", t("treePanel.toastConsoleCloned", { name: cloned.name }));
    } catch (e) {
      showToast("error", t("treePanel.toastCloneError", { error: e }));
    }
  };

  const handleCloneProject = async (node: TreeNode) => {
    try {
      const cloned = await cloneProject(node.id);
      // Ищем родительский workspace через workspaces
      const parentWs = workspaces.find((ws) =>
        ws.projects.some((p) => p.id === node.id)
      );
      if (!parentWs) {
        showToast("error", t("treePanel.toastWorkspaceNotFound"));
        return;
      }
      storeAddProject(parentWs.id, cloned);
      showToast("success", t("treePanel.toastProjectCloned", { name: cloned.name }));
    } catch (e) {
      showToast("error", t("treePanel.toastCloneError", { error: e }));
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-surface-1">
        {/* Header */}
        <div className="h-9 flex items-center px-3 border-b border-border shrink-0 gap-2">
          {searchActive ? (
            <>
              <Search size={12} className="text-text-muted shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
                placeholder={t("treePanel.searchPlaceholder")}
                className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
              />
              <button onClick={closeSearch} className="text-text-muted hover:text-text-primary">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
                {t("treePanel.header")}
              </span>
              <button
                onClick={() => setSearchActive(true)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded"
                title={t("treePanel.searchTooltip")}
              >
                <Search size={13} />
              </button>
              <button
                className="text-text-muted hover:text-text-primary text-lg leading-none"
                title={t("treePanel.createWorkspaceTooltip")}
                onClick={() => setCreateWorkspace(true)}
              >
                +
              </button>
            </>
          )}
        </div>

        {/* Результаты поиска */}
        {searchActive && searchQuery.trim() && (
          <div className="border-b border-border bg-surface-0 overflow-y-auto shrink-0" style={{ maxHeight: "60%" }}>
            {searchResults.length === 0 ? (
              <div className="px-3 py-3 text-2xs text-text-muted text-center">{t("common.nothingFound")}</div>
            ) : (
              searchResults.map((node) => (
                <div
                  key={`${node.type}-${node.id}`}
                  onClick={() => handleSearchSelect(node)}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-2 text-text-primary"
                >
                  <span className="text-sm shrink-0">{node.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{node.name}</div>
                    {node.breadcrumb && (
                      <div className="text-2xs text-text-muted truncate">{node.breadcrumb}</div>
                    )}
                  </div>
                  <span className={`text-2xs px-1 py-0.5 rounded font-mono shrink-0 ${
                    node.type === "workspace" ? "bg-surface-3 text-text-muted" :
                    node.type === "project" ? "bg-blue-500/15 text-blue-400" :
                    "bg-green-500/15 text-green-400"
                  }`}>
                    {node.type === "workspace" ? "WS" : node.type === "project" ? "PRJ" : "CON"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {nodes.map((node) => (
            <div
              key={`${node.type}-${node.id}`}
              className={`tree-item ${
                selectedNode?.id === node.id && selectedNode?.type === node.type
                  ? "active"
                  : ""
              }`}
              style={{ paddingLeft: `${12 + node.depth * 16}px` }}
              onClick={() => handleClick(node)}
              onDoubleClick={() => handleDoubleClick(node)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              {/* Expand/collapse */}
              <span
                className="indent w-4 flex items-center justify-center text-text-muted cursor-pointer"
                onClick={(e) => handleToggle(e, node)}
              >
                {node.type === "console" ? (
                  <span className="w-4" />
                ) : node.is_expanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </span>

              {/* Icon */}
              <span className="text-sm">{node.icon}</span>

              {/* Name — или input при переименовании */}
              {renamingId === node.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 bg-surface-0 border border-accent rounded px-1 text-xs text-text-primary outline-none"
                  onBlur={() => commitRename(node)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(node);
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate flex-1 text-xs">{node.name}</span>
              )}

              {/* SSH badge */}
              {node.type === "console" && (node.data as { connectionType?: string }).connectionType === "ssh" && (
                <span className="shrink-0 text-2xs px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 font-mono">
                  ssh
                </span>
              )}

              {/* Danger badge */}
              {(node.data as { isDanger?: boolean; dangerLabel?: string }).isDanger && (
                <span className="shrink-0 text-2xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                  ⚠ {(node.data as { dangerLabel?: string }).dangerLabel || "DANGER"}
                </span>
              )}
            </div>
          ))}

          {nodes.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted text-xs">
              {t("treePanel.emptyState")}
            </div>
          )}
        </div>
      </div>

      {/* Контекстное меню */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateProject={(wsId) => setCreateProjectFor(wsId)}
          onCreateConsole={(projId) => setCreateConsoleFor(projId)}
          onRename={(node) => startRename(node)}
          onToggleDanger={(node) => handleToggleDanger(node)}
          onEditConsole={(node) => setEditConsole(node.data as ConsoleConfig)}
          onCloneConsole={handleCloneConsole}
          onCloneProject={handleCloneProject}
        />
      )}

      {/* Диалоги создания / редактирования */}
      {createWorkspace && (
        <CreateWorkspaceDialog onClose={() => setCreateWorkspace(false)} />
      )}
      {createProjectFor && (
        <CreateProjectDialog
          workspaceId={createProjectFor}
          onClose={() => setCreateProjectFor(null)}
        />
      )}
      {createConsoleFor && (
        <CreateConsoleDialog
          projectId={createConsoleFor}
          onClose={() => setCreateConsoleFor(null)}
        />
      )}
      {editConsole && (
        <EditConsoleDialog
          console_={editConsole}
          onClose={() => setEditConsole(null)}
        />
      )}
    </>
  );
}