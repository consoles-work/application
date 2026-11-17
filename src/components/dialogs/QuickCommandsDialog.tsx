import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { setConsoleQuickCommands } from "../../lib/tauriCommands";
import type { QuickCommand } from "../../types";
import { quickCommandHex } from "../../lib/quickCommandColors";
import { formatSavedTime, sumQuickCommandStats, TYPING_CHARS_PER_MINUTE } from "../../lib/quickCommandStats";
import { useTranslation } from "react-i18next";
import { findConsole } from "../../lib/tree";
import { useEscape } from "../../hooks/useEscape";
import { groupQuickCommands, quickCommandGroupSuggestions } from "../../lib/quickCommandGroups";
import { EMPTY_DRAFT, toDraft } from "../../lib/quickCommandDraft";
import { IconButton, QuickCommandForm, useQuickCommandEditor } from "./QuickCommandEditor";

// ══════════════════════════════════════
// QuickCommandsDialog — кнопки быстрых команд консоли
// ══════════════════════════════════════
// Список кнопок по группам (порядок внутри группы, правка, удаление) и форма
// одной команды (общая с глобальными командами — QuickCommandEditor). Группа —
// комбобокс, как «Хостинг» у консоли: вписать новую или выбрать из уже
// использованных во всех консолях. Пустой список — сразу форма добавления;
// можно открыть сразу на правке нужной кнопки (ПКМ по ней под терминалом).
// Escape из формы — к списку, из списка — закрыть. Консоль удалили, пока
// диалог открыт, — он закрывается.

interface Props {
  consoleId: string;
  /** Сразу открыть форму редактирования этой команды */
  initialEditId?: string;
  onClose: () => void;
}

export function QuickCommandsDialog({ consoleId, initialEditId, onClose }: Props) {
  const { workspaces, updateConsole: storeUpdateConsole } = useAppStore();
  const { t } = useTranslation();

  const console_ = findConsole(workspaces, consoleId)?.console;
  const commands = console_?.quickCommands ?? [];

  // Список целиком — в БД, затем в стор
  const save = async (next: QuickCommand[]) => {
    await setConsoleQuickCommands(consoleId, next);

    storeUpdateConsole(consoleId, { quickCommands: next });
  };

  const { draft, setDraft, saving, submit, remove, move } = useQuickCommandEditor(commands, save, initialEditId);

  const groupOptions = useMemo(() => quickCommandGroupSuggestions(workspaces), [workspaces]);

  useEscape(() => (draft && commands.length > 0 ? setDraft(null) : onClose()));

  useEffect(() => {
    if (!console_) onClose();
  }, [console_, onClose]);

  if (!console_) return null;

  const totals = sumQuickCommandStats(commands);

  const groups = groupQuickCommands(commands);

  // Заголовок «Без группы» нужен, только если рядом есть именованные группы
  const showGroupHeaders = groups.some((g) => g.name);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        className="bg-surface-2 border border-border rounded-xl shadow-2xl w-[480px] p-5 max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-1">{t("quickCommands.title")}</h2>
        <div className="text-2xs text-text-muted mb-4 truncate">{console_.name}</div>

        {draft ? (
          <QuickCommandForm
            draft={draft}
            onChange={setDraft}
            groupOptions={groupOptions}
            saving={saving}
            onSubmit={submit}
            onCancel={() => (commands.length > 0 ? setDraft(null) : onClose())}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map((group) => (
              <div key={group.name || "-"} className="flex flex-col gap-1">
                {showGroupHeaders && (
                  <div className="flex items-center gap-1 mt-2 first:mt-0 px-0.5">
                    <span className={`text-2xs font-semibold uppercase tracking-wide truncate ${group.name ? "text-text-secondary" : "text-text-muted"}`}>
                      {group.name || t("quickCommands.noGroup")}
                    </span>
                    <span className="text-2xs text-text-muted">{group.commands.length}</span>
                    <div className="flex-1 border-t border-border ml-1" />
                    <IconButton
                      title={t("quickCommands.addToGroup")}
                      onClick={() => setDraft({ ...EMPTY_DRAFT, group: group.name })}
                    >
                      <Plus size={12} />
                    </IconButton>
                  </div>
                )}
                {group.commands.map((cmd, i) => (
                  <CommandRow
                    key={cmd.id}
                    cmd={cmd}
                    saving={saving}
                    isFirst={i === 0}
                    isLast={i === group.commands.length - 1}
                    onMove={(delta) => move(cmd, delta)}
                    onEdit={() => setDraft(toDraft(cmd))}
                    onDelete={() => remove(cmd)}
                  />
                ))}
              </div>
            ))}
            {totals.runs > 0 && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30">
                <div className="text-xs text-text-primary">
                  {t("quickCommands.statsTotal", { runs: totals.runs, saved: formatSavedTime(totals.chars, t) })}
                </div>
                <div className="text-2xs text-text-muted">
                  {t("quickCommands.statsFormula", { cpm: TYPING_CHARS_PER_MINUTE })}
                </div>
              </div>
            )}
            <div className="flex justify-between gap-2 mt-3">
              <button
                type="button"
                onClick={() => setDraft(EMPTY_DRAFT)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30"
              >
                <Plus size={13} />
                {t("quickCommands.add")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg text-text-secondary hover:bg-surface-3"
              >
                {t("quickCommands.close")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Строка списка: цвет, подпись, команда, описание, статистика и кнопки действий */
function CommandRow({
  cmd,
  saving,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
}: {
  cmd: QuickCommand;
  saving: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="group flex items-start gap-2 px-2.5 py-2 rounded-lg bg-surface-0 border border-border">
      <span
        className="mt-1 w-2.5 h-2.5 rounded-full shrink-0 border border-border"
        style={{ backgroundColor: quickCommandHex(cmd.color) || "transparent" }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate">
          {cmd.confirm && (
            <span className="text-red-400 mr-1" title={t("quickCommands.confirm")}>⚠</span>
          )}
          {cmd.label}
        </div>
        <div className="text-2xs text-text-muted font-mono truncate">{cmd.command}</div>
        {cmd.description && <div className="text-2xs text-text-secondary truncate">{cmd.description}</div>}
        <div className="text-2xs text-text-muted">
          {cmd.runCount
            ? t("quickCommands.stats", { runs: cmd.runCount, saved: formatSavedTime(cmd.savedChars ?? 0, t) })
            : t("quickCommands.statsNever")}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 text-text-muted">
        <IconButton title={t("quickCommands.moveUp")} disabled={isFirst || saving} onClick={() => onMove(-1)}>
          <ArrowUp size={13} />
        </IconButton>
        <IconButton title={t("quickCommands.moveDown")} disabled={isLast || saving} onClick={() => onMove(1)}>
          <ArrowDown size={13} />
        </IconButton>
        <IconButton title={t("quickCommands.edit")} onClick={onEdit}>
          <Pencil size={13} />
        </IconButton>
        <IconButton title={t("quickCommands.delete")} danger disabled={saving} onClick={onDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
  );
}
