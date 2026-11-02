import type { QuickCommand, Workspace } from "../types";
import type { SuggestOption } from "../components/SuggestInput";
import { allConsoles } from "./tree";

// ══════════════════════════════════════
// Группы быстрых команд
// ══════════════════════════════════════
// Группа — просто текстовое поле команды. Одна группа = одно название без
// учёта регистра и пробелов по краям; показывается написание первой команды.
// Порядок групп — по первой команде группы в общем списке; команды без
// группы идут первыми. Внутри группы — порядок общего списка.

export interface QuickCommandGroup {
  /** Название группы; "" — команды без группы */
  name: string;
  commands: QuickCommand[];
}

const groupKey = (c: QuickCommand) => (c.group ?? "").trim().toLowerCase();

/** Команды консоли → группы для панели и диалога */
export function groupQuickCommands(commands: QuickCommand[]): QuickCommandGroup[] {
  const byKey = new Map<string, QuickCommandGroup>([["", { name: "", commands: [] }]]);

  for (const cmd of commands) {
    const key = groupKey(cmd);

    const group = byKey.get(key);

    if (group) group.commands.push(cmd);
    else byKey.set(key, { name: (cmd.group ?? "").trim(), commands: [cmd] });
  }

  return [...byKey.values()].filter((g) => g.commands.length > 0);
}

/** Уже использованные группы во всех консолях: без дублей по регистру, по алфавиту, со счётчиком команд */
export function quickCommandGroupSuggestions(workspaces: Workspace[]): SuggestOption[] {
  const byKey = new Map<string, SuggestOption>();

  const commands = allConsoles(workspaces).flatMap(({ console: con }) => con.quickCommands ?? []);

  for (const cmd of commands) {
    const key = groupKey(cmd);

    if (!key) continue;

    const entry = byKey.get(key);

    if (entry) entry.count = (entry.count ?? 0) + 1;
    else byKey.set(key, { value: (cmd.group ?? "").trim(), count: 1 });
  }

  return [...byKey.values()].sort((a, b) => a.value.localeCompare(b.value));
}

/** Поменять команду местами с соседней по своей группе; null — двигать некуда */
export function moveWithinGroup(commands: QuickCommand[], id: string, delta: -1 | 1): QuickCommand[] | null {
  const from = commands.findIndex((c) => c.id === id);

  if (from < 0) return null;

  const key = groupKey(commands[from]);

  let to = from + delta;

  while (to >= 0 && to < commands.length && groupKey(commands[to]) !== key) to += delta;

  if (to < 0 || to >= commands.length) return null;

  const next = [...commands];

  [next[from], next[to]] = [next[to], next[from]];

  return next;
}
