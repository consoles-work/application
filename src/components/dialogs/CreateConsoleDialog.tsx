import { useAppStore } from "../../stores/appStore";
import { createConsole, setNodeDanger } from "../../lib/tauriCommands";
import { useTranslation } from "react-i18next";
import { ConsoleForm, consoleFields, consoleFormValues, type ConsoleFormValues } from "./ConsoleForm";

// ══════════════════════════════════════
// CreateConsoleDialog — новая консоль в проекте
// ══════════════════════════════════════
// 1. Консоль создаётся в БД с полями из формы.
// 2. Отмечена «опасной» — пометка сохраняется отдельно (своя команда).
// 3. Консоль появляется в дереве, тост об успехе. Ошибку показывает форма.

interface Props {
  projectId: string;
  onClose: () => void;
}

export function CreateConsoleDialog({ projectId, onClose }: Props) {
  const { addConsole, showToast } = useAppStore();
  const { t } = useTranslation();

  const handleSubmit = async (v: ConsoleFormValues) => {
    // 1. Консоль.
    const con = await createConsole(projectId, consoleFields(v));

    // 2. Пометка «опасно».
    const dangerLabel = v.dangerLabel.trim() || "PRODUCTION";

    if (v.isDanger) await setNodeDanger(con.id, "console", true, dangerLabel);

    // 3. Дерево.
    addConsole(projectId, { ...con, isDanger: v.isDanger, dangerLabel });

    showToast("success", t("dialogs.toastConsoleCreated", { name: con.name }));
  };

  return (
    <ConsoleForm
      title={t("dialogs.newConsole")}
      initial={consoleFormValues()}
      submitLabel={t("common.create")}
      submittingLabel={t("common.creating")}
      autoFocusName
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
