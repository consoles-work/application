import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useAppStore } from "../stores/appStore";
import {
  deleteWorkspace,
  deleteProject,
  deleteConsole,
} from "../lib/tauriCommands";
import { setNodeDanger } from "../lib/tauriCommands";
import type { TreeNode } from "../types";

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
}

export function ContextMenu({
  menu,
  onClose,
  onCreateProject,
  onCreateConsole,
  onRename,
  onToggleDanger,
  onEditConsole,
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
    try {
      await deleteWorkspace(menu.node.id);
      removeWorkspace(menu.node.id);
      showToast("success", `Workspace удалён`);
    } catch (e) {
      showToast("error", `Ошибка удаления: ${e}`);
    }
  };

  const handleDeleteProject = async () => {
    onClose();
    try {
      await deleteProject(menu.node.id);
      removeProject(menu.node.id);
      showToast("success", `Проект удалён`);
    } catch (e) {
      showToast("error", `Ошибка удаления: ${e}`);
    }
  };

  const handleDeleteConsole = async () => {
    onClose();
    try {
      await deleteConsole(menu.node.id);
      removeConsole(menu.node.id);
      showToast("success", `Консоль удалена`);
    } catch (e) {
      showToast("error", `Ошибка удаления: ${e}`);
    }
  };

  const handleOpenInVSCode = async () => {
    onClose();
    const proj = menu.node.data as { path: string };
    try {
      await shellOpen(`vscode://file${proj.path}`);
    } catch {
      // Fallback: попробовать через shell
      showToast("info", "Открытие в VS Code...");
    }
  };

  const handleOpenInFinder = async () => {
    onClose();
    const proj = menu.node.data as { path: string };
    try {
      await shellOpen(proj.path);
    } catch (e) {
      showToast("error", `Не удалось открыть: ${e}`);
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
      showToast("error", `Ошибка: ${e}`);
    }
  };

  const items = getMenuItems({
    node: menu.node,
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
}): MenuItem[] {
  const { node } = handlers;
  const data = node.data as { isDanger?: boolean };

  if (node.type === "workspace") {
    return [
      { label: "Добавить проект", icon: "+", action: handlers.onCreateProject },
      "separator",
      { label: "Переименовать", icon: "✎", action: handlers.onRename },
      "separator",
      { label: "Удалить workspace", icon: "✕", action: handlers.onDeleteWorkspace, danger: true },
    ];
  }

  if (node.type === "project") {
    return [
      { label: "Добавить консоль", icon: "+", action: handlers.onCreateConsole },
      "separator",
      { label: "Открыть в VS Code", icon: "⎋", action: handlers.onOpenVSCode },
      { label: "Открыть в Finder", icon: "⌂", action: handlers.onOpenFinder },
      "separator",
      data.isDanger
        ? { label: "Снять пометку опасности", icon: "✓", action: handlers.onToggleDanger }
        : { label: "⚠ Пометить как опасный...", icon: "⚠", action: handlers.onToggleDanger },
      "separator",
      { label: "Переименовать", icon: "✎", action: handlers.onRename },
      "separator",
      { label: "Удалить проект", icon: "✕", action: handlers.onDeleteProject, danger: true },
    ];
  }

  // console
  return [
    { label: "Запустить", icon: "▶", action: handlers.onRunConsole },
    { label: "Настройки подключения...", icon: "⚙", action: handlers.onEditConsole },
    "separator",
    data.isDanger
      ? { label: "Снять пометку опасности", icon: "✓", action: handlers.onToggleDanger }
      : { label: "⚠ Пометить как опасный...", icon: "⚠", action: handlers.onToggleDanger },
    "separator",
    { label: "Переименовать", icon: "✎", action: handlers.onRename },
    "separator",
    { label: "Удалить консоль", icon: "✕", action: handlers.onDeleteConsole, danger: true },
  ];
}