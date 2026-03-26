// ══════════════════════════════════════════════
// Обёртки для вызова Rust-команд через Tauri IPC
// ══════════════════════════════════════════════
//
// Каждая функция здесь соответствует #[tauri::command]
// в src-tauri/src/commands.rs
//
// invoke() — это мост между TypeScript и Rust.
// Вызов: invoke("имя_команды", { аргументы })
// Возврат: Promise с результатом из Rust

import { invoke } from "@tauri-apps/api/core";
import type { Workspace, Project, ConsoleConfig, WikiPage } from "../types";

export interface DbInfo {
  path: string;
  dirPath: string;
  sizeBytes: number;
  createdAt: string;
}

// ── Дерево проектов ──

export async function loadAllWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>("load_workspaces");
}

export async function createWorkspace(
  name: string,
  icon: string,
  color: string
): Promise<Workspace> {
  return invoke<Workspace>("create_workspace", { name, icon, color });
}

export async function updateWorkspace(
  id: string,
  name: string,
  icon: string,
  color: string
): Promise<void> {
  return invoke("update_workspace", { id, name, icon, color });
}

export async function deleteWorkspace(id: string): Promise<void> {
  return invoke("delete_workspace", { id });
}

export async function createProject(
  workspaceId: string,
  name: string,
  path: string,
  defaultShell: string
): Promise<Project> {
  return invoke<Project>("create_project", {
    workspaceId,
    name,
    path,
    defaultShell,
  });
}

export async function updateProject(
  id: string,
  name: string,
  icon: string,
  color: string,
  path: string,
  defaultShell: string
): Promise<void> {
  return invoke("update_project", { id, name, icon, color, path, defaultShell });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

export async function createConsole(
  projectId: string,
  name: string,
  startupCmd?: string,
  connectionType?: string,
  sshHost?: string,
  sshPort?: number,
  sshUser?: string,
  sshKeyPath?: string,
  sshExtraArgs?: string
): Promise<ConsoleConfig> {
  return invoke<ConsoleConfig>("create_console", {
    projectId,
    name,
    startupCmd,
    connectionType,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    sshExtraArgs,
  });
}

export async function updateConsole(id: string, name: string): Promise<void> {
  return invoke("update_console", { id, name });
}

export async function updateConsoleConfig(
  id: string,
  name: string,
  startupCmd: string | undefined,
  connectionType: string,
  sshHost: string,
  sshPort: number,
  sshUser: string,
  sshKeyPath: string,
  sshExtraArgs: string
): Promise<void> {
  return invoke("update_console_config", {
    id,
    name,
    startupCmd: startupCmd || undefined,
    connectionType,
    sshHost,
    sshPort,
    sshUser,
    sshKeyPath,
    sshExtraArgs,
  });
}

export async function deleteConsole(id: string): Promise<void> {
  return invoke("delete_console", { id });
}

// ── PTY (терминал) ──

export async function spawnPty(
  shell: string,
  cwd: string,
  envVars: Record<string, string>
): Promise<number> {
  // Возвращает pty_id — числовой идентификатор сессии на Rust-стороне
  return invoke<number>("spawn_pty", { shell, cwd, envVars });
}

export async function writeToPty(
  ptyId: number,
  data: string
): Promise<void> {
  return invoke("write_to_pty", { ptyId, data });
}

export async function resizePty(
  ptyId: number,
  cols: number,
  rows: number
): Promise<void> {
  return invoke("resize_pty", { ptyId, cols, rows });
}

export async function killPty(ptyId: number): Promise<void> {
  return invoke("kill_pty", { ptyId });
}

// ── Wiki ──

export async function loadWikiPages(
  parentType: string,
  parentId: string
): Promise<WikiPage[]> {
  return invoke<WikiPage[]>("load_wiki_pages", { parentType, parentId });
}

export async function saveWikiPage(page: WikiPage): Promise<void> {
  return invoke("save_wiki_page", { page });
}

export async function deleteWikiPage(id: string): Promise<void> {
  return invoke("delete_wiki_page", { id });
}

export async function searchWiki(query: string): Promise<WikiPage[]> {
  return invoke<WikiPage[]>("search_wiki", { query });
}

export async function setNodeDanger(
  id: string,
  nodeType: string,
  isDanger: boolean,
  dangerLabel: string
): Promise<void> {
  return invoke("set_node_danger", { id, nodeType, isDanger, dangerLabel });
}

export async function cloneConsole(id: string): Promise<ConsoleConfig> {
  return invoke<ConsoleConfig>("clone_console", { id });
}

export async function cloneProject(id: string): Promise<Project> {
  return invoke<Project>("clone_project", { id });
}

// ── Настройки ──

export async function getSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_settings");
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function getDbInfo(): Promise<DbInfo> {
  return invoke<DbInfo>("get_db_info");
}
