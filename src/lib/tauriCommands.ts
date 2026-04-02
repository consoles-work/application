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
import type { Workspace, Project, ConsoleConfig, WikiPage, AiSession, AiMessage } from "../types";

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
  icon: string,
  color: string,
  path: string,
  defaultShell: string
): Promise<Project> {
  return invoke<Project>("create_project", {
    workspaceId,
    name,
    icon,
    color,
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
  sshExtraArgs?: string,
  sshPassphrase?: string,
  sshPassword?: string
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
    sshPassphrase,
    sshPassword,
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
  sshExtraArgs: string,
  sshPassphrase: string,
  sshPassword: string
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
    sshPassphrase,
    sshPassword,
  });
}

export async function deleteConsole(id: string): Promise<void> {
  return invoke("delete_console", { id });
}

// ── PTY (терминал) ──

export async function spawnPty(
  shell: string,
  cwd: string,
  envVars: Record<string, string>,
  sshKeyPath?: string,
  sshPassphrase?: string,
  sshPassword?: string
): Promise<number> {
  // Возвращает pty_id — числовой идентификатор сессии на Rust-стороне
  return invoke<number>("spawn_pty", { shell, cwd, envVars, sshKeyPath, sshPassphrase, sshPassword });
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

export async function setNodeExpanded(
  id: string,
  nodeType: string,
  isExpanded: boolean
): Promise<void> {
  return invoke("set_node_expanded", { id, nodeType, isExpanded });
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

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

export async function resetQuitDialog(): Promise<void> {
  return invoke("reset_quit_dialog");
}

// ── AI чат-сессии ──

export async function createAiSession(
  title: string,
  provider: string,
  model: string
): Promise<AiSession> {
  return invoke<AiSession>("create_ai_session", { title, provider, model });
}

export async function loadAiSessions(): Promise<AiSession[]> {
  return invoke<AiSession[]>("load_ai_sessions");
}

export async function renameAiSession(id: string, title: string): Promise<void> {
  return invoke("rename_ai_session", { id, title });
}

export async function deleteAiSession(id: string): Promise<void> {
  return invoke("delete_ai_session", { id });
}

export async function loadAiMessages(sessionId: string): Promise<AiMessage[]> {
  return invoke<AiMessage[]>("load_ai_messages", { sessionId });
}

export async function saveAiMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string
): Promise<AiMessage> {
  return invoke<AiMessage>("save_ai_message", { id, sessionId, role, content });
}

export async function updateAiMessage(id: string, content: string): Promise<void> {
  return invoke("update_ai_message", { id, content });
}

export async function clearAiSession(sessionId: string): Promise<void> {
  return invoke("clear_ai_session", { sessionId });
}

// ── Экспорт/импорт ──

export interface ImportPreview {
  exportedAt: string;
  workspaceCount: number;
  projectCount: number;
  consoleCount: number;
  wikiCount: number;
  aiSessionCount: number;
  aiMessageCount: number;
  hasPassword: boolean;
}

export async function exportData(
  filePath: string,
  includeTree: boolean,
  includeWiki: boolean,
  includeAi: boolean,
  userPassword?: string
): Promise<void> {
  return invoke("export_data", {
    filePath,
    includeTree,
    includeWiki,
    includeAi,
    userPassword: userPassword || null,
  });
}

export async function previewImport(
  filePath: string,
  userPassword?: string
): Promise<ImportPreview> {
  return invoke<ImportPreview>("preview_import", {
    filePath,
    userPassword: userPassword || null,
  });
}

export async function applyImport(
  filePath: string,
  userPassword: string | undefined,
  includeTree: boolean,
  includeWiki: boolean,
  includeAi: boolean,
  mode: "merge" | "replace"
): Promise<void> {
  return invoke("apply_import", {
    filePath,
    userPassword: userPassword || null,
    includeTree,
    includeWiki,
    includeAi,
    mode,
  });
}
