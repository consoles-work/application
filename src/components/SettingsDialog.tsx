import { useState, useEffect } from "react";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../stores/appStore";
import { clearUsageStats, getDbInfo, setSetting, isPasswordSet, setPassword, enableAutostart, disableAutostart, getAutostartStatus, updateTrayLanguage, aiDetectBin, aiCheck } from "../lib/tauriCommands";
import type { DbInfo } from "../lib/tauriCommands";
import { THEMES, type AppTheme } from "../lib/themes";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";
import { AI_PROVIDERS, getProvider, streamCompletion } from "../lib/aiProviders";
import { APP_NAME, APP_VERSION } from "../lib/appInfo";

// ══════════════════════════════════════
// SettingsDialog — настройки приложения (Cmd+,)
// ══════════════════════════════════════
// Вкладки: данные (файл БД), терминал, интерфейс, агенты (AI), безопасность.
// Любая настройка сохраняется сразу при изменении: сначала в БД, затем в стор
// (компоненты подхватывают её без перезапуска). Не сохранилась — тост, в
// интерфейсе остаётся прежнее значение. Смена языка переводит и меню трея.

type Tab = "data" | "terminal" | "interface" | "agents" | "security";

const TABS: Tab[] = ["data", "terminal", "interface", "agents", "security"];

const TAB_LABEL: Record<Tab, string> = {
  data: "settings.tabData",
  terminal: "settings.tabTerminal",
  interface: "settings.tabInterface",
  agents: "settings.tabAgents",
  security: "settings.tabSecurity",
};

const CURSOR_LABEL = {
  block: "settings.cursorBlock",
  underline: "settings.cursorUnderline",
  bar: "settings.cursorBar",
} as const;

const OLLAMA_URL = "http://localhost:11434";

/** Кнопка выбора: выбрана / нет */
const CHOICE_ON = "bg-accent/15 border-accent text-accent";
const CHOICE_OFF = "bg-surface-0 border-border text-text-primary hover:bg-surface-2";

type ShowToast = (type: "success" | "error" | "info", msg: string) => void;

interface SettingsDialogProps {
  onClose: () => void;
  onOpenAbout: () => void;
}

export function SettingsDialog({ onClose, onOpenAbout }: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>("data");
  const { settings, setSetting: storeSetting, showToast } = useAppStore();
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const { t } = useTranslation();

  // Не прочиталось — вместо сведений о файле прочерки
  useEffect(() => {
    getDbInfo()
      .then(setDbInfo)
      .catch((e) => console.warn("db info", e));
  }, []);

  const handleSetSetting = async (key: string, value: string) => {
    try {
      await setSetting(key, value);
    } catch (e) {
      showToast("error", t("settings.toastSaveError", { error: e }));

      return;
    }

    storeSetting(key, value);

    if (key !== "ui.language") return;

    i18n.changeLanguage(value);

    // Не вышло — меню трея останется на прежнем языке до перезапуска
    updateTrayLanguage(value).catch((e) => console.warn("tray language", e));
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
          {TABS.map((tabKey) => (
            <button
              key={tabKey}
              className={`py-2.5 px-3 text-xs border-b-2 transition-colors ${
                tab === tabKey
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setTab(tabKey)}
            >
              {t(TAB_LABEL[tabKey])}
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
            <InterfaceTab settings={settings} onChange={handleSetSetting} onOpenAbout={onOpenAbout} />
          )}
          {tab === "agents" && (
            <AgentsTab settings={settings} onChange={handleSetSetting} showToast={showToast} />
          )}
          {tab === "security" && <SecurityTab settings={settings} onChange={handleSetSetting} showToast={showToast} />}
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
  showToast: ShowToast;
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
                  ? CHOICE_ON
                  : CHOICE_OFF
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
                  ? CHOICE_ON
                  : CHOICE_OFF
              }`}
              onClick={() => onChange("terminal.cursorStyle", style)}
            >
              {t(CURSOR_LABEL[style])}
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
  showToast: ShowToast;
}) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const provider = settings["ai.provider"] ?? "openai";
  const apiKey = settings[`ai.apiKey.${provider}`] ?? settings["ai.apiKey"] ?? "";
  const model = settings["ai.model"] ?? "";
  const panelPosition = settings["ui.aiPanelPosition"] ?? "right";

  const providerObj = getProvider(provider);
  const isOllama = provider === "ollama";
  // Локальный движок: бинарь claude подпроцессом, API-ключ не нужен
  const isLocalCli = providerObj.isLocalCli === true;
  const claudeBin = settings["ai.claudeBin"] ?? "";
  const [binStatus, setBinStatus] = useState<string | null>(null);
  const [binBusy, setBinBusy] = useState(false);

  const handleDetectBin = async () => {
    setBinBusy(true);
    setBinStatus(null);
    try {
      const found = await aiDetectBin();
      if (found) {
        onChange("ai.claudeBin", found);
        setBinStatus(found);
      } else {
        showToast("error", t("settings.agentsBinNotFound"));
      }
    } catch (e) {
      showToast("error", t("settings.agentsTestError", { error: e }));
    } finally {
      setBinBusy(false);
    }
  };

  const handleCheckBin = async () => {
    setBinBusy(true);
    setBinStatus(null);
    try {
      const info = await aiCheck(claudeBin || undefined);
      setBinStatus(info);
      showToast("success", t("settings.agentsTestSuccess"));
    } catch (e) {
      showToast("error", t("settings.agentsTestError", { error: e }));
    } finally {
      setBinBusy(false);
    }
  };

  // Модели Ollama — с локального сервера, при выборе провайдера
  useEffect(() => {
    if (!isOllama) return;

    setOllamaLoading(true);
    setOllamaError(null);

    fetch(`${OLLAMA_URL}/api/tags`)
      .then((r) => r.json())
      .then((data) => setOllamaModels((data.models ?? []).map((m: { name: string }) => m.name)))
      .catch(() => setOllamaError(t("settings.agentsOllamaFetchError")))
      .finally(() => setOllamaLoading(false));
  }, [isOllama]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeModels = isOllama ? ollamaModels : providerObj.models;
  const activeDefault = isOllama ? ollamaModels[0] ?? "" : providerObj.defaultModel;
  const selectedModel = highlightedModel(activeModels, model, activeDefault);

  // Ключ нужен только HTTP-провайдерам в интернете: Ollama локальная, CLI — по подписке
  const needsKey = !isOllama && !isLocalCli;

  // Проверка своя у каждого провайдера; любая ошибка — исключением
  const runConnectionTest = async () => {
    if (isLocalCli) return setBinStatus(await aiCheck(claudeBin || undefined));

    if (isOllama) {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);

      if (!r.ok) throw r.status;

      return;
    }

    await streamCompletion({
      provider: providerObj,
      messages: [{ role: "user", content: "Say: ok" }],
      model: model || providerObj.defaultModel,
      apiKey,
      onChunk: () => undefined,
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);

    try {
      await runConnectionTest();

      showToast("success", t("settings.agentsTestSuccess"));
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
                  ? CHOICE_ON
                  : CHOICE_OFF
              }`}
              onClick={() => onChange("ai.provider", p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key — скрыт для Ollama и локального CLI (ключ им не нужен) */}
      {needsKey && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            {t("settings.agentsApiKey")} <span className="text-text-muted font-mono text-2xs">({providerObj.name})</span>
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => onChange(`ai.apiKey.${provider}`, e.target.value)}
              placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
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
      )}

      {/* Ollama note */}
      {isOllama && (
        <p className="text-2xs text-text-muted">{t("settings.agentsOllamaNote")}</p>
      )}

      {/* Локальный движок: путь к бинарю claude */}
      {isLocalCli && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            {t("settings.agentsClaudeBin")}
          </label>
          <div className="flex gap-2">
            <input
              value={claudeBin}
              onChange={(e) => onChange("ai.claudeBin", e.target.value)}
              placeholder={t("settings.agentsClaudeBinPlaceholder")}
              className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono"
            />
            <button
              onClick={handleDetectBin}
              disabled={binBusy}
              className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-secondary transition-colors disabled:opacity-50"
            >
              {t("settings.agentsBinDetect")}
            </button>
            <button
              onClick={handleCheckBin}
              disabled={binBusy}
              className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-text-secondary transition-colors disabled:opacity-50"
            >
              {t("settings.agentsBinCheck")}
            </button>
          </div>
          {binStatus && (
            <p className="mt-2 text-2xs text-text-muted font-mono break-all">{binStatus}</p>
          )}
          <p className="mt-2 text-2xs text-text-muted">{t("settings.agentsClaudeCliNote")}</p>
        </div>
      )}

      {/* Model */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.agentsModel")}
        </label>
        {isOllama && ollamaLoading && (
          <p className="text-xs text-text-muted">{t("settings.agentsOllamaLoading")}</p>
        )}
        {isOllama && ollamaError && (
          <p className="text-xs text-red-400">{ollamaError}</p>
        )}
        {isOllama && !ollamaLoading && !ollamaError && ollamaModels.length === 0 && (
          <p className="text-xs text-text-muted">{t("settings.agentsOllamaNoModels")}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {activeModels.map((m) => (
            <button
              key={m}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                selectedModel === m
                  ? CHOICE_ON
                  : CHOICE_OFF
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
                  ? CHOICE_ON
                  : CHOICE_OFF
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
        disabled={testing || (needsKey && !apiKey)}
        className="w-full py-2 text-xs rounded-lg border border-border bg-surface-0 hover:bg-surface-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {testing ? t("settings.agentsTestTesting") : t("settings.agentsTestConnection")}
      </button>
    </div>
  );
}

// ── Вкладка "Интерфейс" ───────────────────────────────────

function InterfaceTab({
  settings,
  onChange,
  onOpenAbout,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onOpenAbout: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useAppStore();
  const currentTheme = settings["ui.theme"] ?? "dark";
  const closeToTray = (settings["ui.closeToTray"] ?? "true") === "true";
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const statsEnabled = settings["stats.enabled"] !== "false";

  const handleClearStats = async () => {
    const ok = await ask(t("stats.clearConfirm"), { title: t("stats.clear"), kind: "warning" });

    if (!ok) return;

    try {
      await clearUsageStats();

      showToast("success", t("stats.cleared"));
    } catch (e) {
      showToast("error", String(e));
    }
  };

  // Не прочиталось — переключатель покажет «выключено»
  useEffect(() => {
    getAutostartStatus()
      .then(setAutostartEnabled)
      .catch((e) => console.warn("autostart status", e));
  }, []);

  const handleAutostart = async (enabled: boolean) => {
    try {
      await (enabled ? enableAutostart() : disableAutostart());

      setAutostartEnabled(enabled);
    } catch (e) {
      showToast("error", t("settings.autostartError", { error: e }));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-3">
          {t("settings.theme")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ThemeGroup
            label={t("settings.themesDark")}
            themes={THEMES.filter((th) => th.dark)}
            current={currentTheme}
            onPick={(id) => onChange("ui.theme", id)}
          />
          <ThemeGroup
            label={t("settings.themesLight")}
            themes={THEMES.filter((th) => !th.dark)}
            current={currentTheme}
            onPick={(id) => onChange("ui.theme", id)}
          />
        </div>
        <button
          className={`mt-2 w-full px-3 py-2 text-xs rounded-lg border transition-colors text-left flex items-center gap-2 ${
            currentTheme === "random"
              ? CHOICE_ON
              : CHOICE_OFF
          }`}
          onClick={() => onChange("ui.theme", "random")}
        >
          <span className="text-base leading-none">🎲</span>
          {t("settings.themeRandom")}
        </button>
        {currentTheme === "random" && (
          <p className="text-2xs text-text-muted mt-2">
            {t("settings.themeRandomNote")}
          </p>
        )}
      </div>

      {/* Поведение при закрытии */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          {t("settings.closeBehavior")}
        </label>
        <div className="flex gap-2">
          {([true, false] as const).map((toTray) => (
            <button
              key={String(toTray)}
              className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                closeToTray === toTray
                  ? CHOICE_ON
                  : CHOICE_OFF
              }`}
              onClick={() => onChange("ui.closeToTray", String(toTray))}
            >
              {toTray ? t("settings.closeToTray") : t("settings.closeAndQuit")}
            </button>
          ))}
        </div>
      </div>

      {/* Автозапуск */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-text-secondary">{t("settings.autostart")}</span>
          <Toggle on={autostartEnabled} onClick={() => handleAutostart(!autostartEnabled)} />
        </label>
        <p className="text-2xs text-text-muted mt-1">{t("settings.autostartNote")}</p>
      </div>

      {/* Статистика использования */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-text-secondary">{t("settings.statsEnabled")}</span>
          <Toggle on={statsEnabled} onClick={() => onChange("stats.enabled", String(!statsEnabled))} />
        </label>
        <p className="text-2xs text-text-muted mt-1">{t("settings.statsNote")}</p>
        <button
          className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-0 text-red-400 hover:bg-surface-2"
          onClick={handleClearStats}
        >
          {t("stats.clear")}
        </button>
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
                  ? CHOICE_ON
                  : CHOICE_OFF
              }`}
              onClick={() => onChange("ui.language", lang)}
            >
              {t(`settings.lang${lang.charAt(0).toUpperCase() + lang.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-text-muted">
          {APP_NAME} {t("about.version", { version: APP_VERSION })}
        </span>
        <button
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-0 text-text-primary hover:bg-surface-2 transition-colors"
          onClick={onOpenAbout}
        >
          {t("about.title")}
        </button>
      </div>
    </div>
  );
}

// ── Вкладка "Безопасность" (пароль на вход) ─────────────────

function SecurityTab({
  settings,
  onChange,
  showToast,
}: {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  showToast: ShowToast;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null); // null — грузим
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Не смогли проверить — показываем «пароль не задан»: так видно, что включить можно
  const reload = () => isPasswordSet().then(setEnabled).catch(() => setEnabled(false));

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- проверка один раз при открытии вкладки

  const clearFields = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  // Установка, смена или снятие (пустой новый пароль); неверный текущий отклонит бэкенд
  const save = async (currentPassword: string | null, newPassword: string, done: string) => {
    setBusy(true);

    try {
      await setPassword(currentPassword, newPassword);

      clearFields();

      showToast("success", t(done));

      await reload();
    } catch (e) {
      showToast("error", `${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Включение / смена пароля
  const apply = () => {
    if (enabled && !current) return showToast("error", t("security.errCurrent"));

    if (!next) return showToast("error", t("security.errEmpty"));

    if (next !== confirm) return showToast("error", t("security.errMismatch"));

    save(enabled ? current : null, next, enabled ? "security.toastChanged" : "security.toastEnabled");
  };

  // Снятие пароля
  const disable = () => {
    if (!current) return showToast("error", t("security.errCurrent"));

    save(current, "", "security.toastDisabled");
  };

  if (enabled === null) {
    return <Loader2 size={16} className="animate-spin text-text-muted" />;
  }

  const inputCls =
    "w-full bg-surface-0 border border-border rounded px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent";

  return (
    <div className="space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${enabled ? "bg-success" : "bg-text-muted"}`} />
        <div className="text-sm text-text-primary">
          {enabled ? t("security.statusOn") : t("security.statusOff")}
        </div>
      </div>
      <p className="text-2xs text-text-muted leading-relaxed">
        {enabled ? t("security.descOn") : t("security.descOff")} {t("security.storage")}
      </p>
      <div className="flex items-center gap-1.5 text-2xs text-success">
        <ShieldCheck size={12} />
        {t("security.dbEncrypted")}
      </div>

      {enabled && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t("security.current")}</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputCls} />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          {enabled ? t("security.new") : t("security.password")}
        </label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">{t("security.confirm")}</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          autoComplete="new-password"
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={apply}
          disabled={busy}
          className="flex-1 h-8 rounded bg-accent text-white text-xs flex items-center justify-center gap-1.5 hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          {enabled ? t("security.change") : t("security.enable")}
        </button>
        {enabled && (
          <button
            onClick={disable}
            disabled={busy}
            className="h-8 px-3 rounded border border-border text-xs text-text-secondary hover:text-danger hover:border-danger disabled:opacity-60"
          >
            {t("security.disable")}
          </button>
        )}
      </div>

      <AutoLockSetting
        enabled={enabled}
        value={settings["ui.autoLockMinutes"] ?? "0"}
        onChange={(v) => onChange("ui.autoLockMinutes", v)}
      />
    </div>
  );
}

// Порог автоблокировки по бездействию, минут (0 — выключено)
const AUTO_LOCK_PRESETS = [0, 1, 5, 10, 15, 30, 60];

function AutoLockSetting({
  enabled,
  value,
  onChange,
}: {
  enabled: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  // Значение сменили снаружи (кнопкой-пресетом) — поле ввода за ним
  useEffect(() => setDraft(value), [value]);

  // 0–1440 минут (сутки); мусор — 0, то есть «выключено»
  const commit = (raw: string) => {
    const n = String(Math.min(1440, Math.max(0, parseInt(raw) || 0)));

    setDraft(n);

    if (n !== value) onChange(n);
  };

  const current = parseInt(value) || 0;

  return (
    <div className={`pt-4 border-t border-border space-y-2 ${enabled ? "" : "opacity-50 pointer-events-none"}`}>
      <label className="block text-xs font-medium text-text-secondary">{t("security.autoLock")}</label>
      <div className="flex flex-wrap gap-1.5">
        {AUTO_LOCK_PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => commit(String(m))}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              current === m
                ? CHOICE_ON
                : CHOICE_OFF
            }`}
          >
            {m === 0 ? t("security.autoLockOff") : t("security.autoLockMinutes", { n: m })}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={1440}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
          className="w-20 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        />
        <span className="text-xs text-text-secondary">{t("security.autoLockUnit")}</span>
      </div>
      <p className="text-2xs text-text-muted leading-relaxed">
        {enabled ? t("security.autoLockHint") : t("security.autoLockNeedsPassword")}
      </p>
    </div>
  );
}

function ThemeGroup({
  label,
  themes,
  current,
  onPick,
}: {
  label: string;
  themes: AppTheme[];
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-2 self-start">
      <div className="text-2xs uppercase tracking-wider text-text-muted mb-2 px-1">{label}</div>
      <div className="space-y-1">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors text-left flex items-center gap-2 ${
              current === theme.id
                ? CHOICE_ON
                : CHOICE_OFF
            }`}
            onClick={() => onPick(theme.id)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-white/20"
              style={{ background: theme.xterm.cursor }}
            />
            <span className="truncate">{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`}>
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/**
 * ai.model общий для всех провайдеров: после переключения там может лежать
 * чужой алиас. Подсвечиваем его, только если он есть у текущего провайдера
 * (та же логика отката, что в AiPanel).
 */
function highlightedModel(models: string[], saved: string, fallback: string): string {
  if (models.length > 0 && !models.includes(saved)) return fallback;

  return saved || fallback;
}
