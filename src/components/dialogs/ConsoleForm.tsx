import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/appStore";
import type { ConsoleConfig, QuickCommandColor, SshKeyFile } from "../../types";
import { CopyConnectionButton } from "../CopyConnectionButton";
import { UnderlineTabs } from "../UnderlineTabs";
import { SuggestInput, type SuggestOption } from "../SuggestInput";
import { QUICK_COMMAND_COLORS } from "../../lib/quickCommandColors";
import { CONSOLE_ICONS, ConsoleIconTile } from "../../lib/consoleIcons";
import { inspectSshKey } from "../../lib/tauriCommands";
import { permsTooOpen, formatMode } from "../../lib/sshAudit";

/** Значения формы консоли — общие для создания и редактирования */
export interface ConsoleFormValues {
  name: string;
  connectionType: "local" | "ssh";
  startupCmd: string;
  note: string;
  hosting: string;
  sshHost: string;
  sshPort: string;
  sshUser: string;
  sshKeyPath: string;
  sshExtraArgs: string;
  sshPassphrase: string;
  sshPassword: string;
  isDanger: boolean;
  dangerLabel: string;
  icon: string;
  color: QuickCommandColor;
}

export function consoleFormValues(con?: ConsoleConfig): ConsoleFormValues {
  return {
    name: con?.name ?? "",
    connectionType: con ? ((con.connectionType as "local" | "ssh") || "local") : "ssh",
    startupCmd: con?.startupCmd ?? "",
    note: con?.note ?? "",
    hosting: con?.hosting ?? "",
    sshHost: con?.sshHost ?? "",
    sshPort: String(con?.sshPort || 22),
    sshUser: con?.sshUser ?? "",
    sshKeyPath: con?.sshKeyPath ?? "",
    sshExtraArgs: con?.sshExtraArgs ?? "",
    sshPassphrase: con?.sshPassphrase ?? "",
    sshPassword: con?.sshPassword ?? "",
    isDanger: con?.isDanger ?? false,
    dangerLabel: con?.dangerLabel || "PRODUCTION",
    icon: con?.icon ?? "",
    color: con?.color ?? "",
  };
}

type Tab = "main" | "startup" | "info" | "look";

interface Props {
  title: string;
  initial: ConsoleFormValues;
  submitLabel: string;
  submittingLabel: string;
  /** Редактируемая консоль — для кнопки копирования параметров подключения */
  existing?: ConsoleConfig;
  autoFocusName?: boolean;
  onSubmit: (values: ConsoleFormValues) => Promise<void>;
  onClose: () => void;
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-surface-0 border border-border text-xs text-text-primary outline-none focus:border-accent";
// Рамка-группа полей и поля внутри неё (фон контрастнее, чем у рамки)
const boxCls = "flex flex-col gap-2 rounded-lg border border-border bg-surface-0 p-3";
const boxInputCls = "w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent font-mono";
const boxTextCls = "w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-xs text-text-primary outline-none focus:border-accent";
const sideBtnCls = "px-2.5 py-1.5 text-xs bg-surface-3 hover:bg-surface-1 text-text-secondary rounded-md border border-border shrink-0";

/**
 * Диалог консоли с вкладками. Шапка и кнопки закреплены, прокручивается только
 * содержимое вкладки — «Сохранить» всегда на виду.
 */
export function ConsoleForm({ title, initial, submitLabel, submittingLabel, existing, autoFocusName, onSubmit, onClose }: Props) {
  const [v, setV] = useState<ConsoleFormValues>(initial);
  const set = <K extends keyof ConsoleFormValues>(key: K, value: ConsoleFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const [tab, setTab] = useState<Tab>("main");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const { workspaces, showToast } = useAppStore();
  const { t } = useTranslation();

  useEffect(() => { if (autoFocusName) nameRef.current?.focus(); }, [autoFocusName]);

  // Подсказка под полем ключа: файл есть ли, защищён ли passphrase, права (локально, раздел «SSH-ключи»)
  const [keyInfo, setKeyInfo] = useState<SshKeyFile | null>(null);
  useEffect(() => {
    const path = v.sshKeyPath.trim();
    if (v.connectionType !== "ssh" || !path) { setKeyInfo(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      inspectSshKey(path).then((k) => { if (!cancelled) setKeyInfo(k); }).catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [v.sshKeyPath, v.connectionType]);
  const keyHints: { text: string; tone: "red" | "amber" | "muted" }[] = [];
  if (keyInfo) {
    if (!keyInfo.privateExists && !keyInfo.publicExists) keyHints.push({ text: t("sshKeys.hintMissing"), tone: "red" });
    else if (!keyInfo.privateExists) keyHints.push({ text: t("sshKeys.hintNoPrivate"), tone: "amber" });
    if (keyInfo.privateExists && permsTooOpen(keyInfo.mode)) keyHints.push({ text: t("sshKeys.hintPerms", { mode: formatMode(keyInfo.mode) }), tone: "red" });
    if (keyInfo.privateExists && keyInfo.encrypted === false) keyHints.push({ text: t("sshKeys.hintNoPassphrase"), tone: "amber" });
    if (keyInfo.encrypted === true && !v.sshPassphrase && !keyInfo.agentLoaded) keyHints.push({ text: t("sshKeys.hintNeedPassphrase"), tone: "muted" });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Уже использованные хостинги: без дублей с точностью до регистра, по алфавиту
  const hostingOptions = useMemo<SuggestOption[]>(() => {
    const map = new Map<string, SuggestOption>();
    for (const ws of workspaces)
      for (const proj of ws.projects)
        for (const con of proj.consoles) {
          const h = con.hosting?.trim();
          if (!h) continue;
          const key = h.toLowerCase();
          const entry = map.get(key);
          if (entry) entry.count = (entry.count ?? 0) + 1;
          else map.set(key, { value: h, count: 1 });
        }
    return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
  }, [workspaces]);

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({ multiple: false, directory: false });
      if (typeof selected === "string") set("sshKeyPath", selected);
    } catch (e) {
      showToast("error", t("dialogs.toastFileSelectError", { error: e }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) { setTab("main"); return; }
    if (v.connectionType === "ssh" && !v.sshHost.trim()) {
      setTab("main");
      showToast("error", t("dialogs.toastSshHostRequired"));
      return;
    }
    setLoading(true);
    try {
      await onSubmit(v);
      onClose();
    } catch (err) {
      showToast("error", t("dialogs.toastError", { error: err }));
    } finally {
      setLoading(false);
    }
  };

  const isSsh = v.connectionType === "ssh";
  const tabs = [
    { id: "main" as const, label: t("dialogs.tabMain") },
    { id: "startup" as const, label: t("dialogs.tabStartup"), marked: !!v.startupCmd.trim() || (isSsh && !!v.sshExtraArgs.trim()) },
    { id: "info" as const, label: t("dialogs.tabInfo"), marked: !!v.hosting.trim() || !!v.note.trim() },
    { id: "look" as const, label: t("dialogs.tabLook"), marked: !!v.icon || !!v.color || v.isDanger },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-surface-2 border border-border rounded-xl shadow-2xl w-[480px] max-h-[92vh] flex flex-col"
      >
        {/* Шапка: заголовок + вкладки */}
        <div className="px-5 pt-5 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary mb-3">{title}</h2>
          <UnderlineTabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {/* Содержимое вкладки */}
        <div className="flex-1 min-h-[470px] overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {tab === "main" && (
            <>
              <div>
                <div className="text-2xs text-text-primary mb-1">{t("dialogs.fieldName")}</div>
                <input
                  ref={nameRef}
                  value={v.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("dialogs.consoleNamePlaceholder")}
                  className={`${inputCls} text-sm`}
                />
              </div>

              <div>
                <div className="text-2xs text-text-primary mb-1.5">{t("dialogs.connectionType")}</div>
                <div className="w-52">
                  <UnderlineTabs
                    tabs={[
                      { id: "ssh" as const, label: "🔗 SSH" },
                      { id: "local" as const, label: "💻 Local" },
                    ]}
                    active={v.connectionType}
                    onChange={(type) => set("connectionType", type)}
                  />
                </div>
              </div>

              {/* У локальной консоли своих полей нет — всё остальное на других вкладках */}
              {!isSsh && (
                <div className="text-2xs text-text-muted leading-relaxed">
                  {t("dialogs.localHint")}{" "}
                  <button type="button" onClick={() => setTab("startup")} className="text-accent hover:underline">
                    {t("dialogs.localHintStartup")}
                  </button>
                </div>
              )}

              {isSsh && (
                <div className={boxCls}>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-2xs text-text-primary mb-1">{t("dialogs.host")}</div>
                      <input value={v.sshHost} onChange={(e) => set("sshHost", e.target.value)}
                        placeholder="192.168.1.10" className={boxInputCls} />
                    </div>
                    <div className="w-20">
                      <div className="text-2xs text-text-primary mb-1">{t("dialogs.port")}</div>
                      <input value={v.sshPort} onChange={(e) => set("sshPort", e.target.value)}
                        placeholder="22" type="number" min="1" max="65535" className={boxInputCls} />
                    </div>
                  </div>

                  <div>
                    <div className="text-2xs text-text-primary mb-1">{t("dialogs.user")}</div>
                    <input value={v.sshUser} onChange={(e) => set("sshUser", e.target.value)}
                      placeholder="root" className={boxInputCls} />
                  </div>

                  <div>
                    <div className="text-2xs text-text-primary mb-1">{t("dialogs.sshPassword")} <span className="opacity-50">{t("dialogs.sshPasswordNote")}</span></div>
                    <div className="flex gap-2">
                      <input
                        type={showSshPassword ? "text" : "password"}
                        value={v.sshPassword}
                        onChange={(e) => set("sshPassword", e.target.value)}
                        placeholder={t("dialogs.sshPasswordPlaceholder")}
                        className={`${boxInputCls} flex-1`}
                      />
                      <button type="button" onClick={() => setShowSshPassword((s) => !s)} className={sideBtnCls}>
                        {showSshPassword ? t("settings.agentsHideKey") : t("settings.agentsShowKey")}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-2xs text-text-primary mb-1">{t("dialogs.sshKey")}</div>
                    <div className="flex gap-2">
                      <input value={v.sshKeyPath} onChange={(e) => set("sshKeyPath", e.target.value)}
                        placeholder="~/.ssh/id_rsa" className={`${boxInputCls} flex-1`} />
                      <button type="button" onClick={handleBrowseKey} className={sideBtnCls}>
                        {t("common.browse")}
                      </button>
                    </div>
                    {keyHints.map((h) => (
                      <div key={h.text} className={`text-2xs mt-1 ${h.tone === "red" ? "text-red-500" : h.tone === "amber" ? "text-amber-500" : "text-text-muted"}`}>
                        {h.text}
                      </div>
                    ))}
                  </div>

                  {/* Passphrase — только когда выбран ключ */}
                  {v.sshKeyPath.trim() !== "" && (
                    <div>
                      <div className="text-2xs text-text-primary mb-1">{t("dialogs.sshPassphrase")} <span className="opacity-50">{t("dialogs.sshPassphraseNote")}</span></div>
                      <div className="flex gap-2">
                        <input
                          type={showPassphrase ? "text" : "password"}
                          value={v.sshPassphrase}
                          onChange={(e) => set("sshPassphrase", e.target.value)}
                          placeholder={t("dialogs.sshPassphrasePlaceholder")}
                          className={`${boxInputCls} flex-1`}
                        />
                        <button type="button" onClick={() => setShowPassphrase((s) => !s)} className={sideBtnCls}>
                          {showPassphrase ? t("settings.agentsHideKey") : t("settings.agentsShowKey")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Копирование параметров подключения — по текущим значениям формы */}
                  {existing && (
                    <CopyConnectionButton
                      config={{
                        ...existing,
                        name: v.name,
                        connectionType: v.connectionType,
                        sshHost: v.sshHost,
                        sshPort: parseInt(v.sshPort) || 22,
                        sshUser: v.sshUser,
                        sshKeyPath: v.sshKeyPath,
                        sshExtraArgs: v.sshExtraArgs,
                      }}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {tab === "startup" && (
            <div className={boxCls}>
              <div>
                <div className="text-2xs text-text-primary mb-1">
                  {t("dialogs.startupCommands")} <span className="opacity-60">{t("dialogs.startupCommandsNote")}</span>
                </div>
                <textarea
                  value={v.startupCmd}
                  onChange={(e) => set("startupCmd", e.target.value)}
                  placeholder={isSsh ? t("dialogs.startupPlaceholderSsh") : t("dialogs.startupPlaceholderLocal")}
                  rows={6}
                  className={`${boxInputCls} resize-y`}
                />
              </div>
              {isSsh && (
                <div>
                  <div className="text-2xs text-text-primary mb-1">{t("dialogs.extraArgs")}</div>
                  <input value={v.sshExtraArgs} onChange={(e) => set("sshExtraArgs", e.target.value)}
                    placeholder="-A -C -L 8080:localhost:8080" className={boxInputCls} />
                </div>
              )}
            </div>
          )}

          {tab === "info" && (
            <div className={boxCls}>
              <div>
                <div className="text-2xs text-text-primary mb-1">
                  {t("dialogs.hosting")} <span className="opacity-60">{t("dialogs.hostingHint")}</span>
                </div>
                <SuggestInput
                  value={v.hosting}
                  onChange={(h) => set("hosting", h)}
                  options={hostingOptions}
                  placeholder={t("dialogs.hostingPlaceholder")}
                  className={boxTextCls}
                />
                {hostingOptions.length > 0 && (
                  <div className="text-2xs text-text-muted mt-1">{t("dialogs.hostingPickHint")}</div>
                )}
              </div>
              <div>
                <div className="text-2xs text-text-primary mb-1">
                  {t("dialogs.note")} <span className="opacity-60">{t("dialogs.noteHint")}</span>
                </div>
                <textarea
                  value={v.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder={t("dialogs.notePlaceholder")}
                  rows={6}
                  className={`${boxTextCls} resize-y`}
                />
              </div>
            </div>
          )}

          {tab === "look" && (
            <>
              {/* Превью строки дерева */}
              <div>
                <div className="text-2xs text-text-primary mb-1">{t("dialogs.lookPreview")}</div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-0 border border-border text-xs text-text-primary">
                  <ConsoleIconTile con={v} />
                  <span className="truncate flex-1">{v.name.trim() || t("dialogs.consoleNamePlaceholder")}</span>
                  {v.isDanger && (
                    <span className="shrink-0 text-2xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                      ⚠ {v.dangerLabel.trim() || "PRODUCTION"}
                    </span>
                  )}
                </div>
              </div>

              <div className={boxCls}>
                <div>
                  <div className="text-2xs text-text-primary mb-1.5">{t("dialogs.consoleIcon")}</div>
                  <div className="grid grid-cols-10 gap-1">
                    <button
                      type="button"
                      title={t("dialogs.consoleIconAuto")}
                      onClick={() => set("icon", "")}
                      className={`h-8 rounded-md flex items-center justify-center border text-2xs ${
                        v.icon === "" ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface-2 text-text-muted hover:border-accent/40"
                      }`}
                    >
                      {t("dialogs.consoleIconAutoShort")}
                    </button>
                    {CONSOLE_ICONS.map(({ id, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => set("icon", id)}
                        className={`h-8 rounded-md flex items-center justify-center border ${
                          v.icon === id ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface-2 text-text-secondary hover:border-accent/40"
                        }`}
                      >
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-2xs text-text-primary mb-1.5">{t("dialogs.consoleColor")}</div>
                  <div className="flex items-center gap-1.5">
                    {QUICK_COMMAND_COLORS.map(({ id, hex }) => (
                      <button
                        key={id || "none"}
                        type="button"
                        title={t(`quickCommands.colors.${id || "none"}`)}
                        onClick={() => set("color", id)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          v.color === id ? "ring-2 ring-accent ring-offset-1 ring-offset-surface-0" : ""
                        } ${hex ? "border-transparent" : "border-border bg-surface-2 text-text-muted"}`}
                        style={hex ? { backgroundColor: hex } : undefined}
                      >
                        {!hex && <Ban size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={boxCls}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={v.isDanger} onChange={(e) => set("isDanger", e.target.checked)}
                    className="accent-red-500 w-3.5 h-3.5" />
                  <span className="text-xs text-text-primary">{t("dialogs.markAsDanger")}</span>
                </label>
                {v.isDanger && (
                  <div>
                    <div className="text-2xs text-text-primary mb-1">{t("dialogs.dangerLabel")}</div>
                    <input
                      value={v.dangerLabel}
                      onChange={(e) => set("dangerLabel", e.target.value)}
                      placeholder={t("dialogs.dangerLabelPlaceholder2")}
                      className="w-full px-2.5 py-1.5 rounded-md bg-surface-2 border border-red-500/40 text-xs text-text-primary outline-none focus:border-red-400 font-mono"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Кнопки — всегда видны */}
        <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-3">
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={!v.name.trim() || loading}
            className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40">
            {loading ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
