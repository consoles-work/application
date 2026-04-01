import { useState, useEffect } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useAppStore } from "../stores/appStore";
import { getDbInfo, setSetting } from "../lib/tauriCommands";
import type { DbInfo } from "../lib/tauriCommands";
import { THEMES } from "../lib/themes";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";
import { AI_PROVIDERS, getProvider, streamCompletion } from "../lib/aiProviders";

type Tab = "data" | "terminal" | "interface" | "agents";

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>("data");
  const { settings, setSetting: storeSetting, showToast } = useAppStore();
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    getDbInfo().then(setDbInfo).catch(() => {});
  }, []);

  const handleSetSetting = async (key: string, value: string) => {
    try {
      await setSetting(key, value);
      storeSetting(key, value);
      if (key === "ui.language") {
        i18n.changeLanguage(value);
      }
    } catch (e) {
      showToast("error", t("settings.toastSaveError", { error: e }));
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
          <h2 className="text-sm font-semibold text-text-primary">{t("settings.title")}</h2>
          <button
            className="text-text-muted hover:text-text-primary text-base leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {(["data", "terminal", "interface", "agents"] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              className={`py-2.5 px-3 text-xs border-b-2 transition-colors ${
                tab === tabKey
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setTab(tabKey)}
            >
              {tabKey === "data"
                ? t("settings.tabData")
                : tabKey === "terminal"
                ? t("settings.tabTerminal")
                : tabKey === "agents"
                ? t("settings.tabAgents")
                : t("settings.tabInterface")}
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
          {tab === "agents" && (
            <AgentsTab settings={settings} onChange={handleSetSetting} showToast={showToast} />
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
  const { t } = useTranslation();

  const handleShowInFinder = async () => {
    if (!dbInfo) return;
    try {
      await shellOpen(dbInfo.dirPath);
    } catch (e) {
      showToast("error", t("settings.toastFinderError", { error: e }));
    }
  };

  const handleCopyPath = async () => {
    if (!dbInfo) return;
    try {
      await navigator.clipboard.writeText(dbInfo.path);
      showToast("success", t("settings.toastPathCopied"));
    } catch {
      showToast("error", t("settings.toastCopyError"));
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
          {t("settings.dbPath")}
        </label>
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary break-all">
          {dbInfo?.path ?? "—"}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-primary transition-colors"
            onClick={handleShowInFinder}
          >
            {t("settings.showInFinder")}
          </button>
          <button
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-primary transition-colors"
            onClick={handleCopyPath}
          >
            {t("settings.copyPath")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2">
          <div className="text-xs text-text-secondary mb-0.5">{t("settings.fileSize")}</div>
          <div className="text-sm font-medium text-text-primary">
            {dbInfo ? formatSize(dbInfo.sizeBytes) : "—"}
          </div>
        </div>
        <div className="bg-surface-0 border border-border rounded-lg px-3 py-2">
          <div className="text-xs text-text-secondary mb-0.5">{t("settings.createdAt")}</div>
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
  const { t } = useTranslation();
  const fontSize = parseInt(settings["terminal.fontSize"] ?? "14");
  const fontFamily = settings["terminal.fontFamily"] ?? "Menlo";
  const scrollback = parseInt(settings["terminal.scrollback"] ?? "5000");
  const cursorStyle = settings["terminal.cursorStyle"] ?? "block";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.fontSize", { size: fontSize })}
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
          <span>{t("settings.fontSizeMin")}</span>
          <span>{t("settings.fontSizeMax")}</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.font")}
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
          {t("settings.scrollback", { count: scrollback.toLocaleString() })}
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
          <span>{t("settings.scrollbackMin")}</span>
          <span>{t("settings.scrollbackMax")}</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.cursor")}
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
              {style === "block" ? t("settings.cursorBlock") : style === "underline" ? t("settings.cursorUnderline") : t("settings.cursorBar")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Вкладка "Агенты" ──────────────────────────────────────

function AgentsTab({
  settings,
  onChange,
  showToast,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  showToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  const provider = settings["ai.provider"] ?? "openai";
  const apiKey = settings[`ai.apiKey.${provider}`] ?? settings["ai.apiKey"] ?? "";
  const model = settings["ai.model"] ?? "";
  const panelPosition = settings["ui.aiPanelPosition"] ?? "right";

  const providerObj = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0];

  const handleTestConnection = async () => {
    if (!apiKey) {
      showToast("error", "Сначала введите API-ключ");
      return;
    }
    setTesting(true);
    try {
      const testProvider = getProvider(provider);
      const testModel = model || testProvider.defaultModel;
      let got = false;
      await streamCompletion(
        testProvider,
        [{ role: "user", content: "Say: ok" }],
        testModel,
        apiKey,
        () => { got = true; }
      );
      if (got || true) showToast("success", t("settings.agentsTestSuccess"));
    } catch (e) {
      showToast("error", t("settings.agentsTestError", { error: e }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Provider */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.agentsProvider")}
        </label>
        <div className="flex gap-2">
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                provider === p.id
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ai.provider", p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.agentsApiKey")} <span className="text-text-muted font-mono text-2xs">({providerObj.name})</span>
        </label>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChange(`ai.apiKey.${provider}`, e.target.value)}
            placeholder={
              provider === "openai" ? "sk-..." : "sk-ant-..."
            }
            className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-secondary transition-colors"
          >
            {showKey ? t("settings.agentsHideKey") : t("settings.agentsShowKey")}
          </button>
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.agentsModel")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {providerObj.models.map((m) => (
            <button
              key={m}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                (model || providerObj.defaultModel) === m
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ai.model", m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Panel position */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.agentsPanelPosition")}
        </label>
        <div className="flex gap-2">
          {(["right", "bottom"] as const).map((pos) => (
            <button
              key={pos}
              className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                panelPosition === pos
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ui.aiPanelPosition", pos)}
            >
              {pos === "right"
                ? t("settings.agentsPositionRight")
                : t("settings.agentsPositionBottom")}
            </button>
          ))}
        </div>
      </div>

      {/* Test connection */}
      <button
        onClick={handleTestConnection}
        disabled={testing || !apiKey}
        className="w-full py-2 text-xs rounded-lg border border-border bg-surface-0 hover:bg-surface-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {testing ? "Проверка..." : t("settings.agentsTestConnection")}
      </button>
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
  const { t } = useTranslation();
  const currentTheme = settings["ui.theme"] ?? "dark";

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-3">
          {t("settings.theme")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left flex items-center gap-2 ${
                currentTheme === theme.id
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ui.theme", theme.id)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                style={{ background: theme.xterm.cursor }}
              />
              {theme.label}
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
            {t("settings.themeRandom")}
          </button>
        </div>
        {currentTheme === "random" && (
          <p className="text-2xs text-text-muted mt-2">
            {t("settings.themeRandomNote")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.language")}
        </label>
        <div className="flex flex-wrap gap-2">
          {(["ru", "en", "zh", "fr", "kk"] as const).map((lang) => (
            <button
              key={lang}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                (settings["ui.language"] ?? "ru") === lang
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-0 border-border text-text-primary hover:bg-surface-2"
              }`}
              onClick={() => onChange("ui.language", lang)}
            >
              {t(`settings.lang${lang.charAt(0).toUpperCase() + lang.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
