// ══════════════════════════════════════════════
// consoles.work — Модель данных
// ══════════════════════════════════════════════

// ── Иерархия: Workspace → Project → Console ──

export interface Workspace {
  id: string;
  name: string;
  icon: string; // emoji или lucide icon name
  color: string; // hex цвет для маркировки
  sort_order: number;
  is_expanded: boolean;
  projects: Project[];
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  icon: string;
  color: string;
  path: string; // путь к директории проекта
  default_shell: ShellType;
  env_vars: Record<string, string>; // переменные окружения
  sort_order: number;
  is_expanded: boolean;
  isDanger: boolean;
  dangerLabel: string;
  consoles: ConsoleConfig[];
}

export interface ConsoleConfig {
  id: string;
  projectId: string;
  name: string;
  shellOverride?: ShellType; // если отличается от проекта
  cwdOverride?: string; // если отличается от project.path
  startupCmd?: string; // команды при запуске (многострочные, каждая строка — отдельная команда)
  envVars?: Record<string, string>; // доп. переменные
  sortOrder: number;
  isDanger: boolean;
  dangerLabel: string;
  // Параметры подключения
  connectionType: string; // "local" | "ssh"
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshKeyPath: string;
  sshExtraArgs: string;
  sshPassphrase: string;
  sshPassword: string;
}

// ── Wiki ──

export interface WikiPage {
  id: string;
  parentType: "global" | "workspace" | "project" | "console";
  parentId: string;
  title: string;
  content: string; // JSON от TipTap / или Markdown
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Терминальная сессия (runtime, не сохраняется в БД) ──

export interface TerminalSession {
  id: string;
  console_id: string; // ссылка на ConsoleConfig
  title: string; // отображаемое имя во вкладке
  is_active: boolean;
  pty_id?: number; // ID процесса на Rust-стороне
  reconnectKey?: number; // инкрементируется для перезапуска PTY
}

// ── Типы ──

export type ShellType = "bash" | "zsh" | "fish" | "powershell" | "cmd" | "wsl";

export type TreeNodeType = "workspace" | "project" | "console";

export interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  icon: string;
  color: string;
  depth: number;
  is_expanded: boolean;
  has_children: boolean;
  data: Workspace | Project | ConsoleConfig;
}

// ── Навигация ──

export interface SelectedNode {
  type: TreeNodeType;
  id: string;
}

// ── AI чат-сессии ──

export interface AiSession {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// ── Настройки приложения ──

export interface AppSettings {
  theme: "dark" | "light";
  font_size: number;
  font_family: string;
  terminal_font_size: number;
  terminal_scrollback: number;
  show_tree_panel: boolean;
  show_wiki_panel: boolean;
  tree_panel_width: number;
  wiki_panel_width: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  font_size: 14,
  font_family: "Inter",
  terminal_font_size: 14,
  terminal_scrollback: 10000,
  show_tree_panel: true,
  show_wiki_panel: true,
  tree_panel_width: 250,
  wiki_panel_width: 350,
};
