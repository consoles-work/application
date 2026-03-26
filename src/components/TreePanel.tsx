import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { updateWorkspace, updateProject, updateConsole, setNodeDanger } from "../lib/tauriCommands";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { CreateWorkspaceDialog } from "./dialogs/CreateWorkspaceDialog";
import { CreateProjectDialog } from "./dialogs/CreateProjectDialog";
import { CreateConsoleDialog } from "./dialogs/CreateConsoleDialog";
import { EditConsoleDialog } from "./dialogs/EditConsoleDialog";
import type { TreeNode, ConsoleConfig } from "../types";

// ══════════════════════════════════════
// TreePanel — дерево проектов
// ══════════════════════════════════════

export function TreePanel() {
  const {
    selectedNode,
    selectNode,
    toggleNodeExpanded,
    getFlatTree,
    updateWorkspace: storeUpdateWorkspace,
    updateProject: storeUpdateProject,
    updateConsole: storeUpdateConsole,
    openSession,
    sessions,
    setActiveSession,
    showToast,
  } = useAppStore();

  const nodes = getFlatTree();

  // ── Контекстное меню ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ── Диалоги создания / редактирования ──
  const [createWorkspace, setCreateWorkspace] = useState(false);
  const [createProjectFor, setCreateProjectFor] = useState<string | null>(null);   // workspaceId
  const [createConsoleFor, setCreateConsoleFor] = useState<string | null>(null);   // projectId
  const [editConsole, setEditConsole] = useState<ConsoleConfig | null>(null);

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
      showToast("success", `Переименовано в «${newName}»`);
    } catch (e) {
      showToast("error", `Ошибка переименования: ${e}`);
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
      const label = window.prompt("Метка предупреждения:", data.dangerLabel || "PRODUCTION");
      if (label === null) return; // отмена
      const finalLabel = label.trim() || "PRODUCTION";
      try {
        await setNodeDanger(node.id, node.type, true, finalLabel);
        if (node.type === "project") storeUpdateProject(node.id, { isDanger: true, dangerLabel: finalLabel } as any);
        else if (node.type === "console") storeUpdateConsole(node.id, { isDanger: true, dangerLabel: finalLabel } as any);
      } catch (e) {
        showToast("error", `Ошибка: ${e}`);
      }
    } else {
      try {
        await setNodeDanger(node.id, node.type, false, data.dangerLabel || "PRODUCTION");
        if (node.type === "project") storeUpdateProject(node.id, { isDanger: false } as any);
        else if (node.type === "console") storeUpdateConsole(node.id, { isDanger: false } as any);
      } catch (e) {
        showToast("error", `Ошибка: ${e}`);
      }
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-surface-1">
        {/* Header */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Projects
          </span>
          <button
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            title="Создать Workspace"
            onClick={() => setCreateWorkspace(true)}
          >
            +
          </button>
        </div>

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
              Нажмите + чтобы создать workspace
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