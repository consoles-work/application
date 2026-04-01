import { useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { previewImport, applyImport, ImportPreview } from "../../lib/tauriCommands";
import { loadAllWorkspaces, loadAiSessions } from "../../lib/tauriCommands";

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
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { showToast, setWorkspaces, setAiSessions, setActiveAiSessionId } = useAppStore();

  // ── Шаг 1: выбор файла ────────────────────────────────────────

  const handleSelectFile = async () => {
    setLoading(true);
    setError("");
    try {
      const selected = await open({
        filters: [{ name: "DevConsole Hub", extensions: ["dchub"] }],
        multiple: false,
      });
      if (!selected || typeof selected !== "string") {
        setLoading(false);
        return;
      }

      const path = selected;
      const name = path.split("/").pop() ?? path;
      setFilePath(path);
      setFileName(name);

      // Попробуем без пароля
      try {
        const prev = await previewImport(path, undefined);
        setPreview(prev);
        setNeedsPassword(false);
        setStep("preview");
      } catch (e) {
        const msg = String(e);
        if (msg.includes("защищён паролем") || msg.includes("Password required")) {
          setNeedsPassword(true);
          setStep("password");
        } else {
          setError(msg);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Шаг 2: ввод пароля ───────────────────────────────────────

  const handleCheckPassword = async () => {
    setLoading(true);
    setError("");
    try {
      const prev = await previewImport(filePath, password);
      setPreview(prev);
      setStep("preview");
    } catch {
      setError("Неверный пароль или файл повреждён");
    } finally {
      setLoading(false);
    }
  };

  // ── Шаг 3: применение импорта ────────────────────────────────

  const handleApply = async () => {
    setLoading(true);
    setError("");
    try {
      await applyImport(
        filePath,
        needsPassword ? password : undefined,
        true,
        includeWiki,
        includeAi,
        mode
      );

      // Перезагружаем дерево и сессии после импорта
      const workspaces = await loadAllWorkspaces();
      setWorkspaces(workspaces);

      const sessions = await loadAiSessions();
      setAiSessions(sessions);
      if (sessions.length > 0) setActiveAiSessionId(sessions[0].id);

      showToast("success", "Импорт успешно завершён");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Рендер ───────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={onClose}
    >
      <div
        className="bg-surface-2 border border-border rounded-xl shadow-2xl w-96 p-5 flex flex-col gap-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Импорт данных</h2>
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
              Выберите файл экспорта (.dchub) для импорта данных.
            </p>
            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">{error}</p>
            )}
            <button
              onClick={handleSelectFile}
              disabled={loading}
              className="w-full px-4 py-2 text-xs bg-surface-3 hover:bg-accent/20 border border-border rounded-md text-text-primary disabled:opacity-50"
            >
              {loading ? "Открываем..." : "↓ Выбрать файл .dchub"}
            </button>
          </div>
        )}

        {/* Шаг: пароль */}
        {step === "password" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              Файл <span className="text-text-primary font-medium">{fileName}</span> защищён паролем.
            </p>
            <div className="relative">
              <input
                autoFocus
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckPassword()}
                placeholder="Введите пароль"
                className="w-full bg-surface-0 border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
              >
                {showPassword ? "скрыть" : "показ."}
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
                Назад
              </button>
              <button
                onClick={handleCheckPassword}
                disabled={!password || loading}
                className="px-4 py-1.5 text-xs bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50"
              >
                {loading ? "Проверяем..." : "Проверить"}
              </button>
            </div>
          </div>
        )}

        {/* Шаг: превью + опции */}
        {step === "preview" && preview && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              Файл: <span className="text-text-primary font-medium">{fileName}</span>
              <br />
              Экспортирован:{" "}
              <span className="text-text-primary">{preview.exportedAt.slice(0, 10)}</span>
            </p>

            {/* Статистика */}
            <div className="bg-surface-0 rounded-lg p-3 flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Workspaces / Проекты / Консоли</span>
                <span className="text-text-primary font-mono">
                  {preview.workspaceCount} / {preview.projectCount} / {preview.consoleCount}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Wiki-страниц</span>
                <span className="text-text-primary font-mono">{preview.wikiCount}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>AI-чатов / Сообщений</span>
                <span className="text-text-primary font-mono">
                  {preview.aiSessionCount} / {preview.aiMessageCount}
                </span>
              </div>
            </div>

            {/* Что импортировать */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-text-secondary font-medium">Импортировать:</p>
              <label className="flex items-center gap-2 cursor-not-allowed opacity-70">
                <input type="checkbox" checked disabled className="accent-accent" />
                <span className="text-xs text-text-primary">Дерево проектов</span>
                <span className="text-2xs text-text-muted ml-auto">(обязательно)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWiki}
                  onChange={(e) => setIncludeWiki(e.target.checked)}
                  className="accent-accent cursor-pointer"
                />
                <span className="text-xs text-text-primary">Wiki-страницы</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAi}
                  onChange={(e) => setIncludeAi(e.target.checked)}
                  className="accent-accent cursor-pointer"
                />
                <span className="text-xs text-text-primary">История AI-чатов</span>
              </label>
            </div>

            {/* Режим */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-text-secondary font-medium">Режим импорта:</p>
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
                  <span className="text-xs text-text-primary">Объединить</span>
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
                  <span className="text-xs text-text-primary">Заменить</span>
                </label>
              </div>
              <p className="text-2xs text-text-muted">
                {mode === "merge"
                  ? "Добавить данные. При конфликте имён добавит суффикс «(import)»."
                  : "Удалить текущие данные и заменить импортируемыми."}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">{error}</p>
            )}

            {mode === "replace" && (
              <p className="text-2xs text-yellow-400 bg-yellow-400/10 rounded px-2 py-1.5">
                ⚠ Режим «Заменить» удалит выбранные данные безвозвратно.
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
                Назад
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-accent/90 hover:bg-accent text-white rounded-md disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin">↻</span> Импорт...
                  </span>
                ) : (
                  "↓ Импортировать"
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
