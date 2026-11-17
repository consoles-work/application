import type { QuickCommand, QuickCommandColor } from "../types";

// ══════════════════════════════════════
// Черновик формы быстрой команды
// ══════════════════════════════════════
// Общий для окна команд консоли и вкладки глобальных команд в настройках.
// Сохранение черновика: пустая команда не сохраняется; без подписи кнопка
// показывает первую строку команды; правка сохраняет счётчики запусков,
// новая команда начинает с нуля и встаёт в конец списка.

/** Черновик формы: id === null — новая команда */
export interface Draft {
  id: string | null;
  label: string;
  command: string;
  description: string;
  color: QuickCommandColor;
  group: string;
  confirm: boolean;
}

export const EMPTY_DRAFT: Draft = { id: null, label: "", command: "", description: "", color: "", group: "", confirm: false };

export function toDraft(c: QuickCommand): Draft {
  return {
    id: c.id,
    label: c.label,
    command: c.command,
    description: c.description ?? "",
    color: c.color ?? "",
    group: c.group ?? "",
    confirm: c.confirm ?? false,
  };
}

/** Черновик → новый список команд; null — команда пустая. Хвостовые пробелы и переводы строк срезаются. */
export function applyDraft(commands: QuickCommand[], draft: Draft): QuickCommand[] | null {
  const command = draft.command.replace(/\s+$/, "");

  if (!command.trim()) return null;

  const fields = {
    label: draft.label.trim() || command.trim().split("\n")[0],
    command,
    description: draft.description.trim() || undefined,
    color: draft.color || undefined,
    group: draft.group.trim() || undefined,
    confirm: draft.confirm,
  };

  if (!draft.id) return [...commands, { id: crypto.randomUUID(), ...fields }];

  return commands.map((c) => (c.id === draft.id ? { ...c, ...fields } : c));
}
