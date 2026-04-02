import { useState } from "react";
import { createPortal } from "react-dom";
import { save } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { exportData } from "../../lib/tauriCommands";
import { useTranslation } from "react-i18next";

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const [includeWiki, setIncludeWiki] = useState(true);
  const [includeAi, setIncludeAi] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useAppStore();
  const { t } = useTranslation();

  const handleExport = async () => {
    setLoading(true);
    try {
      const filePath = await save({
        defaultPath: `consoles-work-export-${new Date().toISOString().slice(0, 10)}.dchub`,
        filters: [{ name: "consoles.work", extensions: ["dchub"] }],
      });

      if (!filePath) {
        setLoading(false);
        return;
      }

      await exportData(filePath, true, includeWiki, includeAi, password || undefined);
      showToast("success", t("export.toastSuccess"));
      onClose();
    } catch (err) {
      showToast("error", t("export.toastError", { error: err }));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={onClose}
    >
      <div
        className="bg-surface-2 border border-border rounded-xl shadow-2xl w-96 p-5 flex flex-col gap-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">{t("export.title")}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-secondary font-medium">{t("export.includeLabel")}</p>

          <label className="flex items-center gap-2 cursor-not-allowed opacity-70">
            <input type="checkbox" checked disabled className="accent-accent" />
            <span className="text-xs text-text-primary">{t("export.includeTree")}</span>
            <span className="text-2xs text-text-muted ml-auto">{t("export.required")}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWiki}
              onChange={(e) => setIncludeWiki(e.target.checked)}
              className="accent-accent cursor-pointer"
            />
            <span className="text-xs text-text-primary">{t("export.includeWiki")}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAi}
              onChange={(e) => setIncludeAi(e.target.checked)}
              className="accent-accent cursor-pointer"
            />
            <span className="text-xs text-text-primary">{t("export.includeAi")}</span>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-secondary font-medium">
            {t("export.password")}{" "}
            <span className="text-text-muted font-normal">{t("export.optional")}</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("export.passwordPlaceholder")}
              className="w-full bg-surface-0 border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
            >
              {showPassword ? t("settings.agentsHideKey") : t("settings.agentsShowKey")}
            </button>
          </div>
          <p className="text-2xs text-text-muted">
            {t("export.passwordNote")}
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-1.5 text-xs bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <><span className="animate-spin text-sm">↻</span> {t("export.exporting")}</>
            ) : (
              <>↑ {t("export.exportButton")}</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}