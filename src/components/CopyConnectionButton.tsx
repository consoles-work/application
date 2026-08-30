import { useState, useRef, useEffect } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/appStore";
import {
  buildConnectionString,
  type ConnectionCopyFormat,
} from "../lib/connectionString";
import type { ConsoleConfig } from "../types";

const FORMATS: { id: ConnectionCopyFormat; labelKey: string }[] = [
  { id: "command", labelKey: "dialogs.copyFormatCommand" },
  { id: "target", labelKey: "dialogs.copyFormatTarget" },
  { id: "params", labelKey: "dialogs.copyFormatParams" },
];

/**
 * Кнопка «Копировать параметры подключения» с превью строки и выбором формата.
 *
 * Работает по текущим значениям формы, а не по сохранённой записи, — то, что
 * видно в полях, то и попадает в буфер.
 */
export function CopyConnectionButton({ config }: { config: ConsoleConfig }) {
  const { t } = useTranslation();
  const { showToast } = useAppStore();
  const [format, setFormat] = useState<ConnectionCopyFormat>("command");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Закрытие меню по клику вне
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const value = buildConnectionString(config, format);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast("success", t("dialogs.copyConnectionDone"));
    } catch (e) {
      showToast("error", t("dialogs.copyConnectionError", { error: e }));
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="text-2xs text-text-muted mb-1">
        {t("dialogs.copyConnection")}{" "}
        <span className="opacity-50">{t("dialogs.copyConnectionNote")}</span>
      </div>
      <div className="flex gap-2">
        <pre className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-2xs text-text-secondary font-mono overflow-x-auto whitespace-pre m-0">
          {value}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          title={t("dialogs.copyConnection")}
          className="px-2.5 py-1.5 text-xs bg-surface-3 hover:bg-surface-1 text-text-secondary rounded-md border border-border shrink-0 flex items-center gap-1.5"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {t("common.copy")}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={t("dialogs.copyFormat")}
          className="px-1.5 py-1.5 text-xs bg-surface-3 hover:bg-surface-1 text-text-secondary rounded-md border border-border shrink-0"
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[180px] rounded-md border border-border bg-surface-1 shadow-lg py-1">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFormat(f.id);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 ${
                format === f.id ? "text-accent" : "text-text-secondary"
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
