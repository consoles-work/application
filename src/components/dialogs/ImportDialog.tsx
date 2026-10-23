import { useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { previewImport, applyImport, loadAllWorkspaces, loadAiSessions, type ImportPreview } from "../../lib/tauriCommands";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════
// ImportDialog — импорт из файла .dchub
// ══════════════════════════════════════
// 1. Выбор файла; отменили — ничего.
// 2. Превью без пароля. Исходы: а) файл под паролем — шаг ввода пароля;
//    б) другая ошибка (не .dchub, повреждён) — текст ошибки в диалоге;
//    в) превью — что и сколько в файле.
// 3. Пароль: неверный — сообщение, можно ввести снова.
// 4. Применение выбранных разделов («добавить» или «заменить»), затем дерево и
//    AI-чаты перечитываются из БД. Ошибка — текст в диалоге.

interface Props {
  onClose: () => void;
}

type Step = "select" | "password" | "preview";

export function ImportDialog({ onClose }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [includeWiki, setIncludeWiki] = useState(true);
  const [includeAi, setIncludeAi] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { showToast, setWorkspaces, setAiSessions, setActiveAiSessionId } = useAppStore();
  const { t } = useTranslation();

  // Общее для всех шагов: индикатор, сброс прошлой ошибки; onError — что показать вместо текста ошибки
  const run = async (action: () => Promise<void>, onError: (e: unknown) => void = (e) => setError(String(e))) => {
    setLoading(true);
    setError("");

    try {
      await action();
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  };

  // 1–2. Файл и превью без пароля.
  const handleSelectFile = () =>
    run(async () => {
      const selected = await open({ filters: [{ name: "consoles.work", extensions: ["dchub"] }], multiple: false });

      if (!selected || typeof selected !== "string") return;

      setFilePath(selected);
      setFileName(selected.split("/").pop() ?? selected);

      try {
        setPreview(await previewImport(selected, undefined));

        setNeedsPassword(false);
        setStep("preview");
      } catch (e) {
        if (!isPasswordRequired(e)) throw e;

        setNeedsPassword(true);
        setStep("password");
      }
    });

  // 3. Пароль.
  const handleCheckPassword = () =>
    run(
      async () => {
        setPreview(await previewImport(filePath, password));

        setStep("preview");
      },
      () => setError(t("import.wrongPassword"))
    );

  // 4. Применение и перечитывание.
  const handleApply = () =>
    run(async () => {
      await applyImport(
        filePath,
        needsPassword ? password : undefined,
        { tree: true, wiki: includeWiki, ai: includeAi, settings: includeSettings },
        mode
      );

      setWorkspaces(await loadAllWorkspaces());

      const sessions = await loadAiSessions();

      setAiSessions(sessions);

      if (sessions.length > 0) setActiveAiSessionId(sessions[0].id);

      showToast("success", t("import.toastSuccess"));

      onClose();
    });

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
          <h2 className="text-sm font-semibold text-text-primary">{t("import.title")}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Шаг: выбор файла */}
        {step === "select" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              {t("import.selectDesc")}
            </p>
            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">{error}</p>
            )}
            <button
              onClick={handleSelectFile}
              disabled={loading}
              className="w-full px-4 py-2 text-xs bg-surface-3 hover:bg-accent/20 border border-border rounded-md text-text-primary disabled:opacity-50"
            >
              {loading ? t("import.opening") : t("import.selectButton")}
            </button>
          </div>
        )}

        {/* Шаг: пароль */}
        {step === "password" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              {t("import.passwordProtectedFile", { name: fileName })}
            </p>
            <div className="relative">
              <input
                autoFocus
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckPassword()}
                placeholder={t("import.passwordPlaceholder")}
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
            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">{error}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setStep("select"); setError(""); }}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3"
              >
                {t("import.back")}
              </button>
              <button
                onClick={handleCheckPassword}
                disabled={!password || loading}
                className="px-4 py-1.5 text-xs bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50"
              >
                {loading ? t("import.checking") : t("import.check")}
              </button>
            </div>
          </div>
        )}

        {/* Шаг: превью + опции */}
        {step === "preview" && preview && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              {t("import.file")} <span className="text-text-primary font-medium">{fileName}</span>
              <br />
              {t("import.exportedAt")}{" "}
              <span className="text-text-primary">{preview.exportedAt.slice(0, 10)}</span>
            </p>

            <div className="bg-surface-0 rounded-lg p-3 flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>{t("import.statsTree")}</span>
                <span className="text-text-primary font-mono">
                  {preview.workspaceCount} / {preview.projectCount} / {preview.consoleCount}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>{t("import.statsWiki")}</span>
                <span className="text-text-primary font-mono">{preview.wikiCount}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>{t("import.statsAi")}</span>
                <span className="text-text-primary font-mono">
                  {preview.aiSessionCount} / {preview.aiMessageCount}
                </span>
              </div>
              {preview.settingsCount > 0 && (
                <div className="flex justify-between text-text-secondary">
                  <span>{t("import.statsSettings")}</span>
                  <span className="text-text-primary font-mono">{preview.settingsCount}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-text-secondary font-medium">{t("import.importLabel")}</p>
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
              {preview.settingsCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-primary">{t("import.includeSettings")}</span>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-text-secondary font-medium">{t("import.modeLabel")}</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="merge"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                    className="accent-accent"
                  />
                  <span className="text-xs text-text-primary">{t("import.modeMerge")}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="replace"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                    className="accent-accent"
                  />
                  <span className="text-xs text-text-primary">{t("import.modeReplace")}</span>
                </label>
              </div>
              <p className="text-2xs text-text-muted">
                {mode === "merge" ? t("import.mergeDesc") : t("import.replaceDesc")}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">{error}</p>
            )}

            {mode === "replace" && (
              <p className="text-2xs text-yellow-400 bg-yellow-400/10 rounded px-2 py-1.5">
                {t("import.replaceWarning")}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => {
                  setStep(needsPassword ? "password" : "select");
                  setError("");
                }}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3"
              >
                {t("import.back")}
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin">↻</span> {t("import.importing")}
                  </span>
                ) : (
                  <>↓ {t("import.importButton")}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Шаг 2а: текст ошибки задаёт export.rs (ERR_PASSWORD_REQUIRED); «Password required» — старые сборки */
function isPasswordRequired(e: unknown): boolean {
  const msg = String(e);

  return msg.includes("защищён паролем") || msg.includes("Password required");
}
