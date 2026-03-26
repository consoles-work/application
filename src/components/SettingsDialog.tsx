import { useState, useEffect } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useAppStore } from "../stores/appStore";
import { getDbInfo, setSetting } from "../lib/tauriCommands";
import type { DbInfo } from "../lib/tauriCommands";
import { THEMES } from "../lib/themes";

type Tab = "data" | "terminal" | "interface";

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>("data");
  const { settings, setSetting: storeSetting, showToast } = useAppStore();
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);

  useEffect(() => {
    getDbInfo().then(setDbInfo).catch(() => {});
  }, []);

  const handleSetSetting = async (key: string, value: string) => {
    try {
      await setSetting(key, value);
      storeSetting(key, value);
    } catch (e) {
      showToast("error", `Ошибка сохранения настроек: ${e}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Настройки</h2>
          <button
            className="text-text-muted hover:text-text-primary text-base leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {(["data", "terminal", "interface"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`py-2.5 px-3 text-xs border-b-2 transition-colors ${
                tab === t
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "data" ? "Данные" : t === "terminal" ? "Терминал" : "Интерфейс"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "data" && (
            <DataTab dbInfo={dbInfo} showToast={showToast} />
          )}
          {tab === "terminal" && (
            <TerminalTab settings={settings} onChange={handleSetSetting} />
          )}
          {tab === "interface" && (
            <InterfaceTab settings={settings} onChange={handleSetSetting} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Вкладка "Данные" ──────────────────────────────────────

function DataTab({
  dbInfo,
  showToast,
}: {
  dbInfo: DbInfo | null;
  showToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const handleShowInFinder = async () => {
    if (!dbInfo) return;
    try {
      await shellOpen(dbInfo.dirPath);
    } catch (e) {
      showToast("error", `Не удалось открыть Finder: ${e}`);
    }
  };

  const handleCopyPath = async () => {
    if (!dbInfo) return;
    try {
      await navigator.clipboard.writeText(dbInfo.path);
      showToast("success", "Путь скопирован");
    } catch {
      showToast("error", "Не удалось скопировать");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Путь к базе данных
        </label>
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary break-all">
          {dbInfo?.path ?? "—"}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-primary transition-colors"
            onClick={handleShowInFinder}
          >
            ⌂ Показать в Finder
          </button>
          <button
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-primary transition-colors"
            onClick={handleCopyPath}
          >
            ⎘ Скопировать путь
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2">
          <div className="text-xs text-text-secondary mb-0.5">Размер файла</div>
          <div className="text-sm font-medium text-text-primary">
            {dbInfo ? formatSize(dbInfo.sizeBytes) : "—"}
          </div>
        </div>
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2">
          <div className="text-xs text-text-secondary mb-0.5">Создана</div>
          <div className="text-sm font-medium text-text-primary">
            {dbInfo?.createdAt ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Вкладка "Терминал" ────────────────────────────────────

function TerminalTab({
  settings,
  onChange,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const fontSize = parseInt(settings["terminal.fontSize"] ?? "14");
  const fontFamily = settings["terminal.fontFamily"] ?? "Menlo";
  const scrollback = parseInt(settings["terminal.scrollback"] ?? "5000");
  const cursorStyle = settings["terminal.cursorStyle"] ?? "block";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Размер шрифта: {fontSize}px
        </label>
        <input
          type="range"
          min={12}
          max={20}
          value={fontSize}
          onChange={(e) => onChange("terminal.fontSize", e.target.value)}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-2xs text-text-muted mt-1">
          <span>12px</span>
          <span>20px</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Шрифт
        </label>
        <div className="grid grid-cols-2 gap-2">
          {["Menlo", "Monaco", "JetBrains Mono", "Fira Code"].map((font) => (
            <button
              key={font}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                fontFamily === font
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              style={{ fontFamily: font }}
              onClick={() => onChange("terminal.fontFamily", font)}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Scrollback: {scrollback.toLocaleString()} строк
        </label>
        <input
          type="range"
          min={1000}
          max={50000}
          step={1000}
          value={scrollback}
          onChange={(e) => onChange("terminal.scrollback", e.target.value)}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-2xs text-text-muted mt-1">
          <span>1 000</span>
          <span>50 000</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Курсор
        </label>
        <div className="flex gap-2">
          {(["block", "underline", "bar"] as const).map((style) => (
            <button
              key={style}
              className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                cursorStyle === style
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("terminal.cursorStyle", style)}
            >
              {style === "block" ? "Блок" : style === "underline" ? "Черта" : "Линия"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Вкладка "Интерфейс" ───────────────────────────────────

function InterfaceTab({
  settings,
  onChange,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const currentTheme = settings["ui.theme"] ?? "dark";

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-3">
          Тема
        </label>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left flex items-center gap-2 ${
                currentTheme === t.id
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ui.theme", t.id)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                style={{ background: t.xterm.cursor }}
              />
              {t.label}
            </button>
          ))}
          <button
            className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left flex items-center gap-2 ${
              currentTheme === "random"
                ? "bg-accent/15 border-accent text-accent"
                : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
            }`}
            onClick={() => onChange("ui.theme", "random")}
          >
            <span className="text-base leading-none">🎲</span>
            Случайная
          </button>
        </div>
        {currentTheme === "random" && (
          <p className="text-2xs text-text-muted mt-2">
            При каждом запуске выбирается случайная тема из 10
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Язык
        </label>
        <div className="flex gap-2">
          {(["ru", "en"] as const).map((lang) => (
            <button
              key={lang}
              className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                (settings["ui.language"] ?? "ru") === lang
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ui.language", lang)}
            >
              {lang === "ru" ? "🇷🇺 Русский" : "🇺🇸 English"}
            </button>
          ))}
        </div>
        <p className="text-2xs text-text-muted mt-2">
          Локализация — Этап 8
        </p>
      </div>
    </div>
  );
}
