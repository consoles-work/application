import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ChevronDown, Search, X, Upload, Download, StickyNote, History, Eraser } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppStore, parseRecentConsoles } from "../stores/appStore";
import type { ConsoleConfig, Project, TreeNode, Workspace } from "../types";
import { updateWorkspace, updateProject, updateConsole, setNodeDanger, cloneConsole, cloneProject, reorderNodes } from "../lib/tauriCommands";
import { allConsoles, consoleNode, findConsole, findProject, searchIndex, searchTree, type SearchHit } from "../lib/tree";
import { dropLine, dropTarget, placement, type DropLine, type DropTarget, type Placement } from "../lib/treeOrder";
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
// Перетаскивание любого узла: выше/ниже соседа своего уровня, проект — на
// воркспейс, консоль — на проект (в конец). Переезд в другой воркспейс или
// проект — с подтверждением; перестановка внутри родителя — без вопросов.
// У краёв дерева оно само прокручивается. Мышью, а не HTML5 DnD: тот в Tauri
// WebKit не работает. Сдвиг меньше порога — это клик.
// Поиск: по имени и несекретным полям (адрес, хостинг, заметка…); совпавшие
// по имени — первыми, у остальных видна строка, в которой нашлось.
// Переименование: двойной клик или F2 по выбранному узлу; Enter или уход
// фокуса сохраняет, Escape отменяет.
// Пометка «опасно»: включение спрашивает подпись (по умолчанию PRODUCTION).
// Недавние: последние консоли внизу панели; удалённые из дерева не показываются.
// Ошибки действий — тостом; дерево меняется только после успешной команды.

const RECENT_CONSOLES_SHOWN = 5;

const DRAG_THRESHOLD = 6;

/** Автопрокрутка при перетаскивании: зона у края дерева и шаг за кадр, px */
const AUTOSCROLL_EDGE = 28;
const AUTOSCROLL_STEP = 8;

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
    placeTreeNode,
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

  // Переезд в другой воркспейс/проект — только после подтверждения
  const confirmMove = (dragged: TreeNode, place: Placement) =>
    dragged.type === "console"
      ? ask(t("treePanel.moveConfirm", { name: dragged.name, project: place.parentName }), {
          title: t("treePanel.moveConfirmTitle"),
          kind: "info",
        })
      : ask(t("treePanel.projectMoveConfirm", { name: dragged.name, workspace: place.parentName }), {
          title: t("treePanel.projectMoveConfirmTitle"),
          kind: "info",
        });

  const handleDrop = async (dragged: TreeNode, target: DropTarget) => {
    const place = placement(workspaces, dragged, target);

    if (!place) return;

    if (place.parentChanged && !(await confirmMove(dragged, place))) return;

    try {
      await reorderNodes(place.type, place.parentId, place.orderedIds);

      placeTreeNode(place);

      if (!place.parentChanged) return;

      showToast(
        "success",
        dragged.type === "console"
          ? t("treePanel.toastConsoleMoved", { name: dragged.name, project: place.parentName })
          : t("treePanel.toastProjectMoved", { name: dragged.name, workspace: place.parentName })
      );
    } catch (e) {
      showToast("error", t("treePanel.toastMoveError", { error: e }));
    }
  };

  const treeRef = useRef<HTMLDivElement>(null);

  const drag = useTreeDrag({ disabled: !!renamingId, nodes, containerRef: treeRef, onClick: handleClick, onDrop: handleDrop });

  // Куда встанет узел, если бросить сейчас; null — останется на месте, линию не рисуем.
  // У призрака — подпись нового родителя, если он меняется.
  const preview = drag.dragging && drag.target ? placement(workspaces, drag.dragging, drag.target) : null;

  const line = preview && drag.target ? dropLine(drag.target, nodes) : null;

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
        <div ref={treeRef} className="flex-1 overflow-y-auto py-1">
          {nodes.map((node) => (
            <TreeRow
              key={`${node.type}-${node.id}`}
              node={node}
              selected={isSelected(node)}
              dropLine={line?.rowId === node.id ? line : undefined}
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
              // Клик обрабатывает перетаскивание: короткое нажатие — это клик
              onMouseDown={(e) => drag.start(e, node)}
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

      {/* Призрак перетаскиваемого узла — следует за курсором */}
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
              {drag.dragging.type === "console" ? (
                <ConsoleIconTile con={drag.dragging.data as ConsoleConfig} />
              ) : (
                <span className="text-sm">{drag.dragging.icon}</span>
              )}
              {drag.dragging.name}
              {preview?.parentChanged && <span className="ml-1 text-2xs opacity-70">→ {preview.parentName}</span>}
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
  /** Подсказка, куда встанет перетаскиваемый узел, — у этой строки */
  dropLine?: DropLine;
  /** Этот узел сейчас тащат */
  dragged: boolean;
  renaming: boolean;
  renameInput: React.ReactNode;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TreeRow({ node, selected, dropLine, dragged, renaming, renameInput, ...handlers }: TreeRowProps) {
  const data = node.data as { note?: string; isDanger?: boolean; dangerLabel?: string };

  const note = data.note?.trim();

  const classes = [
    "tree-item relative",
    selected && "active",
    dropLine?.edge === "inside" && "ring-1 ring-inset ring-accent bg-accent/5",
    dragged && "opacity-40",
  ];

  return (
    <div
      data-nodeid={node.id}
      data-nodetype={node.type}
      className={classes.filter(Boolean).join(" ")}
      style={{ paddingLeft: `${12 + node.depth * 16}px` }}
      title={note || undefined}
      onDoubleClick={handlers.onDoubleClick}
      onContextMenu={handlers.onContextMenu}
      onMouseDown={handlers.onMouseDown}
    >
      {/* Свернуть/раскрыть — у консоли пустое место той же ширины */}
      {/* Линия «встанет сюда» — с отступом уровня цели */}
      {(dropLine?.edge === "top" || dropLine?.edge === "bottom") && (
        <span
          className={`absolute right-1 h-0.5 rounded-full bg-accent pointer-events-none ${dropLine.edge === "top" ? "top-0" : "bottom-0"}`}
          style={{ left: `${8 + dropLine.depth * 16}px` }}
        />
      )}

      {/* Нажатие на стрелку — только свернуть/раскрыть, не начало перетаскивания */}
      <span
        className="indent w-4 flex items-center justify-center text-text-muted cursor-pointer"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handlers.onToggle}
      >
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
// Перетаскивание узла дерева
// ══════════════════════════════════════
// HTML5 DnD в Tauri WebKit не работает — слушаем mousemove/mouseup на window.
// Сдвиг меньше порога — это клик. Цель — по строке под курсором (правила —
// в lib/treeOrder.ts). У верхнего и нижнего края дерева оно прокручивается
// само каждый кадр, и цель пересчитывается, даже если мышь стоит.

function useTreeDrag({
  disabled,
  nodes,
  containerRef,
  onClick,
  onDrop,
}: {
  disabled: boolean;
  nodes: TreeNode[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClick: (node: TreeNode) => void;
  onDrop: (dragged: TreeNode, target: DropTarget) => void;
}) {
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Слушатели на window живут дольше рендера — читают свежие данные через ref
  const latest = useRef({ nodes, onClick, onDrop });

  latest.current = { nodes, onClick, onDrop };

  const start = (e: React.MouseEvent, node: TreeNode) => {
    if (e.button !== 0 || disabled) return;

    // Без этого браузер начал бы выделять текст
    e.preventDefault();

    const pointer = { x: e.clientX, y: e.clientY };

    let started = false;
    let frame = 0;

    const findTarget = () => targetUnder(node.type, latest.current.nodes, containerRef.current, pointer);

    const autoScroll = () => {
      const el = containerRef.current;

      const step = el ? edgeScrollStep(el.getBoundingClientRect(), pointer.x, pointer.y) : 0;

      if (el && step) {
        el.scrollTop += step;

        setTarget(findTarget());
      }

      frame = requestAnimationFrame(autoScroll);
    };

    const onMove = (ev: MouseEvent) => {
      if (!started && Math.hypot(ev.clientX - pointer.x, ev.clientY - pointer.y) < DRAG_THRESHOLD) return;

      pointer.x = ev.clientX;
      pointer.y = ev.clientY;

      if (!started) {
        started = true;

        setDragging(node);

        frame = requestAnimationFrame(autoScroll);
      }

      setPos({ ...pointer });
      setTarget(findTarget());
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      cancelAnimationFrame(frame);

      if (!started) {
        latest.current.onClick(node);

        return;
      }

      const dropAt = findTarget();

      setDragging(null);
      setTarget(null);

      if (dropAt) latest.current.onDrop(node, dropAt);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { dragging, target, pos, start };
}

/** Цель под курсором: строка дерева и в какой её половине курсор */
function targetUnder(
  type: TreeNode["type"],
  nodes: TreeNode[],
  container: HTMLElement | null,
  { x, y }: { x: number; y: number }
): DropTarget | null {
  const rows = container ? Array.from(container.querySelectorAll<HTMLElement>("[data-nodeid]")) : [];

  const row = rows.find((el) => {
    const r = el.getBoundingClientRect();

    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });

  if (!row) return null;

  const index = nodes.findIndex((n) => n.id === row.dataset.nodeid);

  const r = row.getBoundingClientRect();

  return index < 0 ? null : dropTarget(type, nodes, index, y > r.top + r.height / 2);
}

/** Автопрокрутка: курсор у верхнего края — вверх, у нижнего — вниз, иначе 0 */
function edgeScrollStep(r: DOMRect, x: number, y: number): number {
  if (x < r.left || x > r.right) return 0;

  if (y < r.top + AUTOSCROLL_EDGE) return -AUTOSCROLL_STEP;

  if (y > r.bottom - AUTOSCROLL_EDGE) return AUTOSCROLL_STEP;

  return 0;
}
