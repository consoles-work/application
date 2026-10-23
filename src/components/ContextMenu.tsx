import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ask, save } from "@tauri-apps/plugin-dialog";
import type { TFunction } from "i18next";
import { useAppStore } from "../stores/appStore";
import { deleteWorkspace, deleteProject, deleteConsole, saveTextFile } from "../lib/tauriCommands";
import type { TreeNode, ConsoleConfig, TreeNodeType, Workspace } from "../types";
import { buildSshCommand } from "../lib/connectionString";
import { buildServersMarkdown } from "../lib/serversMarkdown";
import { findProject } from "../lib/tree";
import { useEscape } from "../hooks/useEscape";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════
// ContextMenu — меню узла дерева (ПКМ)
// ══════════════════════════════════════
// Пункты зависят от типа узла; у консоли с открытым терминалом есть ещё «новый
// экземпляр» и «переподключить». Любой пункт сначала закрывает меню.
// Удаление — после подтверждения, вместе со всем вложенным; дерево меняется
// после успешной команды. Создание, настройки, клонирование и пометка
// «опасно» — у владельца меню (TreePanel). Закрывается кликом снаружи и Escape.

export interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onCreateProject: (workspaceId: string) => void;
  onCreateConsole: (projectId: string) => void;
  onToggleDanger: (node: TreeNode) => void;
  onEditConsole: (node: TreeNode) => void;
  onEditNode: (node: TreeNode) => void;
  onQuickCommands: (node: TreeNode) => void;
  onCloneConsole: (node: TreeNode) => void;
  onCloneProject: (node: TreeNode) => void;
  onReconnectConsole: (node: TreeNode) => void;
}

type MenuItem = "separator" | { label: string; icon: string; action: () => void; danger?: boolean };

const MENU_WIDTH = 200;

/** Удаление: текст подтверждения, команда и тост — свои у каждого типа узла */
const DELETION: Record<TreeNodeType, { label: string; confirm: string; title: string; done: string; command: (id: string) => Promise<void> }> = {
  workspace: {
    label: "contextMenu.deleteWorkspace",
    confirm: "contextMenu.deleteWorkspaceConfirm",
    title: "contextMenu.deleteWorkspaceTitle",
    done: "contextMenu.toastWorkspaceDeleted",
    command: deleteWorkspace,
  },
  project: {
    label: "contextMenu.deleteProject",
    confirm: "contextMenu.deleteProjectConfirm",
    title: "contextMenu.deleteProjectTitle",
    done: "contextMenu.toastProjectDeleted",
    command: deleteProject,
  },
  console: {
    label: "contextMenu.deleteConsole",
    confirm: "contextMenu.deleteConsoleConfirm",
    title: "contextMenu.deleteConsoleTitle",
    done: "contextMenu.toastConsoleDeleted",
    command: deleteConsole,
  },
};

export function ContextMenu({ menu, onClose, ...actions }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { removeWorkspace, removeProject, removeConsole, openConsole, sessions, workspaces, showToast } = useAppStore();
  const { t } = useTranslation();

  const { node } = menu;

  // Закрыть по клику снаружи или Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("mousedown", onMouseDown);

    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  useEscape(onClose);

  // Меню не должно выходить за правый край окна
  const x = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);

  const handleDelete = async () => {
    const deletion = DELETION[node.type];

    const confirmed = await ask(t(deletion.confirm, { name: node.name }), { title: t(deletion.title), kind: "warning" });

    if (!confirmed) return;

    try {
      await deletion.command(node.id);

      ({ workspace: removeWorkspace, project: removeProject, console: removeConsole })[node.type](node.id);

      showToast("success", t(deletion.done));
    } catch (e) {
      showToast("error", t("contextMenu.toastDeleteError", { error: e }));
    }
  };

  const handleCopySshCommand = async () => {
    try {
      await navigator.clipboard.writeText(buildSshCommand(node.data as ConsoleConfig));

      showToast("success", t("dialogs.copyConnectionDone"));
    } catch (e) {
      showToast("error", t("dialogs.copyConnectionError", { error: e }));
    }
  };

  // Публичный список серверов воркспейса или проекта — в .md, без секретов
  const handleExportServers = async () => {
    const markdown = serversMarkdown(node, workspaces, t);

    if (!markdown) {
      showToast("info", t("contextMenu.toastNoServers"));

      return;
    }

    try {
      const safeName = node.name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "servers";

      const filePath = await save({ defaultPath: `${safeName}-servers.md`, filters: [{ name: "Markdown", extensions: ["md"] }] });

      // Отменили выбор файла
      if (!filePath) return;

      await saveTextFile(filePath, markdown);

      showToast("success", t("contextMenu.toastServersExported"));
    } catch (e) {
      showToast("error", t("contextMenu.toastServersExportError", { error: e }));
    }
  };

  // Любой пункт сначала закрывает меню
  const item = (label: string, icon: string, action: () => void, danger = false): MenuItem => ({
    label: t(label),
    icon,
    action: () => {
      onClose();
      action();
    },
    danger,
  });

  const items = menuItems(node, sessions.some((s) => s.console_id === node.id), {
    createProject: item("contextMenu.addProject", "+", () => actions.onCreateProject(node.id)),
    createConsole: item("contextMenu.addConsole", "+", () => actions.onCreateConsole(node.id)),
    exportServers: item("contextMenu.exportServers", "⇩", handleExportServers),
    settings: item("contextMenu.settings", "⚙", () => actions.onEditNode(node)),
    cloneProject: item("contextMenu.cloneProject", "⎘", () => actions.onCloneProject(node)),
    markDanger: item("contextMenu.markAsDangerous", "⚠", () => actions.onToggleDanger(node)),
    unmarkDanger: item("contextMenu.removeDangerFlag", "✓", () => actions.onToggleDanger(node)),
    run: item("contextMenu.runConsole", "▶", () => openConsole(node.id, node.name)),
    // Ещё один экземпляр той же консоли — отдельный PTY в подвкладке
    newInstance: item("contextMenu.openNewInstance", "⧉", () => openConsole(node.id, node.name, true)),
    reconnect: item("contextMenu.reconnectConsole", "↺", () => actions.onReconnectConsole(node)),
    connectionSettings: item("contextMenu.connectionSettings", "⚙", () => actions.onEditConsole(node)),
    quickCommands: item("contextMenu.quickCommands", "⚡", () => actions.onQuickCommands(node)),
    copySsh: item("contextMenu.copySshCommand", "⧉", handleCopySshCommand),
    cloneConsole: item("contextMenu.cloneConsole", "⎘", () => actions.onCloneConsole(node)),
    delete: item(DELETION[node.type].label, "✕", handleDelete, true),
  });

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ top: menu.y, left: x, width: MENU_WIDTH }}
    >
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-3 flex items-center gap-2 ${
              it.danger ? "text-danger hover:text-danger" : "text-text-primary"
            }`}
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

type MenuItems = Record<
  | "createProject"
  | "createConsole"
  | "exportServers"
  | "settings"
  | "cloneProject"
  | "markDanger"
  | "unmarkDanger"
  | "run"
  | "newInstance"
  | "reconnect"
  | "connectionSettings"
  | "quickCommands"
  | "copySsh"
  | "cloneConsole"
  | "delete",
  MenuItem
>;

/** Состав меню по типу узла */
function menuItems(node: TreeNode, hasSession: boolean, it: MenuItems): MenuItem[] {
  if (node.type === "workspace") {
    return [it.createProject, it.exportServers, "separator", it.settings, "separator", it.delete];
  }

  if (node.type === "project") {
    const danger = (node.data as { isDanger?: boolean }).isDanger ? it.unmarkDanger : it.markDanger;

    return [it.createConsole, it.cloneProject, "separator", it.exportServers, "separator", danger, "separator", it.settings, "separator", it.delete];
  }

  const isSsh = (node.data as ConsoleConfig).connectionType === "ssh";

  return [
    it.run,
    ...(hasSession ? [it.newInstance, it.reconnect] : []),
    it.connectionSettings,
    it.quickCommands,
    ...(isSsh ? [it.copySsh] : []),
    it.cloneConsole,
    "separator",
    it.delete,
  ];
}

/** Markdown со списком серверов узла; null — узел не воркспейс/проект или серверов нет */
function serversMarkdown(node: TreeNode, workspaces: Workspace[], t: TFunction): string | null {
  if (node.type === "workspace") {
    const ws = workspaces.find((w) => w.id === node.id);

    return ws ? buildServersMarkdown({ type: "workspace", data: ws }, t) : null;
  }

  if (node.type === "project") {
    const proj = findProject(workspaces, node.id)?.project;

    return proj ? buildServersMarkdown({ type: "project", data: proj }, t) : null;
  }

  return null;
}
