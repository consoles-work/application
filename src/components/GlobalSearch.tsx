import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../stores/appStore";
import { searchWiki } from "../lib/tauriCommands";
import type { WikiPage } from "../types";
import { useTranslation } from "react-i18next";
import { useListNavigation } from "../hooks/useListNavigation";

// ══════════════════════════════════════
// GlobalSearch — полнотекстовый поиск по всей wiki (Cmd+Shift+K)
// ══════════════════════════════════════
// Запрос уходит после паузы в наборе. Выбор страницы переключает контекст
// дерева на её узел (глобальная — снимает выбор); WikiPanel загружает
// страницы контекста и открывает выбранную.

const SEARCH_DELAY_MS = 300;

const CONTEXT_LABEL: Record<WikiPage["parentType"], string> = {
  global: "globalSearch.contextGlobal",
  workspace: "globalSearch.contextWorkspace",
  project: "globalSearch.contextProject",
  console: "globalSearch.contextConsole",
};

interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const { selectNode, setActiveWikiPage } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiPage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleSelect = (page: WikiPage) => {
    selectNode(page.parentType === "global" ? null : { type: page.parentType, id: page.parentId });

    setActiveWikiPage(page.id);

    onClose();
  };

  const nav = useListNavigation(results, handleSelect, onClose, query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Пауза в наборе — запрос; ошибка поиска — как «ничего не найдено»
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);

      return;
    }

    const timer = setTimeout(() => {
      searchWiki(query.trim())
        .then(setResults)
        .catch(() => setResults([]));
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [query]);

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
            onKeyDown={nav.onKeyDown}
            placeholder={t("globalSearch.placeholder")}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="text-2xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded border border-border">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-center text-text-muted text-xs">{t("globalSearch.nothingFound")}</div>
          )}
          {results.map((page, i) => (
              <div
                key={page.id}
                className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === nav.index ? "bg-accent-subtle" : "hover:bg-surface-3"
                }`}
                onMouseEnter={() => nav.setIndex(i)}
                onClick={() => handleSelect(page)}
              >
                <span className="text-text-muted text-sm shrink-0 mt-0.5">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">
                      {page.title || t("wikiPanel.untitled")}
                    </span>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-muted shrink-0">
                      {t(CONTEXT_LABEL[page.parentType])}
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
          ))}
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
