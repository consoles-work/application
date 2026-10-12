import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ask } from "@tauri-apps/plugin-dialog";
import { Pencil, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { setConsoleQuickCommands } from "../../lib/tauriCommands";
import type { QuickCommand } from "../../types";
import { useTranslation } from "react-i18next";

interface Props {
  consoleId: string;
  /** Сразу открыть форму редактирования этой команды */
  initialEditId?: string;
  onClose: () => void;
}

// Черновик формы: id === null — новая команда
type Draft = { id: string | null; label: string; command: string; description: string };

const EMPTY_DRAFT: Draft = { id: null, label: "", command: "", description: "" };

export function QuickCommandsDialog({ consoleId, initialEditId, onClose }: Props) {
  const { workspaces, updateConsole: storeUpdateConsole, showToast } = useAppStore();
  const { t } = useTranslation();

  const console_ = workspaces
    .flatMap((w) => w.projects)
    .flatMap((p) => p.consoles)
    .find((c) => c.id === consoleId);
  const commands = console_?.quickCommands ?? [];

  // Пустой список — сразу форма добавления
  const [draft, setDraft] = useState<Draft | null>(() => {
    const target = commands.find((c) => c.id === initialEditId);
    if (target) return { id: target.id, label: target.label, command: target.command, description: target.description ?? "" };
    return commands.length === 0 ? EMPTY_DRAFT : null;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc из формы возвращает к списку, из списка — закрывает диалог
      if (draft && commands.length > 0) setDraft(null);
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, draft, commands.length]);

  // Консоль удалили, пока диалог был открыт
  useEffect(() => {
    if (!console_) onClose();
  }, [console_, onClose]);

  const persist = async (next: QuickCommand[]) => {
    setSaving(true);
    try {
      await setConsoleQuickCommands(consoleId, next);
      storeUpdateConsole(consoleId, { quickCommands: next });
      return true;
    } catch (e) {
      showToast("error", t("dialogs.toastError", { error: e }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const command = draft.command.replace(/\s+$/, "");
    if (!command.trim()) {
      showToast("error", t("quickCommands.toastCommandRequired"));
      return;
    }
    // Без подписи на кнопке показываем саму команду (первую строку)
    const label = draft.label.trim() || command.trim().split("\n")[0];
    const description = draft.description.trim() || undefined;
    const next = draft.id
      ? commands.map((c) => (c.id === draft.id ? { ...c, label, command, description } : c))
      : [...commands, { id: crypto.randomUUID(), label, command, description }];
    if (await persist(next)) setDraft(null);
  };

  const handleDelete = async (cmd: QuickCommand) => {
    const confirmed = await ask(t("quickCommands.deleteConfirm", { label: cmd.label }), {
      title: t("quickCommands.deleteTitle"),
      kind: "warning",
    });
    if (!confirmed) return;
    await persist(commands.filter((c) => c.id !== cmd.id));
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= commands.length) return;
    const next = [...commands];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  if (!console_) return null;

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-sm text-text-primary outline-none focus:border-accent";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        className="bg-surface-2 border border-border rounded-xl shadow-2xl w-[480px] p-5 max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-1">{t("quickCommands.title")}</h2>
        <div className="text-2xs text-text-muted mb-4 truncate">{console_.name}</div>

        {draft ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <div className="text-2xs text-text-muted mb-1">{t("quickCommands.label")}</div>
              <input
                autoFocus
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder={t("quickCommands.labelPlaceholder")}
                className={inputCls}
              />
            </div>
            <div>
              <div className="text-2xs text-text-muted mb-1">{t("quickCommands.command")}</div>
              <textarea
                value={draft.command}
                onChange={(e) => setDraft({ ...draft, command: e.target.value })}
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
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("quickCommands.descriptionPlaceholder")}
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => (commands.length > 0 ? setDraft(null) : onClose())}
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
        ) : (
          <div className="flex flex-col gap-1">
            {commands.map((cmd, i) => (
              <div
                key={cmd.id}
                className="group flex items-start gap-2 px-2.5 py-2 rounded-lg bg-surface-0 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate">{cmd.label}</div>
                  <div className="text-2xs text-text-muted font-mono truncate">{cmd.command}</div>
                  {cmd.description && (
                    <div className="text-2xs text-text-secondary truncate">{cmd.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 text-text-muted">
                  <IconButton title={t("quickCommands.moveUp")} disabled={i === 0 || saving} onClick={() => handleMove(i, -1)}>
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton
                    title={t("quickCommands.moveDown")}
                    disabled={i === commands.length - 1 || saving}
                    onClick={() => handleMove(i, 1)}
                  >
                    <ArrowDown size={13} />
                  </IconButton>
                  <IconButton
                    title={t("quickCommands.edit")}
                    onClick={() =>
                      setDraft({ id: cmd.id, label: cmd.label, command: cmd.command, description: cmd.description ?? "" })
                    }
                  >
                    <Pencil size={13} />
                  </IconButton>
                  <IconButton title={t("quickCommands.delete")} danger disabled={saving} onClick={() => handleDelete(cmd)}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            ))}
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

function IconButton({
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
