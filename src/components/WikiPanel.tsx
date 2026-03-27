import { useEffect, useRef, useCallback, useState, KeyboardEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { createLowlight, common } from "lowlight";
import { Plus, Trash2, Pin, Search, X } from "lucide-react";

import { useAppStore } from "../stores/appStore";
import { WikiToolbar } from "./WikiToolbar";
import {
  loadWikiPages,
  saveWikiPage,
  deleteWikiPage,
  searchWiki,
} from "../lib/tauriCommands";
import type { WikiPage } from "../types";
import { useTranslation } from "react-i18next";

const lowlight = createLowlight(common);

// ── Утилиты ──────────────────────────────────────────────────

function newPage(parentType: WikiPage["parentType"], parentId: string): WikiPage {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    parentType,
    parentId,
    title: "",
    content: "",
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

function getContextLabel(parentType: WikiPage["parentType"], t: (key: string) => string): string {
  switch (parentType) {
    case "global": return t("wikiPanel.contextGlobal");
    case "workspace": return t("wikiPanel.contextWorkspace");
    case "project": return t("wikiPanel.contextProject");
    case "console": return t("wikiPanel.contextConsole");
  }
}

// ── Теги ──────────────────────────────────────────────────

interface TagsBarProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagsBar({ tags, onChange }: TagsBarProps) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "").replace(/,/g, "");
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue("");
    setInputVisible(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Escape") {
      setInputValue("");
      setInputVisible(false);
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  useEffect(() => {
    if (inputVisible) inputRef.current?.focus();
  }, [inputVisible]);

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/50 flex-wrap min-h-[28px]">
      <span className="text-2xs text-text-muted shrink-0">{t("wikiPanel.tagLabel")}</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary group"
        >
          #{tag}
          <button
            onClick={() => removeTag(tag)}
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      {inputVisible ? (
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (inputValue) addTag(inputValue); else setInputVisible(false); }}
          placeholder={t("wikiPanel.tagPlaceholder")}
          className="text-2xs bg-surface-3 rounded px-1.5 py-0.5 outline-none text-text-primary w-20 border border-accent/50"
        />
      ) : (
        <button
          onClick={() => setInputVisible(true)}
          className="text-2xs px-1.5 py-0.5 rounded border border-dashed border-border text-text-muted hover:text-accent hover:border-accent"
        >
          {t("wikiPanel.addTag")}
        </button>
      )}
    </div>
  );
}

// ── Главный компонент ────────────────────────────────────────

export function WikiPanel() {
  const {
    selectedNode,
    currentWikiPages,
    activeWikiPageId,
    setWikiPages,
    setActiveWikiPage,
    addWikiPage,
    updateWikiPage,
    removeWikiPage,
    showToast,
  } = useAppStore();
  const { t } = useTranslation();

  // Контекст: откуда грузить страницы
  const parentType: WikiPage["parentType"] = selectedNode?.type ?? "global";
  const parentId = selectedNode?.id ?? "global";

  const activePage = currentWikiPages.find((p) => p.id === activeWikiPageId) ?? null;
  // Ref для избежания stale closure в onUpdate
  const activePageRef = useRef<WikiPage | null>(null);
  activePageRef.current = activePage;

  const [showPageList, setShowPageList] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Поиск по wiki ──
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus();
    else { setSearchQuery(""); setSearchResults([]); }
  }, [searchActive]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      searchWiki(searchQuery).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Загрузка страниц при смене контекста
  useEffect(() => {
    let cancelled = false;
    loadWikiPages(parentType, parentId)
      .then((pages) => {
        if (!cancelled) setWikiPages(pages);
      })
      .catch(() => {
        if (!cancelled) setWikiPages([]);
      });
    return () => { cancelled = true; };
  }, [parentType, parentId]);

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: t("wikiPanel.editorPlaceholder") }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const page = activePageRef.current;
      if (!page) return;
      const json = JSON.stringify(editor.getJSON());
      updateWikiPage(page.id, { content: json, updatedAt: new Date().toISOString() });
      scheduleSave({ ...page, content: json, updatedAt: new Date().toISOString() });
    },
  });

  // Синхронизация редактора при смене активной страницы
  useEffect(() => {
    if (!editor) return;
    if (!activePage) {
      editor.commands.clearContent();
      return;
    }
    let parsed: object | string = "";
    try {
      if (activePage.content) parsed = JSON.parse(activePage.content);
    } catch {
      parsed = activePage.content;
    }
    // Не обновляем если уже актуально
    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson === activePage.content) return;
    editor.commands.setContent(parsed || "");
  }, [activeWikiPageId, editor]);

  const scheduleSave = useCallback((page: WikiPage) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveWikiPage(page).catch(() => {});
    }, 1000);
  }, []);

  // Немедленно сохраняем при уходе
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (activePage) saveWikiPage(activePage).catch(() => {});
      }
    };
  }, [activePage]);

  const handleTitleChange = (title: string) => {
    if (!activePage) return;
    const updatedAt = new Date().toISOString();
    updateWikiPage(activePage.id, { title, updatedAt });
    scheduleSave({ ...activePage, title, updatedAt });
  };

  const handleTagsChange = (tags: string[]) => {
    if (!activePage) return;
    const updatedAt = new Date().toISOString();
    updateWikiPage(activePage.id, { tags, updatedAt });
    scheduleSave({ ...activePage, tags, updatedAt });
  };

  const handleNewPage = () => {
    const page = newPage(parentType, parentId);
    addWikiPage(page);
    saveWikiPage(page).catch(() => {});
    setShowPageList(false);
  };

  const handleDeletePage = async () => {
    if (!activePage) return;
    if (!confirm(t("wikiPanel.deletePageConfirm", { title: activePage.title || t("wikiPanel.untitled") }))) return;
    try {
      await deleteWikiPage(activePage.id);
      removeWikiPage(activePage.id);
      showToast("success", t("wikiPanel.toastPageDeleted"));
    } catch (e) {
      showToast("error", String(e));
    }
  };

  // Заголовок контекста
  const contextLabel = getContextLabel(parentType, t);

  return (
    <div className="h-full flex flex-col bg-surface-1 min-w-0">
      {/* ── Header ── */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0 gap-2">
        {searchActive ? (
          <>
            <Search size={13} className="text-text-muted shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchActive(false); }}
              placeholder={t("wikiPanel.searchPlaceholder")}
              className="flex-1 text-xs bg-transparent outline-none text-text-primary placeholder:text-text-muted"
            />
            <button onClick={() => setSearchActive(false)} className="text-text-muted hover:text-text-primary shrink-0">
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider shrink-0">
                Wiki
              </span>
              <span className="text-2xs text-text-muted truncate">{contextLabel}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setSearchActive(true)}
                className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
                title={t("wikiPanel.searchTooltip")}
              >
                <Search size={13} />
              </button>
              <button
                onClick={() => setShowPageList((v) => !v)}
                className={`px-2 py-0.5 rounded text-2xs transition-colors ${
                  showPageList
                    ? "bg-accent-subtle text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                title={t("wikiPanel.pagesTooltip")}
              >
                {t("wikiPanel.pages", { count: currentWikiPages.length })}
              </button>
              <button
                onClick={handleNewPage}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs text-accent hover:bg-accent-subtle"
                title={t("wikiPanel.newPageTooltip")}
              >
                <Plus size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Результаты поиска ── */}
      {searchActive && searchQuery.trim() && (
        <div className="border-b border-border bg-surface-2 max-h-64 overflow-y-auto shrink-0">
          {searchResults.length === 0 ? (
            <div className="px-3 py-3 text-2xs text-text-muted text-center">{t("common.nothingFound")}</div>
          ) : (
            searchResults.map((page) => (
              <div
                key={page.id}
                onClick={async () => {
                  // Загружаем страницы нужного контекста и открываем найденную
                  const pages = await loadWikiPages(page.parentType, page.parentId);
                  setWikiPages(pages);
                  setActiveWikiPage(page.id);
                  setSearchActive(false);
                }}
                className="flex flex-col gap-0.5 px-3 py-2 cursor-pointer hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-primary truncate flex-1">
                    {page.title || "Без названия"}
                  </span>
                  <span className="text-2xs text-text-muted shrink-0 capitalize">
                    {page.parentType === "global" ? t("wikiPanel.contextGlobal") : page.parentType}
                  </span>
                </div>
                {page.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {page.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-2xs px-1 py-0.5 rounded bg-surface-3 text-text-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Список страниц (dropdown) ── */}
      {showPageList && (
        <div className="border-b border-border bg-surface-2 max-h-48 overflow-y-auto shrink-0">
          {currentWikiPages.length === 0 ? (
            <div className="px-3 py-3 text-2xs text-text-muted text-center">{t("wikiPanel.noPages")}</div>
          ) : (
            currentWikiPages.map((page) => (
              <div
                key={page.id}
                onClick={() => { setActiveWikiPage(page.id); setShowPageList(false); }}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition-colors ${
                  page.id === activeWikiPageId
                    ? "bg-accent-subtle text-accent"
                    : "hover:bg-surface-3 text-text-primary"
                }`}
              >
                {page.pinned && <Pin size={10} className="shrink-0 text-accent" />}
                <span className="truncate flex-1">{page.title || t("wikiPanel.untitled")}</span>
                <div className="flex gap-1 shrink-0">
                  {page.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-2xs px-1 py-0.5 rounded bg-surface-3 text-text-muted">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Редактор ── */}
      {!activePage ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <div className="text-3xl mb-3">📖</div>
            <div className="text-xs mb-2">{t("wikiPanel.noPages")}</div>
            <button
              onClick={handleNewPage}
              className="text-xs px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30"
            >
              {t("wikiPanel.createPage")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Заголовок страницы */}
          <input
            type="text"
            value={activePage.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t("wikiPanel.titlePlaceholder")}
            className="px-4 py-2.5 bg-transparent border-b border-border text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted shrink-0"
          />

          {/* Теги */}
          <TagsBar tags={activePage.tags} onChange={handleTagsChange} />

          {/* Тулбар */}
          {editor && <WikiToolbar editor={editor} />}

          {/* TipTap редактор */}
          <div className="flex-1 overflow-y-auto relative">
            <EditorContent
              editor={editor}
              className="wiki-editor h-full px-4 py-3 text-sm text-text-primary outline-none"
            />
          </div>

          {/* Нижняя панель */}
          <div className="h-8 flex items-center justify-between px-3 border-t border-border shrink-0">
            <span className="text-2xs text-text-muted truncate">
              {activePage.updatedAt
                ? t("wikiPanel.savedAt", { time: new Date(activePage.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
                : ""}
            </span>
            <button
              onClick={handleDeletePage}
              className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10"
              title={t("wikiPanel.deletePageTooltip")}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
