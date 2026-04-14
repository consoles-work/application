import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../stores/appStore";
import {
  deleteWorkspace,
  deleteProject,
  deleteConsole,
} from "../lib/tauriCommands";
import { setNodeDanger } from "../lib/tauriCommands";
import type { TreeNode } from "../types";
import { useTranslation } from "react-i18next";

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
  onRename: (node: TreeNode) => void;
  onToggleDanger: (node: TreeNode) => void;
  onEditConsole: (node: TreeNode) => void;
  onCloneConsole: (node: TreeNode) => void;
  onCloneProject: (node: TreeNode) => void;
  onReconnectConsole: (node: TreeNode) => void;
}

export function ContextMenu({
  menu,
  onClose,
  onCreateProject,
  onCreateConsole,
  onRename,
  onToggleDanger,
  onEditConsole,
  onCloneConsole,
  onCloneProject,
  onReconnectConsole,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {
    removeWorkspace,
    removeProject,
    removeConsole,
    openSession,
    sessions,
    setActiveSession,
    showToast,
  } = useAppStore();
  const { t } = useTranslation();

  // Закрывать по клику снаружи или Escape
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

  // Скорректировать позицию чтобы меню не выходило за экран
  const menuWidth = 200;
  const x = Math.min(menu.x, window.innerWidth - menuWidth - 8);
  const y = menu.y;

  const handleDeleteWorkspace = async () => {
    onClose();
    const confirmed = await ask(
      t("contextMenu.deleteWorkspaceConfirm", { name: menu.node.name }),
      { title: t("contextMenu.deleteWorkspaceTitle"), kind: "warning" }
    );
    if (!confirmed) return;
    try {
      await deleteWorkspace(menu.node.id);
      removeWorkspace(menu.node.id);
      showToast("success", t("contextMenu.toastWorkspaceDeleted"));
    } catch (e) {
      showToast("error", t("contextMenu.toastDeleteError", { error: e }));
    }
  };

  const handleDeleteProject = async () => {
    onClose();
    const confirmed = await ask(
      t("contextMenu.deleteProjectConfirm", { name: menu.node.name }),
      { title: t("contextMenu.deleteProjectTitle"), kind: "warning" }
    );
    if (!confirmed) return;
    try {
      await deleteProject(menu.node.id);
      removeProject(menu.node.id);
      showToast("success", t("contextMenu.toastProjectDeleted"));
    } catch (e) {
      showToast("error", t("contextMenu.toastDeleteError", { error: e }));
    }
  };

  const handleDeleteConsole = async () => {
    onClose();
    const confirmed = await ask(
      t("contextMenu.deleteConsoleConfirm", { name: menu.node.name }),
      { title: t("contextMenu.deleteConsoleTitle"), kind: "warning" }
    );
    if (!confirmed) return;
    try {
      await deleteConsole(menu.node.id);
      removeConsole(menu.node.id);
      showToast("success", t("contextMenu.toastConsoleDeleted"));
    } catch (e) {
      showToast("error", t("contextMenu.toastDeleteError", { error: e }));
    }
  };

  const handleOpenInVSCode = async () => {
    onClose();
    const proj = menu.node.data as { path: string };
    try {
      await shellOpen(`vscode://file${proj.path}`);
    } catch {
      // Fallback: попробовать через shell
      showToast("info", t("contextMenu.toastOpeningVSCode"));
    }
  };

  const handleOpenInFinder = async () => {
    onClose();
    const proj = menu.node.data as { path: string };
    try {
      await shellOpen(proj.path);
    } catch (e) {
      showToast("error", t("contextMenu.toastOpenError", { error: e }));
    }
  };

  const handleRunConsole = () => {
    onClose();
    const existing = sessions.find((s) => s.console_id === menu.node.id);
    if (existing) {
      setActiveSession(existing.id);
    } else {
      openSession({
        id: `session-${Date.now()}`,
        console_id: menu.node.id,
        title: menu.node.name,
        is_active: true,
      });
    }
  };

  const handleToggleDanger = async () => {
    onClose();
    const data = menu.node.data as { isDanger?: boolean; dangerLabel?: string };
    const isDanger = !data.isDanger;
    const dangerLabel = data.dangerLabel || "PRODUCTION";
    try {
      await setNodeDanger(menu.node.id, menu.node.type, isDanger, dangerLabel);
      onToggleDanger(menu.node);
    } catch (e) {
      showToast("error", t("contextMenu.toastDangerError", { error: e }));
    }
  };

  const items = getMenuItems({
    node: menu.node,
    t,
    onCreateProject: () => { onClose(); onCreateProject(menu.node.id); },
    onCreateConsole: () => { onClose(); onCreateConsole(menu.node.id); },
    onRename: () => { onClose(); onRename(menu.node); },
    onDeleteWorkspace: handleDeleteWorkspace,
    onDeleteProject: handleDeleteProject,
    onDeleteConsole: handleDeleteConsole,
    onOpenVSCode: handleOpenInVSCode,
    onOpenFinder: handleOpenInFinder,
    onRunConsole: handleRunConsole,
    onToggleDanger: handleToggleDanger,
    onEditConsole: () => { onClose(); onEditConsole(menu.node); },
    onCloneConsole: () => { onClose(); onCloneConsole(menu.node); },
    onCloneProject: () => { onClose(); onCloneProject(menu.node); },
    onReconnectConsole: () => { onClose(); onReconnectConsole(menu.node); },
    sessions,
  });

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ top: y, left: x, width: menuWidth }}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-3 flex items-center gap-2 ${
              item.danger ? "text-danger hover:text-danger" : "text-text-primary"
            }`}
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

type MenuItem =
  | "separator"
  | { label: string; icon: string; action: () => void; danger?: boolean };

function getMenuItems(handlers: {
  node: TreeNode;
  t: (key: string) => string;
  onCreateProject: () => void;
  onCreateConsole: () => void;
  onRename: () => void;
  onDeleteWorkspace: () => void;
  onDeleteProject: () => void;
  onDeleteConsole: () => void;
  onOpenVSCode: () => void;
  onOpenFinder: () => void;
  onRunConsole: () => void;
  onToggleDanger: () => void;
  onEditConsole: () => void;
  onCloneConsole: () => void;
  onCloneProject: () => void;
  onReconnectConsole: () => void;
  sessions: { console_id: string }[];
}): MenuItem[] {
  const { node, t } = handlers;
  const data = node.data as { isDanger?: boolean };

  if (node.type === "workspace") {
    return [
      { label: t("contextMenu.addProject"), icon: "+", action: handlers.onCreateProject },
      "separator",
      { label: t("contextMenu.rename"), icon: "✎", action: handlers.onRename },
      "separator",
      { label: t("contextMenu.deleteWorkspace"), icon: "✕", action: handlers.onDeleteWorkspace, danger: true },
    ];
  }

  if (node.type === "project") {
    return [
      { label: t("contextMenu.addConsole"), icon: "+", action: handlers.onCreateConsole },
      { label: t("contextMenu.cloneProject"), icon: "⎘", action: handlers.onCloneProject },
      "separator",
      { label: t("contextMenu.openInVSCode"), icon: "⎋", action: handlers.onOpenVSCode },
      { label: t("contextMenu.openInFinder"), icon: "⌂", action: handlers.onOpenFinder },
      "separator",
      data.isDanger
        ? { label: t("contextMenu.removeDangerFlag"), icon: "✓", action: handlers.onToggleDanger }
        : { label: t("contextMenu.markAsDangerous"), icon: "⚠", action: handlers.onToggleDanger },
      "separator",
      { label: t("contextMenu.rename"), icon: "✎", action: handlers.onRename },
      "separator",
      { label: t("contextMenu.deleteProject"), icon: "✕", action: handlers.onDeleteProject, danger: true },
    ];
  }

  // console
  const hasSession = handlers.sessions.some((s) => s.console_id === node.id);
  return [
    { label: t("contextMenu.runConsole"), icon: "▶", action: handlers.onRunConsole },
    ...(hasSession ? [{ label: t("contextMenu.reconnectConsole"), icon: "↺", action: handlers.onReconnectConsole } as MenuItem] : []),
    { label: t("contextMenu.connectionSettings"), icon: "⚙", action: handlers.onEditConsole },
    { label: t("contextMenu.cloneConsole"), icon: "⎘", action: handlers.onCloneConsole },
    "separator" as MenuItem,
    { label: t("contextMenu.rename"), icon: "✎", action: handlers.onRename },
    "separator" as MenuItem,
    { label: t("contextMenu.deleteConsole"), icon: "✕", action: handlers.onDeleteConsole, danger: true },
  ];
}
