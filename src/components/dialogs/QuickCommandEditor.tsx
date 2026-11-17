import { useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { Play, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/appStore";
import type { QuickCommand, QuickCommandColor } from "../../types";
import { QUICK_COMMAND_COLORS, quickCommandHex } from "../../lib/quickCommandColors";
import { moveWithinGroup } from "../../lib/quickCommandGroups";
import { applyDraft, toDraft, EMPTY_DRAFT, type Draft } from "../../lib/quickCommandDraft";
import type { SuggestOption } from "../SuggestInput";
import { SuggestInput } from "../SuggestInput";

// ══════════════════════════════════════
// Редактор списка быстрых команд
// ══════════════════════════════════════
// Общий для окна команд консоли и вкладки глобальных команд в настройках:
// они различаются только тем, куда сохраняется список и как он показан.
// Любое изменение (добавить, править, удалить, переставить) сохраняет
// список целиком. Не сохранилось — тост, форма не закрывается.
// Удаление — после подтверждения. «Выше»/«Ниже» — внутри своей группы.

/**
 * Состояние редактора: черновик формы (null — показан список) и сохранение.
 * Пустой список или команда на правке (ПКМ по кнопке) — сразу форма.
 */
export function useQuickCommandEditor(
  commands: QuickCommand[],
  save: (next: QuickCommand[]) => Promise<void>,
  initialEditId?: string
) {
  const showToast = useAppStore((s) => s.showToast);
  const { t } = useTranslation();

  const [draft, setDraft] = useState<Draft | null>(() => {
    const target = commands.find((c) => c.id === initialEditId);

    if (target) return toDraft(target);

    return commands.length === 0 ? EMPTY_DRAFT : null;
  });

  const [saving, setSaving] = useState(false);

  // Список целиком; false — не сохранилось (тост уже показан)
  const persist = async (next: QuickCommand[]) => {
    setSaving(true);

    try {
      await save(next);

      return true;
    } catch (e) {
      showToast("error", t("dialogs.toastError", { error: e }));

      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!draft) return;

    const next = applyDraft(commands, draft);

    if (!next) {
      showToast("error", t("quickCommands.toastCommandRequired"));

      return;
    }

    if (await persist(next)) setDraft(null);
  };

  const remove = async (cmd: QuickCommand) => {
    const confirmed = await ask(t("quickCommands.deleteConfirm", { label: cmd.label }), {
      title: t("quickCommands.deleteTitle"),
      kind: "warning",
    });

    if (!confirmed) return;

    await persist(commands.filter((c) => c.id !== cmd.id));
  };

  const move = (cmd: QuickCommand, delta: -1 | 1) => {
    const next = moveWithinGroup(commands, cmd.id, delta);

    if (next) persist(next);
  };

  return { draft, setDraft, saving, persist, submit, remove, move };
}

/** Форма одной команды: подпись, группа, команда, описание, цвет, предупреждение, превью кнопки */
export function QuickCommandForm({
  draft,
  onChange,
  groupOptions,
  saving,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  groupOptions: SuggestOption[];
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <div className="text-2xs text-text-muted mb-1">{t("quickCommands.label")}</div>
        <input
          autoFocus
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder={t("quickCommands.labelPlaceholder")}
          className={inputCls}
        />
      </div>
      <div>
        <div className="text-2xs text-text-muted mb-1">{t("quickCommands.group")}</div>
        <SuggestInput
          value={draft.group}
          onChange={(group) => onChange({ ...draft, group })}
          options={groupOptions}
          placeholder={t("quickCommands.groupPlaceholder")}
          className={inputCls}
        />
        <div className="text-2xs text-text-muted mt-1">
          {groupOptions.length > 0 ? t("quickCommands.groupPickHint") : t("quickCommands.groupHint")}
        </div>
      </div>
      <div>
        <div className="text-2xs text-text-muted mb-1">{t("quickCommands.command")}</div>
        <textarea
          value={draft.command}
          onChange={(e) => onChange({ ...draft, command: e.target.value })}
          placeholder="docker compose ps"
          rows={3}
          className={`${inputCls} font-mono text-xs resize-y`}
        />
        <div className="text-2xs text-text-muted mt-1">{t("quickCommands.commandHint")}</div>
      </div>
      <div>
        <div className="text-2xs text-text-muted mb-1">{t("quickCommands.description")}</div>
        <input
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder={t("quickCommands.descriptionPlaceholder")}
          className={inputCls}
        />
      </div>
      <div>
        <div className="text-2xs text-text-muted mb-1.5">{t("quickCommands.color")}</div>
        <div className="flex items-center gap-1.5">
          {QUICK_COMMAND_COLORS.map(({ id, hex }) => (
            <button
              key={id || "none"}
              type="button"
              title={t(`quickCommands.colors.${id || "none"}`)}
              onClick={() => onChange({ ...draft, color: id })}
              className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                draft.color === id ? "ring-2 ring-accent ring-offset-1 ring-offset-surface-2" : ""
              } ${hex ? "border-transparent" : "border-border bg-surface-0 text-text-muted"}`}
              style={hex ? { backgroundColor: hex } : undefined}
            >
              {!hex && <Ban size={12} />}
            </button>
          ))}
        </div>
        <div className="text-2xs text-text-muted mt-1">{t("quickCommands.colorHint")}</div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.confirm}
          onChange={(e) => onChange({ ...draft, confirm: e.target.checked })}
          className="accent-red-400"
        />
        <span className="text-xs text-text-primary">{t("quickCommands.confirm")}</span>
      </label>
      <div className="mt-1">
        <div className="text-2xs text-text-muted mb-1">{t("quickCommands.preview")}</div>
        <QuickCommandButtonPreview label={draft.label.trim() || draft.command.trim().split("\n")[0] || "…"} color={draft.color} />
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg text-text-secondary hover:bg-surface-3"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50"
        >
          {draft.id ? t("common.save") : t("quickCommands.add")}
        </button>
      </div>
    </form>
  );
}

export function IconButton({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1 rounded hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? "hover:text-danger" : "hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

// Как кнопка будет выглядеть в панели под терминалом
function QuickCommandButtonPreview({ label, color }: { label: string; color: QuickCommandColor }) {
  const hex = quickCommandHex(color);

  return (
    <span
      className="inline-flex items-center gap-1.5 max-w-[240px] px-2.5 py-1 rounded-md text-xs text-text-primary bg-surface-3 border border-border"
      style={hex ? { backgroundColor: `${hex}26`, borderColor: `${hex}99` } : undefined}
    >
      <Play size={11} className="shrink-0 fill-current" style={hex ? { color: hex } : undefined} />
      <span className="truncate">{label}</span>
    </span>
  );
}
