import { useAppStore } from "../../stores/appStore";
import { updateConsoleConfig, setNodeDanger } from "../../lib/tauriCommands";
import type { ConsoleConfig } from "../../types";
import { useTranslation } from "react-i18next";
import { ConsoleForm, consoleFields, consoleFormValues, type ConsoleFormValues } from "./ConsoleForm";

// ══════════════════════════════════════
// EditConsoleDialog — настройки существующей консоли
// ══════════════════════════════════════
// 1. Поля из формы сохраняются в БД.
// 2. Пометка «опасно» сохраняется всегда; снятая пометка оставляет прежнюю
//    подпись — вернётся, если пометку включат снова.
// 3. Консоль в дереве обновляется, тост об успехе. Ошибку показывает форма.

interface Props {
  console_: ConsoleConfig;
  onClose: () => void;
}

export function EditConsoleDialog({ console_, onClose }: Props) {
  const { updateConsole: storeUpdateConsole, showToast } = useAppStore();
  const { t } = useTranslation();

  const handleSubmit = async (v: ConsoleFormValues) => {
    // 1. Поля.
    const fields = consoleFields(v);

    await updateConsoleConfig(console_.id, fields);

    // 2. Пометка «опасно».
    const dangerLabel = v.isDanger ? v.dangerLabel.trim() || "PRODUCTION" : console_.dangerLabel || "PRODUCTION";

    await setNodeDanger(console_.id, "console", v.isDanger, dangerLabel);

    // 3. Дерево.
    storeUpdateConsole(console_.id, { ...fields, isDanger: v.isDanger, dangerLabel });

    showToast("success", t("dialogs.toastConsoleUpdated", { name: fields.name }));
  };

  return (
    <ConsoleForm
      title={t("dialogs.consoleSettings")}
      initial={consoleFormValues(console_)}
      submitLabel={t("common.save")}
      submittingLabel={t("common.saving")}
      existing={console_}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
