import { useEffect } from "react";
import { Globe, Github, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import appIcon from "../../src-tauri/icons/128x128.png";
import { APP_NAME, APP_VERSION, APP_COMMIT, SITE_URL, GITHUB_URL, displayUrl, openExternal } from "../lib/appInfo";

// ══════════════════════════════════════
// AboutDialog — «О программе»: версия, сайт, GitHub
// ══════════════════════════════════════
// Открывается из меню приложения macOS (событие "show-about" из Rust)
// и из Настроек → Интерфейс. Штатная панель macOS ссылки не умеет.

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const links = [
    { url: SITE_URL, label: t("about.site"), icon: Globe },
    { url: GITHUB_URL, label: t("about.github"), icon: Github },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-surface-1 border border-border rounded-xl shadow-2xl w-[360px] px-6 pt-7 pb-5 flex flex-col items-center text-center">
        <button
          className="absolute top-3 right-4 text-text-muted hover:text-text-primary text-base leading-none"
          onClick={onClose}
        >
          ✕
        </button>

        <img src={appIcon} alt="" className="w-16 h-16 mb-3" draggable={false} />
        <div className="text-base font-semibold text-text-primary">{APP_NAME}</div>
        <div className="text-xs text-text-secondary mt-1 select-text">
          {t("about.version", { version: APP_VERSION })}
          {APP_COMMIT && <span className="text-text-muted"> · {APP_COMMIT}</span>}
        </div>
        <div className="text-xs text-text-muted mt-3 leading-relaxed">{t("about.description")}</div>

        <div className="w-full mt-5 flex flex-col gap-1.5">
          {links.map(({ url, label, icon: Icon }) => (
            <button
              key={url}
              onClick={() => openExternal(url)}
              className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-surface-0 hover:bg-surface-2 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-text-secondary shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-2xs text-text-muted">{label}</span>
                <span className="block text-xs text-accent truncate">{displayUrl(url)}</span>
              </span>
              <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>

        <div className="text-2xs text-text-muted mt-5">© {new Date().getFullYear()} {APP_NAME}</div>
      </div>
    </div>
  );
}
