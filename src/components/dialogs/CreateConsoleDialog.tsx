import { useAppStore } from "../../stores/appStore";
import { createConsole, setNodeDanger } from "../../lib/tauriCommands";
import { useTranslation } from "react-i18next";
import { ConsoleForm, consoleFormValues, type ConsoleFormValues } from "./ConsoleForm";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function CreateConsoleDialog({ projectId, onClose }: Props) {
  const { addConsole, showToast } = useAppStore();
  const { t } = useTranslation();

  const handleSubmit = async (v: ConsoleFormValues) => {
    const con = await createConsole(
      projectId,
      v.name.trim(),
      v.startupCmd.trim() || undefined,
      v.connectionType,
      v.sshHost.trim(),
      parseInt(v.sshPort) || 22,
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
    const finalLabel = v.dangerLabel.trim() || "PRODUCTION";
    if (v.isDanger) {
      await setNodeDanger(con.id, "console", true, finalLabel);
    }
    addConsole(projectId, { ...con, isDanger: v.isDanger, dangerLabel: finalLabel });
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
