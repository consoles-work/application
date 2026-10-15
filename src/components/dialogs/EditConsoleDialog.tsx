import { useAppStore } from "../../stores/appStore";
import { updateConsoleConfig, setNodeDanger } from "../../lib/tauriCommands";
import type { ConsoleConfig } from "../../types";
import { useTranslation } from "react-i18next";
import { ConsoleForm, consoleFormValues, type ConsoleFormValues } from "./ConsoleForm";

interface Props {
  console_: ConsoleConfig;
  onClose: () => void;
}

export function EditConsoleDialog({ console_, onClose }: Props) {
  const { updateConsole: storeUpdateConsole, showToast } = useAppStore();
  const { t } = useTranslation();

  const handleSubmit = async (v: ConsoleFormValues) => {
    const port = parseInt(v.sshPort) || 22;
    await updateConsoleConfig(
      console_.id,
      v.name.trim(),
      v.startupCmd.trim() || undefined,
      v.connectionType,
      v.sshHost.trim(),
      port,
      v.sshUser.trim(),
      v.sshKeyPath.trim(),
      v.sshExtraArgs.trim(),
      v.sshPassphrase,
      v.sshPassword,
      v.note,
      v.hosting.trim(),
      v.icon,
      v.color
    );
    const finalLabel = v.isDanger ? (v.dangerLabel.trim() || "PRODUCTION") : (console_.dangerLabel || "PRODUCTION");
    await setNodeDanger(console_.id, "console", v.isDanger, finalLabel);
    storeUpdateConsole(console_.id, {
      name: v.name.trim(),
      startupCmd: v.startupCmd.trim() || undefined,
      connectionType: v.connectionType,
      sshHost: v.sshHost.trim(),
      sshPort: port,
      sshUser: v.sshUser.trim(),
      sshKeyPath: v.sshKeyPath.trim(),
      sshExtraArgs: v.sshExtraArgs.trim(),
      sshPassphrase: v.sshPassphrase,
      sshPassword: v.sshPassword,
      note: v.note,
      hosting: v.hosting.trim(),
      icon: v.icon,
      color: v.color,
      isDanger: v.isDanger,
      dangerLabel: finalLabel,
    } as any);
    showToast("success", t("dialogs.toastConsoleUpdated", { name: v.name.trim() }));
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
