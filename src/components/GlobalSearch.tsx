import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../stores/appStore";
import { searchWiki } from "../lib/tauriCommands";
import type { WikiPage } from "../types";
import { useTranslation } from "react-i18next";


interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const { selectNode, setActiveWikiPage } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      searchWiki(query.trim()).then(setResults).catch(() => {});
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = (page: WikiPage) => {
    // Переключаем контекст дерева — WikiPanel реагирует и загружает страницы
    if (page.parentType !== "global") {
      selectNode({ type: page.parentType as "workspace" | "project" | "console", id: page.parentId });
    } else {
      selectNode(null);
    }
    // Устанавливаем нужную страницу активной — WikiPanel подхватит после загрузки
    setActiveWikiPage(page.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const contextLabel = (page: WikiPage) => {
    switch (page.parentType) {
      case "global": return t("globalSearch.contextGlobal");
      case "workspace": return t("globalSearch.contextWorkspace");
      case "project": return t("globalSearch.contextProject");
      case "console": return t("globalSearch.contextConsole");
      default: return page.parentType;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[600px] bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-sm">📖</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("globalSearch.placeholder")}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="text-2xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded border border-border">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {query.trim() && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-text-muted text-xs">
              {t("globalSearch.nothingFound")}
            </div>
          ) : (
            results.map((page, i) => (
              <div
                key={page.id}
                className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === selectedIndex ? "bg-accent-subtle" : "hover:bg-surface-3"
                }`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleSelect(page)}
              >
                <span className="text-text-muted text-sm shrink-0 mt-0.5">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">
                      {page.title || t("wikiPanel.untitled")}
                    </span>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-muted shrink-0">
                      {contextLabel(page)}
                    </span>
                  </div>
                  {page.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {page.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-2xs px-1 py-0.5 rounded bg-accent/10 text-accent">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-2xs text-text-muted">
            <span>{t("globalSearch.navHint")}</span>
            <span>{t("globalSearch.openHint")}</span>
            <span>{t("globalSearch.closeHint")}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
