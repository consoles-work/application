import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ChevronDown, Search, X, Upload, Download, StickyNote, History, Eraser } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppStore, parseRecentConsoles } from "../stores/appStore";
import type { ConsoleConfig, Project, TreeNode, Workspace } from "../types";
import { updateWorkspace, updateProject, updateConsole, setNodeDanger, cloneConsole, cloneProject, moveConsole } from "../lib/tauriCommands";
import { allConsoles, consoleNode, findConsole, findProject, searchIndex, searchTree, type SearchHit } from "../lib/tree";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { CreateWorkspaceDialog } from "./dialogs/CreateWorkspaceDialog";
import { CreateProjectDialog } from "./dialogs/CreateProjectDialog";
import { CreateConsoleDialog } from "./dialogs/CreateConsoleDialog";
import { EditConsoleDialog } from "./dialogs/EditConsoleDialog";
import { QuickCommandsDialog } from "./dialogs/QuickCommandsDialog";
import { ExportDialog } from "./dialogs/ExportDialog";
import { ImportDialog } from "./dialogs/ImportDialog";
import { useTranslation } from "react-i18next";
import { ConsoleIconTile } from "../lib/consoleIcons";

// ══════════════════════════════════════
// TreePanel — дерево проектов
// ══════════════════════════════════════
// Левая панель: воркспейсы → проекты → консоли, поиск, недавние консоли.
//
// Клик: по консоли — переход к её открытому терминалу, а если его нет — новый;
// по воркспейсу или проекту — свернуть/раскрыть (запоминается между запусками).
// Перетаскивание консоли на проект — перенос с подтверждением. Мышью, а не
// HTML5 DnD: тот в Tauri WebKit не работает. Сдвиг меньше порога — это клик.
// Поиск: по имени и несекретным полям (адрес, хостинг, заметка…); совпавшие
// по имени — первыми, у остальных видна строка, в которой нашлось.
// Переименование: двойной клик или F2 по выбранному узлу; Enter или уход
// фокуса сохраняет, Escape отменяет.
// Пометка «опасно»: включение спрашивает подпись (по умолчанию PRODUCTION).
// Недавние: последние консоли внизу панели; удалённые из дерева не показываются.
// Ошибки действий — тостом; дерево меняется только после успешной команды.

const RECENT_CONSOLES_SHOWN = 5;

const DRAG_THRESHOLD = 6;

const TYPE_BADGE: Record<TreeNode["type"], { label: string; cls: string }> = {
  workspace: { label: "WS", cls: "bg-surface-3 text-text-muted" },
  project: { label: "PRJ", cls: "bg-blue-500/15 text-blue-400" },
  console: { label: "CON", cls: "bg-green-500/15 text-green-400" },
};

interface RecentConsole {
  node: TreeNode;
  /** «Воркспейс › Проект» — подсказка */
  path: string;
  project: string;
}

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
    moveConsoleToProject,
    openConsole,
    activateConsole,
    reconnectSession,
    showToast,
    sessions,
    settings,
    saveSetting,
    removeRecentConsole,
    clearRecentConsoles,
  } = useAppStore();

  const nodes = getFlatTree();
  const { t } = useTranslation();

  // ── Меню и диалоги ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [createWorkspace, setCreateWorkspace] = useState(false);
  const [createProjectFor, setCreateProjectFor] = useState<string | null>(null); // workspaceId
  const [createConsoleFor, setCreateConsoleFor] = useState<string | null>(null); // projectId
  const [editConsole, setEditConsole] = useState<ConsoleConfig | null>(null);
  const [editWorkspaceId, setEditWorkspaceId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [quickCommandsFor, setQuickCommandsFor] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const editWorkspace = editWorkspaceId ? workspaces.find((w) => w.id === editWorkspaceId) : undefined;
  const editProject = editProjectId ? findProject(workspaces, editProjectId)?.project : undefined;

  // ── Поиск ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => searchIndex(workspaces), [workspaces]);
  const searchResults = useMemo(() => searchTree(index, searchQuery), [index, searchQuery]);

  // ── Переименование ──
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Недавние консоли ──
  const recentRaw = settings["ui.recentConsoles"];
  const recentCollapsed = settings["ui.recentConsolesCollapsed"] === "true";

  const recentNodes = useMemo(() => {
    const byId = new Map<string, RecentConsole>(
      allConsoles(workspaces).map(({ console: con, project, workspace }) => [
        con.id,
        { node: consoleNode(con, project), path: `${workspace.name} › ${project.name}`, project: project.name },
      ])
    );

    return parseRecentConsoles(recentRaw)
      .flatMap((id) => byId.get(id) ?? [])
      .slice(0, RECENT_CONSOLES_SHOWN);
  }, [workspaces, recentRaw]);

  // ── Клик и перетаскивание ──
  const handleClick = (node: TreeNode) => {
    if (renamingId) return;

    selectNode({ type: node.type, id: node.id });

    if (node.type === "console") openConsole(node.id, node.name);
    else toggleNodeExpanded(node.type, node.id);
  };

  const handleDropOnProject = async (consoleId: string, consoleName: string, projectNode: TreeNode) => {
    const target = findProject(workspaces, projectNode.id)?.project;

    // Уже в этом проекте — переносить некуда
    if (!target || target.consoles.some((c) => c.id === consoleId)) return;

    const confirmed = await ask(t("treePanel.moveConfirm", { name: consoleName, project: projectNode.name }), {
      title: t("treePanel.moveConfirmTitle"),
      kind: "info",
    });

    if (!confirmed) return;

    try {
      await moveConsole(consoleId, projectNode.id);

      moveConsoleToProject(consoleId, projectNode.id);

      showToast("success", t("treePanel.toastConsoleMoved", { name: consoleName, project: projectNode.name }));
    } catch (e) {
      showToast("error", t("treePanel.toastMoveError", { error: e }));
    }
  };

  const drag = useConsoleDrag({
    disabled: !!renamingId,
    onClick: handleClick,
    onDrop: (dragged, projectId) => {
      const projectNode = nodes.find((n) => n.id === projectId && n.type === "project");

      if (projectNode) handleDropOnProject(dragged.id, dragged.name, projectNode);
    },
  });

  // ── Поиск: действия ──
  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus();
  }, [searchActive]);

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery("");
  };

  const handleSearchSelect = (hit: SearchHit) => {
    selectNode({ type: hit.type, id: hit.id });

    if (hit.type === "console") openConsole(hit.id, hit.name);

    closeSearch();
  };

  // ── Переименование: действия ──
  const startRename = (node: TreeNode) => {
    setRenamingId(node.id);
    setRenameValue(node.name);
  };

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  // F2 — переименовать выбранный узел
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2" || !selectedNode || renamingId) return;

      const node = nodes.find((n) => n.id === selectedNode.id && n.type === selectedNode.type);

      if (node) startRename(node);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNode, renamingId, nodes]);

  // Команда переименования своя у каждого типа узла
  const renameNode = async (node: TreeNode, name: string) => {
    if (node.type === "workspace") {
      const ws = node.data as Workspace;

      await updateWorkspace(node.id, name, ws.icon, ws.color);

      return storeUpdateWorkspace(node.id, { name });
    }

    if (node.type === "project") {
      const { icon, color, path, defaultShell } = node.data as Project;

      await updateProject(node.id, { name, icon, color, path, defaultShell });

      return storeUpdateProject(node.id, { name });
    }

    await updateConsole(node.id, name);

    storeUpdateConsole(node.id, { name });
  };

  const commitRename = async (node: TreeNode) => {
    const name = renameValue.trim();

    setRenamingId(null);

    if (!name || name === node.name) return;

    try {
      await renameNode(node, name);

      showToast("success", t("treePanel.toastRenamedTo", { name }));
    } catch (e) {
      showToast("error", t("treePanel.toastRenameError", { error: e }));
    }
  };

  // ── Действия контекстного меню ──
  const handleToggleDanger = async (node: TreeNode) => {
    const { isDanger, dangerLabel } = node.data as Project | ConsoleConfig;

    // Включение — с вопросом о подписи; отмена — ничего не меняем
    const label = isDanger
      ? dangerLabel || "PRODUCTION"
      : window.prompt(t("treePanel.dangerLabelPrompt"), dangerLabel || "PRODUCTION");

    if (label === null) return;

    const updates = isDanger ? { isDanger: false } : { isDanger: true, dangerLabel: label.trim() || "PRODUCTION" };

    try {
      await setNodeDanger(node.id, node.type, updates.isDanger, updates.dangerLabel ?? label);

      if (node.type === "project") storeUpdateProject(node.id, updates);
      else storeUpdateConsole(node.id, updates);
    } catch (e) {
      showToast("error", t("treePanel.toastDangerError", { error: e }));
    }
  };

  const handleCloneConsole = async (node: TreeNode) => {
    const projectId = findConsole(workspaces, node.id)?.project.id;

    if (!projectId) {
      showToast("error", t("treePanel.toastParentProjectNotFound"));

      return;
    }

    try {
      const cloned = await cloneConsole(node.id);

      storeAddConsole(projectId, cloned);

      showToast("success", t("treePanel.toastConsoleCloned", { name: cloned.name }));
    } catch (e) {
      showToast("error", t("treePanel.toastCloneError", { error: e }));
    }
  };

  const handleCloneProject = async (node: TreeNode) => {
    const workspaceId = findProject(workspaces, node.id)?.workspace.id;

    if (!workspaceId) {
      showToast("error", t("treePanel.toastWorkspaceNotFound"));

      return;
    }

    try {
      const cloned = await cloneProject(node.id);

      storeAddProject(workspaceId, cloned);

      showToast("success", t("treePanel.toastProjectCloned", { name: cloned.name }));
    } catch (e) {
      showToast("error", t("treePanel.toastCloneError", { error: e }));
    }
  };

  // Переподключаем тот экземпляр консоли, с которым работали последним
  const handleReconnectConsole = (node: TreeNode) => {
    if (!activateConsole(node.id)) return;

    const { activeSessionId } = useAppStore.getState();

    if (activeSessionId) reconnectSession(activeSessionId);
  };

  // ── Недавние: действия ──
  const handleClearRecent = async () => {
    const confirmed = await ask(t("treePanel.recentClearConfirm"), { title: t("treePanel.recentClear"), kind: "warning" });

    if (confirmed) clearRecentConsoles();
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();

    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const isSelected = (node: TreeNode) => selectedNode?.id === node.id && selectedNode?.type === node.type;

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
                onClick={() => setShowImport(true)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded"
                title="Импортировать (.dchub)"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded"
                title="Экспортировать (.dchub)"
              >
                <Upload size={13} />
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
            {searchResults.length === 0 && (
              <div className="px-3 py-3 text-2xs text-text-muted text-center">{t("common.nothingFound")}</div>
            )}
            {searchResults.map((hit) => (
              <div
                key={`${hit.type}-${hit.id}`}
                onClick={() => handleSearchSelect(hit)}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-2 text-text-primary"
              >
                <span className="text-sm shrink-0">{hit.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{hit.name}</div>
                  {hit.breadcrumb && <div className="text-2xs text-text-muted truncate">{hit.breadcrumb}</div>}
                  {hit.match && <div className="text-2xs text-accent truncate font-mono">{hit.match}</div>}
                </div>
                <span className={`text-2xs px-1 py-0.5 rounded font-mono shrink-0 ${TYPE_BADGE[hit.type].cls}`}>
                  {TYPE_BADGE[hit.type].label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {nodes.map((node) => (
            <TreeRow
              key={`${node.type}-${node.id}`}
              node={node}
              selected={isSelected(node)}
              dropTarget={node.type === "project" && drag.overProjectId === node.id}
              draggable={node.type === "console" && !drag.dragging}
              dragged={drag.dragging?.id === node.id}
              renaming={renamingId === node.id}
              renameInput={
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
              }
              // Клик по консоли обрабатывает перетаскивание: короткое нажатие — это клик
              onClick={node.type !== "console" ? () => handleClick(node) : undefined}
              onMouseDown={node.type === "console" ? (e) => drag.start(e, node) : undefined}
              onDoubleClick={() => { if (!drag.dragging) startRename(node); }}
              onToggle={(e) => {
                e.stopPropagation();

                if (node.type !== "console") toggleNodeExpanded(node.type, node.id);
              }}
              onContextMenu={(e) => handleContextMenu(e, node)}
            />
          ))}

          {nodes.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted text-xs">{t("treePanel.emptyState")}</div>
          )}
        </div>

        {/* Недавние консоли — внизу панели, под деревом */}
        {!searchActive && recentNodes.length > 0 && (
          <div className="border-t border-border shrink-0 py-1">
            <div className="flex items-center px-3 gap-1">
              <button
                onClick={() => saveSetting("ui.recentConsolesCollapsed", String(!recentCollapsed))}
                className="flex-1 flex items-center gap-1.5 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-primary"
              >
                {recentCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                <History size={11} />
                {t("treePanel.recentHeader")}
              </button>
              {!recentCollapsed && (
                <button
                  onClick={handleClearRecent}
                  className="text-text-muted hover:text-text-primary p-0.5 rounded"
                  title={t("treePanel.recentClear")}
                >
                  <Eraser size={11} />
                </button>
              )}
            </div>
            {!recentCollapsed &&
              recentNodes.map(({ node, path, project }) => {
                const con = node.data as ConsoleConfig;

                const isOpen = sessions.some((s) => s.console_id === node.id);

                return (
                  <div
                    key={`recent-${node.id}`}
                    className={`tree-item ${isSelected(node) ? "active" : ""}`}
                    title={path}
                    onClick={() => handleClick(node)}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                  >
                    <ConsoleIconTile con={con} />
                    <span className="truncate text-xs shrink">{node.name}</span>
                    <span className="truncate flex-1 min-w-0 text-2xs text-text-muted">{project}</span>
                    {con.isDanger && (
                      <span className="shrink-0 text-2xs text-red-400" title={con.dangerLabel || "DANGER"}>⚠</span>
                    )}
                    {isOpen && (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" title={t("treePanel.recentSessionOpen")} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRecentConsole(node.id); }}
                      className="shrink-0 text-text-muted hover:text-text-primary"
                      title={t("treePanel.recentRemove")}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateProject={(wsId) => setCreateProjectFor(wsId)}
          onCreateConsole={(projId) => setCreateConsoleFor(projId)}
          onToggleDanger={handleToggleDanger}
          onEditConsole={(node) => setEditConsole(node.data as ConsoleConfig)}
          onEditNode={(node) => {
            if (node.type === "workspace") setEditWorkspaceId(node.id);
            else if (node.type === "project") setEditProjectId(node.id);
          }}
          onQuickCommands={(node) => setQuickCommandsFor(node.id)}
          onCloneConsole={handleCloneConsole}
          onCloneProject={handleCloneProject}
          onReconnectConsole={handleReconnectConsole}
        />
      )}

      {createWorkspace && <CreateWorkspaceDialog onClose={() => setCreateWorkspace(false)} />}
      {createProjectFor && <CreateProjectDialog workspaceId={createProjectFor} onClose={() => setCreateProjectFor(null)} />}
      {editWorkspace && <CreateWorkspaceDialog workspace={editWorkspace} onClose={() => setEditWorkspaceId(null)} />}
      {editProject && <CreateProjectDialog project={editProject} onClose={() => setEditProjectId(null)} />}
      {createConsoleFor && <CreateConsoleDialog projectId={createConsoleFor} onClose={() => setCreateConsoleFor(null)} />}
      {editConsole && <EditConsoleDialog console_={editConsole} onClose={() => setEditConsole(null)} />}
      {quickCommandsFor && <QuickCommandsDialog consoleId={quickCommandsFor} onClose={() => setQuickCommandsFor(null)} />}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}

      {/* Призрак перетаскиваемой консоли — следует за курсором */}
      {drag.dragging &&
        createPortal(
          <>
            {/* Глобальный cursor: grabbing */}
            <style>{`* { cursor: grabbing !important; user-select: none !important; }`}</style>
            <div
              id="dnd-ghost"
              style={{ position: "fixed", left: drag.pos.x + 12, top: drag.pos.y - 10, pointerEvents: "none", zIndex: 9999 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-accent shadow-xl text-xs text-accent font-medium opacity-95"
            >
              <span className="text-sm">🔗</span>
              {drag.dragging.name}
              <span className={`ml-1 text-2xs ${drag.overProjectId ? "opacity-70" : "opacity-50"}`}>
                → {drag.overProjectId ? nodes.find((n) => n.id === drag.overProjectId)?.name ?? drag.overProjectId : "?"}
              </span>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

// ══════════════════════════════════════
// Строка дерева
// ══════════════════════════════════════

interface TreeRowProps {
  node: TreeNode;
  selected: boolean;
  /** Сюда сейчас бросят перетаскиваемую консоль */
  dropTarget: boolean;
  draggable: boolean;
  /** Эту консоль сейчас тащат */
  dragged: boolean;
  renaming: boolean;
  renameInput: React.ReactNode;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TreeRow({ node, selected, dropTarget, draggable, dragged, renaming, renameInput, ...handlers }: TreeRowProps) {
  const data = node.data as { note?: string; isDanger?: boolean; dangerLabel?: string };

  const note = data.note?.trim();

  const classes = [
    "tree-item",
    selected && "active",
    dropTarget && "ring-1 ring-inset ring-accent bg-accent/5",
    draggable && "cursor-grab",
    dragged && "opacity-40",
  ];

  return (
    <div
      data-nodeid={node.id}
      data-nodetype={node.type}
      className={classes.filter(Boolean).join(" ")}
      style={{ paddingLeft: `${12 + node.depth * 16}px` }}
      title={note || undefined}
      onClick={handlers.onClick}
      onDoubleClick={handlers.onDoubleClick}
      onContextMenu={handlers.onContextMenu}
      onMouseDown={handlers.onMouseDown}
    >
      {/* Свернуть/раскрыть — у консоли пустое место той же ширины */}
      <span className="indent w-4 flex items-center justify-center text-text-muted cursor-pointer" onClick={handlers.onToggle}>
        {node.type !== "console" && (node.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
      </span>

      {/* Icon — emoji у workspace/project, своя иконка с цветом у консоли */}
      {node.type === "console" ? <ConsoleIconTile con={node.data as ConsoleConfig} /> : <span className="text-sm">{node.icon}</span>}

      {renaming ? renameInput : <span className="truncate flex-1 text-xs">{node.name}</span>}

      {/* Индикатор заметки — сам текст показывается в тултипе всей строки */}
      {note && <StickyNote size={11} className="shrink-0 text-text-muted" />}

      {data.isDanger && (
        <span className="shrink-0 text-2xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
          ⚠ {data.dangerLabel || "DANGER"}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// Перетаскивание консоли на проект
// ══════════════════════════════════════
// HTML5 DnD в Tauri WebKit не работает — слушаем mousemove/mouseup на window.
// Сдвиг меньше порога — это клик. Проект под курсором ищется по прямоугольникам
// строк с data-nodetype='project'.

interface DraggedConsole {
  id: string;
  name: string;
}

function useConsoleDrag({
  disabled,
  onClick,
  onDrop,
}: {
  disabled: boolean;
  onClick: (node: TreeNode) => void;
  onDrop: (dragged: DraggedConsole, projectId: string) => void;
}) {
  const [dragging, setDragging] = useState<DraggedConsole | null>(null);
  const [overProjectId, setOverProjectId] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Слушатели на window живут дольше рендера — читают свежие колбэки через ref
  const handlersRef = useRef({ onClick, onDrop });

  handlersRef.current = { onClick, onDrop };

  const start = (e: React.MouseEvent, node: TreeNode) => {
    if (e.button !== 0 || disabled) return;

    // Без этого браузер начал бы выделять текст
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;

    let started = false;

    const onMove = (ev: MouseEvent) => {
      started ||= Math.hypot(ev.clientX - startX, ev.clientY - startY) >= DRAG_THRESHOLD;

      if (!started) return;

      setDragging({ id: node.id, name: node.name });
      setPos({ x: ev.clientX, y: ev.clientY });
      setOverProjectId(projectUnder(ev.clientX, ev.clientY));
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      if (!started) {
        handlersRef.current.onClick(node);

        return;
      }

      const projectId = projectUnder(ev.clientX, ev.clientY);

      if (projectId) handlersRef.current.onDrop({ id: node.id, name: node.name }, projectId);

      setDragging(null);
      setOverProjectId(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { dragging, overProjectId, pos, start };
}

function projectUnder(x: number, y: number): string | null {
  const rows = Array.from(document.querySelectorAll("[data-nodetype='project']"));

  const hit = rows.find((el) => {
    const r = el.getBoundingClientRect();

    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });

  return hit?.getAttribute("data-nodeid") ?? null;
}
