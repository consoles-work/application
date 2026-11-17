import { useMemo } from "react";
import { Pencil, Trash2, ArrowUp, ArrowDown, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/appStore";
import { setSetting } from "../lib/tauriCommands";
import type { QuickCommand } from "../types";
import { quickCommandHex } from "../lib/quickCommandColors";
import { formatSavedTime, sumQuickCommandStats, TYPING_CHARS_PER_MINUTE } from "../lib/quickCommandStats";
import { groupQuickCommands, groupSuggestions } from "../lib/quickCommandGroups";
import { EMPTY_DRAFT, toDraft } from "../lib/quickCommandDraft";
import { GLOBAL_QUICK_KEY, GLOBAL_QUICK_VISIBLE_KEY, globalQuickCommands, missingDefaults } from "../lib/globalQuickCommands";
import { IconButton, QuickCommandForm, useQuickCommandEditor } from "./dialogs/QuickCommandEditor";
import { Toggle } from "./Toggle";

// ══════════════════════════════════════
// GlobalQuickCommandsTab — «Настройки → Быстрые команды»
// ══════════════════════════════════════
// Глобальные команды — общие для всех консолей, на своей панели под любым
// терминалом. Вкладка показывает их таблицей по группам: подпись и
// описание, команда, число запусков, порядок внутри группы, правка, удаление;
// «+» у группы добавляет команду сразу в неё. Форма команды — та же, что у
// команд консоли. Флажок наверху — то же, что кнопка в заголовке окна:
// показывать ли панель.
// «Вернуть стандартные» добавляет в конец команды стандартного набора,
// которых в списке нет; нечего добавлять — тост об этом.
// Сохранение — список целиком в настройку: сначала в БД, затем в стор
// (панель под терминалом подхватывает сразу). Не сохранилось — тост, форма
// не закрывается.

interface Props {
  /** Сразу открыть форму этой команды (ПКМ по кнопке под терминалом) */
  initialEditId?: string;
  /** Сохранить обычную настройку (видимость панели) — как остальные вкладки */
  onChange: (key: string, value: string) => void;
}

export function GlobalQuickCommandsTab({ initialEditId, onChange }: Props) {
  const { settings, setSetting: storeSetting, showToast } = useAppStore();
  const { t } = useTranslation();

  const commands = useMemo(() => globalQuickCommands(settings[GLOBAL_QUICK_KEY], t), [settings, t]);

  const visible = settings[GLOBAL_QUICK_VISIBLE_KEY] === "true";

  // Список целиком — в БД, затем в стор; ошибку показывает редактор
  const save = async (next: QuickCommand[]) => {
    const json = JSON.stringify(next);

    await setSetting(GLOBAL_QUICK_KEY, json);

    storeSetting(GLOBAL_QUICK_KEY, json);
  };

  const { draft, setDraft, saving, persist, submit, remove, move } = useQuickCommandEditor(commands, save, initialEditId);

  const groupOptions = useMemo(() => groupSuggestions(commands), [commands]);

  const handleRestore = async () => {
    const missing = missingDefaults(commands, t);

    if (missing.length === 0) {
      showToast("info", t("globalQuick.nothingToRestore"));

      return;
    }

    if (await persist([...commands, ...missing])) showToast("success", t("globalQuick.restored", { count: missing.length }));
  };

  if (draft) {
    return (
      <QuickCommandForm
        draft={draft}
        onChange={setDraft}
        groupOptions={groupOptions}
        saving={saving}
        onSubmit={submit}
        onCancel={() => setDraft(null)}
      />
    );
  }

  const totals = sumQuickCommandStats(commands);

  const groups = groupQuickCommands(commands);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-text-secondary">{t("globalQuick.hint")}</div>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-xs font-medium text-text-secondary">{t("globalQuick.showPanel")}</span>
        <Toggle on={visible} onClick={() => onChange(GLOBAL_QUICK_VISIBLE_KEY, String(!visible))} />
      </label>

      <div className="flex items-center gap-2">
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
          disabled={saving}
          onClick={handleRestore}
          title={t("globalQuick.restoreHint")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-text-secondary border border-border hover:bg-surface-2 disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {t("globalQuick.restore")}
        </button>
        <span className="ml-auto text-2xs text-text-muted">{t("globalQuick.count", { count: commands.length })}</span>
      </div>

      {commands.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-muted">{t("globalQuick.empty")}</div>
      ) : (
        <table className="w-full table-fixed text-xs border-collapse">
          <colgroup>
            <col className="w-[34%]" />
            <col />
            <col className="w-[64px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead>
            <tr className="text-2xs text-text-muted text-left border-b border-border">
              <th className="font-normal py-1.5 pl-2">{t("globalQuick.colLabel")}</th>
              <th className="font-normal py-1.5">{t("globalQuick.colCommand")}</th>
              <th className="font-normal py-1.5 text-right pr-2">{t("globalQuick.colRuns")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.name || "-"}
                name={group.name}
                commands={group.commands}
                saving={saving}
                onAdd={() => setDraft({ ...EMPTY_DRAFT, group: group.name })}
                onMove={move}
                onEdit={(cmd) => setDraft(toDraft(cmd))}
                onDelete={remove}
              />
            ))}
          </tbody>
        </table>
      )}

      {totals.runs > 0 && (
        <div className="px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30">
          <div className="text-xs text-text-primary">
            {t("quickCommands.statsTotal", { runs: totals.runs, saved: formatSavedTime(totals.chars, t) })}
          </div>
          <div className="text-2xs text-text-muted">{t("quickCommands.statsFormula", { cpm: TYPING_CHARS_PER_MINUTE })}</div>
        </div>
      )}
    </div>
  );
}

/** Заголовок группы (название, число команд, «+») и строки её команд */
function GroupRows({
  name,
  commands,
  saving,
  onAdd,
  onMove,
  onEdit,
  onDelete,
}: {
  name: string;
  commands: QuickCommand[];
  saving: boolean;
  onAdd: () => void;
  onMove: (cmd: QuickCommand, delta: -1 | 1) => void;
  onEdit: (cmd: QuickCommand) => void;
  onDelete: (cmd: QuickCommand) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <tr className="bg-surface-2/60 border-b border-border">
        <td colSpan={4} className="py-1 pl-2 pr-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-2xs font-semibold uppercase tracking-wide truncate ${name ? "text-text-secondary" : "text-text-muted"}`}>
              {name || t("quickCommands.noGroup")}
            </span>
            <span className="text-2xs text-text-muted">{commands.length}</span>
            <div className="flex-1" />
            <span className="text-text-muted">
              <IconButton title={t("quickCommands.addToGroup")} onClick={onAdd}>
                <Plus size={12} />
              </IconButton>
            </span>
          </div>
        </td>
      </tr>
      {commands.map((cmd, i) => (
        <tr key={cmd.id} className="border-b border-border/60 hover:bg-surface-2/40 align-top">
          <td className="py-1.5 pl-2 pr-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: quickCommandHex(cmd.color) || "transparent" }}
              />
              {cmd.confirm && (
                <span className="text-red-400 shrink-0" title={t("quickCommands.confirm")}>
                  ⚠
                </span>
              )}
              <span className="truncate text-text-primary">{cmd.label}</span>
            </div>
            {cmd.description && <div className="pl-4 text-2xs text-text-muted truncate">{cmd.description}</div>}
          </td>
          <td className="py-1.5 pr-2">
            <div className="font-mono text-2xs text-text-secondary truncate" title={cmd.command}>
              {cmd.command}
            </div>
          </td>
          <td className="py-1.5 pr-2 text-right text-2xs text-text-muted tabular-nums">{cmd.runCount ?? 0}</td>
          <td className="py-1 pr-1">
            <div className="flex items-center justify-end gap-0.5 text-text-muted">
              <IconButton title={t("quickCommands.moveUp")} disabled={i === 0 || saving} onClick={() => onMove(cmd, -1)}>
                <ArrowUp size={13} />
              </IconButton>
              <IconButton
                title={t("quickCommands.moveDown")}
                disabled={i === commands.length - 1 || saving}
                onClick={() => onMove(cmd, 1)}
              >
                <ArrowDown size={13} />
              </IconButton>
              <IconButton title={t("quickCommands.edit")} onClick={() => onEdit(cmd)}>
                <Pencil size={13} />
              </IconButton>
              <IconButton title={t("quickCommands.delete")} danger disabled={saving} onClick={() => onDelete(cmd)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
