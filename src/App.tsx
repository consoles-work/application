import { useEffect, useRef, useState } from "react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalSearch } from "./components/GlobalSearch";
import { SettingsDialog } from "./components/SettingsDialog";
import { LockScreen } from "./components/LockScreen";
import { StatsDialog } from "./components/StatsDialog";
import { SshKeysDialog, quickSshAudit } from "./components/SshKeysDialog";
import { AboutDialog } from "./components/AboutDialog";
import { listen } from "@tauri-apps/api/event";
import { startUsageTracking, setUsageEnabled, setUsagePaused } from "./lib/usageStats";
import { useAppStore } from "./stores/appStore";
import { loadAllWorkspaces, getSettings, loadAiSessions, createAiSession, isPasswordSet } from "./lib/tauriCommands";
import { applyTheme } from "./lib/themes";
import { findConsole } from "./lib/tree";
import { useTranslation } from "react-i18next";
import i18n from "./lib/i18n";

// ══════════════════════════════════════
// App — корневой компонент: гейт пароля на вход
// ══════════════════════════════════════
// 1. Тема и язык — сразу, они нужны уже экрану блокировки.
// 2. Пароль задан — экран блокировки; MainApp не монтируется, пока пароль не
//    введён, — данные из БД (дерево, wiki, AI-чаты) не загружаются и не
//    рендерятся. Не смогли проверить — не пускаем без пароля.
// 3. Автоблокировка по бездействию (ui.autoLockMinutes, 0 — выкл) MainApp НЕ
//    размонтирует, чтобы не оборвать PTY-сессии: заставка ложится поверх, а
//    интерфейс под ней получает `inert` (без фокуса и кликов). Под заставкой
//    статистика не считается.

type LockState = "checking" | "locked" | "unlocked";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;

/** Шаг 3: как часто сверять время бездействия с порогом */
const AUTO_LOCK_CHECK_MS = 10_000;

function App() {
  const [lock, setLock] = useState<LockState>("checking");
  // MainApp смонтирован (пароль хотя бы раз введён или не задан)
  const [mounted, setMounted] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const autoLockMinutes = Math.max(0, parseInt(useAppStore((s) => s.settings["ui.autoLockMinutes"] ?? "0")) || 0);

  // 1–2. Тема, язык, пароль.
  useEffect(() => {
    // Служебные ключи security.* сюда не попадают. Не прочитались — экран
    // блокировки покажется в теме и на языке по умолчанию.
    getSettings()
      .then((s) => {
        applyTheme(s["ui.theme"] ?? "dark");
        i18n.changeLanguage(s["ui.language"] ?? "ru");
      })
      .catch((e) => console.warn("settings for lock screen", e));

    isPasswordSet()
      .then((set) => setLock(set ? "locked" : "unlocked"))
      .catch(() => setLock("locked"));
  }, []);

  useEffect(() => {
    setUsagePaused(lock !== "unlocked");

    if (lock === "unlocked") setMounted(true);

    // inert: под заставкой нельзя сфокусировать терминал/инпуты и кликнуть
    mainRef.current?.toggleAttribute("inert", lock === "locked");
  }, [lock]);

  // 3. Автоблокировка.
  useAutoLock(lock === "unlocked" && autoLockMinutes > 0, autoLockMinutes, () => setLock("locked"));

  if (lock === "checking") return <div className="h-screen w-screen bg-surface-0" />;

  return (
    <>
      {mounted && (
        <div ref={mainRef} className="contents">
          <MainApp />
        </div>
      )}
      {lock === "locked" && (
        // Поверх модалок (z-50) и drag-ghost дерева (9999). stopPropagation в
        // React-обработчике не даёт клавишам дойти до window/document-слушателей
        // горячих клавиш интерфейса под заставкой.
        <div className="fixed inset-0 z-[10000]" onKeyDown={(e) => e.stopPropagation()}>
          <LockScreen idle={mounted} onUnlock={() => setLock("unlocked")} />
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════
// MainApp — интерфейс после входа
// ══════════════════════════════════════
// При старте:
//  1. Дерево из БД; затем фоновая проверка SSH-ключей — только для индикатора
//     у кнопки в заголовке, окно не открывается. Дерево не загрузилось — тост.
//  2. AI-чаты; нет ни одного — создаётся первый.
//  3. Настройки: тема, язык, видимость и ширина панелей. До их загрузки
//     статистика не собирается — неизвестно, включена ли она.
// Всё время: глобальные горячие клавиши, без системного меню WebKit по ПКМ,
// без автокоррекции в полях ввода.

function MainApp() {
  const { settings, setWorkspaces, setSettings, showToast } = useAppStore();
  const { t } = useTranslation();
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSshKeys, setShowSshKeys] = useState(false);
  // Критичные проблемы SSH-ключей — точка у кнопки в заголовке
  const [sshCritical, setSshCritical] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const statsEnabled = settingsLoaded && settings["stats.enabled"] !== "false";

  useEffect(() => {
    // 1. Дерево и индикатор SSH.
    loadAllWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);

        quickSshAudit()
          .then((a) => setSshCritical(a.counts.critical))
          .catch((e) => console.warn("ssh audit", e));
      })
      .catch((e) => showToast("error", t("app.toastLoadError", { error: e })));

    // 2. AI-чаты.
    loadOrCreateAiSessions().catch((e) => console.warn("ai sessions", e));

    // 3. Настройки.
    getSettings()
      .then((s) => {
        setSettings(s);
        setSettingsLoaded(true);

        i18n.changeLanguage(s["ui.language"] ?? "ru");

        restoreLayout(s);
      })
      .catch((e) => console.warn("settings", e));
  }, [setWorkspaces, setSettings, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Тема — при каждой смене настройки (и после загрузки)
  useEffect(() => {
    applyTheme(settings["ui.theme"] ?? "dark");
  }, [settings["ui.theme"]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Статистика использования (stats.enabled, по умолчанию включена)
  useEffect(() => startUsageTracking(), []);

  useEffect(() => {
    setUsageEnabled(statsEnabled);

    if (!statsEnabled) setShowStats(false);
  }, [statsEnabled]);

  // Нативное контекстное меню WebKit не нужно (убирает "Reload" при ПКМ на пустом месте)
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("contextmenu", onContextMenu);

    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useNoAutocorrect();

  // «О программе» из меню приложения macOS (app_shell.rs → show_about)
  useEffect(() => {
    const unlisten = listen("show-about", () => setShowAbout(true));

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Глобальные горячие клавиши
  useEffect(() => {
    const dialogs: Dialogs = {
      openPalette: () => setShowPalette(true),
      openSettings: () => setShowSettings(true),
      openSearch: () => setShowGlobalSearch(true),
    };

    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      const hotkey = HOTKEYS.find((h) => h.matches(e));

      if (hotkey && hotkey.run(dialogs, e) !== false) e.preventDefault();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Layout
        onOpenSettings={() => setShowSettings(true)}
        onOpenStats={statsEnabled ? () => setShowStats(true) : undefined}
        onOpenSshKeys={() => setShowSshKeys(true)}
        sshKeysAlert={sshCritical}
      />
      <ToastContainer />
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} />}
      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onOpenAbout={() => {
            setShowSettings(false);
            setShowAbout(true);
          }}
        />
      )}
      {showStats && <StatsDialog onClose={() => setShowStats(false)} />}
      {showSshKeys && <SshKeysDialog onClose={() => setShowSshKeys(false)} onAudit={(a) => setSshCritical(a.counts.critical)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </>
  );
}

export default App;

// ══════════════════════════════════════
// Горячие клавиши (Cmd на macOS, Ctrl на остальных)
// ══════════════════════════════════════

interface Dialogs {
  openPalette: () => void;
  openSettings: () => void;
  openSearch: () => void;
}

interface Hotkey {
  matches: (e: KeyboardEvent) => boolean;
  /** false — клавиша не обработана, браузер получит её как обычно */
  run: (dialogs: Dialogs, e: KeyboardEvent) => boolean | void;
}

const key = (k: string) => (e: KeyboardEvent) => e.key === k;
const keyNoShift = (k: string) => (e: KeyboardEvent) => !e.shiftKey && e.key === k;

const HOTKEYS: Hotkey[] = [
  { matches: key("b"), run: () => useAppStore.getState().toggleTreePanel() },
  { matches: key("\\"), run: () => useAppStore.getState().toggleWikiPanel() },
  { matches: key("i"), run: () => useAppStore.getState().toggleAiPanel() },
  { matches: key("p"), run: (d) => d.openPalette() },
  { matches: key(","), run: (d) => d.openSettings() },
  // Глобальный поиск по wiki
  { matches: (e) => e.shiftKey && e.key === "K", run: (d) => d.openSearch() },
  // Закрыть активную вкладку терминала
  { matches: keyNoShift("w"), run: closeActiveTab },
  // Следующая / с Shift — предыдущая вкладка
  { matches: key("Tab"), run: (_, e) => cycleTab(e.shiftKey ? -1 : 1) },
  // Перейти на верхнюю вкладку N (консоль, её последний экземпляр)
  { matches: (e) => !e.shiftKey && e.key >= "1" && e.key <= "9", run: (_, e) => activateTabNumber(parseInt(e.key)) },
  // Новая сессия выбранной консоли; уже открыта — ещё один экземпляр в подвкладке
  { matches: keyNoShift("t"), run: openSelectedConsoleInstance },
];

function closeActiveTab() {
  const { activeSessionId, closeSession } = useAppStore.getState();

  if (activeSessionId) closeSession(activeSessionId);
}

/** По кругу; одна вкладка или нет активной — ничего */
function cycleTab(step: 1 | -1) {
  const { sessions, activeSessionId, setActiveSession } = useAppStore.getState();

  const idx = sessions.findIndex((s) => s.id === activeSessionId);

  if (sessions.length <= 1 || idx === -1) return;

  setActiveSession(sessions[(idx + step + sessions.length) % sessions.length].id);
}

/** false — вкладки с таким номером нет, клавиша не наша */
function activateTabNumber(n: number): boolean {
  const { sessions, activateConsole } = useAppStore.getState();

  const consoleId = [...new Set(sessions.map((s) => s.console_id))][n - 1];

  if (!consoleId) return false;

  activateConsole(consoleId);

  return true;
}

function openSelectedConsoleInstance() {
  const { selectedNode, workspaces, openConsole } = useAppStore.getState();

  if (selectedNode?.type !== "console") return;

  const name = findConsole(workspaces, selectedNode.id)?.console.name ?? selectedNode.id;

  openConsole(selectedNode.id, name, true);
}

// ══════════════════════════════════════
// Детали
// ══════════════════════════════════════

/** Шаг 2 MainApp: открыть первый чат; если чатов нет — создать */
async function loadOrCreateAiSessions() {
  const { setAiSessions, setActiveAiSessionId } = useAppStore.getState();

  const sessions = await loadAiSessions();

  const list = sessions.length > 0 ? sessions : [await createAiSession("Новый чат", "openai", "")];

  setAiSessions(list);
  setActiveAiSessionId(list[0].id);
}

/** Шаг 3 MainApp: видимость панелей (по умолчанию — показывать) и ширина дерева, если сохранены */
function restoreLayout(s: Record<string, string>) {
  const store = useAppStore.getState();

  if (s["ui.showTreePanel"] !== undefined) store.setShowTreePanel(s["ui.showTreePanel"] !== "false");
  if (s["ui.showWikiPanel"] !== undefined) store.setShowWikiPanel(s["ui.showWikiPanel"] !== "false");
  if (s["ui.showAiPanel"] !== undefined) store.setShowAiPanel(s["ui.showAiPanel"] === "true");
  if (s["ui.aiPanelPosition"] !== undefined) store.setAiPanelPosition(s["ui.aiPanelPosition"] as "right" | "bottom");

  const width = parseInt(s["ui.treePanelWidth"] ?? "");

  // Битое или вне допустимых границ — остаётся ширина по умолчанию
  if (width >= 180 && width <= 500) store.setTreePanelWidth(width);
}

/**
 * Шаг 3 App: блокировка после `minutes` без действий пользователя. Время
 * последнего действия сверяется по таймеру и при возврате окна — после сна или
 * из трея таймеры WebKit могут не тикать, а метка времени остаётся честной.
 */
function useAutoLock(enabled: boolean, minutes: number, onLock: () => void) {
  useEffect(() => {
    if (!enabled) return;

    let last = Date.now();

    const bump = (e: Event) => {
      // Движение мыши над неактивным окном — не активность
      if (e.type === "mousemove" && !document.hasFocus()) return;

      last = Date.now();
    };

    const check = () => {
      if (Date.now() - last < minutes * 60_000) return;

      // Пароль могли снять в настройках — тогда блокировать нечем, отсчёт заново
      isPasswordSet()
        .then((set) => {
          if (set) onLock();
          else last = Date.now();
        })
        .catch(onLock);
    };

    const opts = { capture: true, passive: true };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, bump, opts));
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);

    const timer = window.setInterval(check, AUTO_LOCK_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, bump, opts));
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
    // onLock — свежая стрелка на каждый рендер; подписки зависят только от включения и порога
  }, [enabled, minutes]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Без автокоррекции, автозаглавных и проверки орфографии во всех input/textarea — и в появляющихся позже */
function useNoAutocorrect() {
  useEffect(() => {
    const disable = (el: Element) => {
      el.setAttribute("autocorrect", "off");
      el.setAttribute("autocapitalize", "none");
      el.setAttribute("spellcheck", "false");
    };

    const disableWithin = (root: Element) => {
      if (root.matches("input, textarea")) disable(root);

      root.querySelectorAll("input, textarea").forEach(disable);
    };

    disableWithin(document.body);

    const observer = new MutationObserver((mutations) => {
      const added = mutations.flatMap((m) => Array.from(m.addedNodes));

      added.filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE).forEach(disableWithin);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}
