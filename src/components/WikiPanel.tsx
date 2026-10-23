import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { createLowlight, common } from "lowlight";
import { Plus, Trash2, Pin, Search, X } from "lucide-react";

import { useAppStore } from "../stores/appStore";
import { trackUsage, METRICS } from "../lib/usageStats";
import { findLinks, isSafeExternalUrl, openLink } from "../lib/links";
import { WikiToolbar } from "./WikiToolbar";
import {
  loadWikiPages,
  saveWikiPage,
  deleteWikiPage,
  searchWiki,
} from "../lib/tauriCommands";
import type { WikiPage } from "../types";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════
// WikiPanel — заметки к выбранному узлу дерева
// ══════════════════════════════════════
// 1. Контекст — выбранный воркспейс, проект или консоль (ничего не выбрано —
//    глобальная wiki); смена контекста загружает его страницы.
// 2. Правка заголовка, тегов и текста сразу видна в интерфейсе и сохраняется в
//    БД через секунду после последнего изменения; при уходе со страницы —
//    сразу. Не сохранилось — тост.
// 3. Поиск по всей wiki: найденная страница открывается в своём контексте.
// 4. Удаление — после подтверждения.
// Ссылки открываются кликом в системном браузере; старые страницы с URL
// простым текстом получают ссылки при открытии.

const lowlight = createLowlight(common);

/** Шаг 2: пауза после последней правки до записи в БД */
const SAVE_DELAY_MS = 1000;

/** Шаг 3: пауза в наборе запроса до поиска */
const SEARCH_DELAY_MS = 300;

const CONTEXT_LABEL: Record<WikiPage["parentType"], string> = {
  global: "wikiPanel.contextGlobal",
  workspace: "wikiPanel.contextWorkspace",
  project: "wikiPanel.contextProject",
  console: "wikiPanel.contextConsole",
};

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

  // onUpdate редактора создаётся один раз — читает текущую страницу через ref
  const activePageRef = useRef<WikiPage | null>(null);

  activePageRef.current = activePage;

  const [showPageList, setShowPageList] = useState(false);

  // Шаг 2: правка, которая ждёт паузы, чтобы уйти в БД
  const pendingSave = useRef<{ page: WikiPage; timer: ReturnType<typeof setTimeout> } | null>(null);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Страницы контекста; ответ на старый контекст отбрасываем. Не загрузились — пусто.
  useEffect(() => {
    let cancelled = false;

    loadWikiPages(parentType, parentId)
      .then((pages) => !cancelled && setWikiPages(pages))
      .catch(() => !cancelled && setWikiPages([]));

    return () => {
      cancelled = true;
    };
  }, [parentType, parentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Поиск: открылся — фокус, закрылся — всё сбросить
  useEffect(() => {
    if (searchActive) {
      searchInputRef.current?.focus();

      return;
    }

    setSearchQuery("");
    setSearchResults([]);
  }, [searchActive]);

  // Пауза в наборе — запрос; не нашлось или ошибка — пусто
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);

      return;
    }

    const timer = setTimeout(() => {
      searchWiki(searchQuery)
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Сохранение.
  const save = (page: WikiPage) =>
    saveWikiPage(page).catch((e) => showToast("error", t("wikiPanel.toastSaveError", { error: e })));

  // Ждущую правку — в БД сейчас (одна серия изменений = одна правка в статистике)
  const flushSave = () => {
    const pending = pendingSave.current;

    if (!pending) return;

    clearTimeout(pending.timer);

    pendingSave.current = null;

    save(pending.page);

    trackUsage(METRICS.wikiEdits, 1);
  };

  const scheduleSave = (page: WikiPage) => {
    if (pendingSave.current) clearTimeout(pendingSave.current.timer);

    pendingSave.current = { page, timer: setTimeout(flushSave, SAVE_DELAY_MS) };
  };

  // Правка текущей страницы: сразу в интерфейс, в БД — после паузы
  const editPage = (patch: Partial<WikiPage>) => {
    const page = activePageRef.current;

    if (!page) return;

    const updatedAt = new Date().toISOString();

    updateWikiPage(page.id, { ...patch, updatedAt });

    scheduleSave({ ...page, ...patch, updatedAt });
  };

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: t("wikiPanel.editorPlaceholder") }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        // Штатное открытие — window.open, в Tauri не работает: открываем сами (handleDOMEvents)
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        // Только со схемой: «main.rs» и «config.py» autolink иначе принял бы за домены
        isAllowedUri: (url) => isSafeExternalUrl(url),
      }),
    ],
    editorProps: {
      handleDOMEvents: {
        // Клик по ссылке — в системный браузер. Если клик закончил выделение
        // текста внутри ссылки, не открываем: пользователь её редактирует.
        click: (view, event) => {
          const a = (event.target as HTMLElement).closest("a");
          if (!a) return false;
          event.preventDefault();
          if (view.state.selection.empty) openLink(a.getAttribute("href"));
          return true;
        },
      },
    },
    content: "",
    onUpdate: ({ editor }) => editPage({ content: JSON.stringify(editor.getJSON()) }),
  });

  // Сменилась страница — её текст в редактор (если там уже он — не трогаем)
  useEffect(() => {
    if (!editor) return;

    if (!activePage) {
      editor.commands.clearContent();

      return;
    }

    if (JSON.stringify(editor.getJSON()) === activePage.content) return;

    editor.commands.setContent(parseContent(activePage.content));

    linkifyPlainUrls(editor);
  }, [activeWikiPageId, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ушли со страницы (другая страница, контекст, закрыли панель), а правка ещё
  // ждёт паузы, — сохраняем сразу
  useEffect(() => flushSave, [activeWikiPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewPage = () => {
    const page = newPage(parentType, parentId);

    addWikiPage(page);

    save(page);

    setShowPageList(false);
  };

  // 4. Удаление.
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

  // 3. Найденная страница — в своём контексте
  const openFound = async (page: WikiPage) => {
    try {
      setWikiPages(await loadWikiPages(page.parentType, page.parentId));

      setActiveWikiPage(page.id);
      setSearchActive(false);
    } catch (e) {
      showToast("error", String(e));
    }
  };

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
              <span className="text-2xs text-text-muted truncate">{t(CONTEXT_LABEL[parentType])}</span>
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
                onClick={() => openFound(page)}
                className="flex flex-col gap-0.5 px-3 py-2 cursor-pointer hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-primary truncate flex-1">
                    {page.title || t("wikiPanel.untitled")}
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
            onChange={(e) => editPage({ title: e.target.value })}
            placeholder={t("wikiPanel.titlePlaceholder")}
            className="px-4 py-2.5 bg-transparent border-b border-border text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted shrink-0"
          />

          {/* Теги */}
          <TagsBar tags={activePage.tags} onChange={(tags) => editPage({ tags })} />

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

// ══════════════════════════════════════
// Детали
// ══════════════════════════════════════

/**
 * Превратить URL-текст в ссылки. Autolink срабатывает только при наборе, а страницы,
 * написанные до появления ссылок, хранят URL простым текстом. Транзакция не попадает
 * в историю и не вызывает onUpdate — страница сохранится с ссылками при следующей правке.
 */
function linkifyPlainUrls(editor: Editor) {
  const linkType = editor.schema.marks.link;
  const { tr, doc } = editor.state;

  doc.descendants((node, pos) => {
    // Внутрь блока кода не заходим
    if (node.type.spec.code) return false;

    // Не текст, уже ссылка или inline-код
    if (!node.isText || !node.text || node.marks.some((m) => m.type === linkType || m.type.spec.code)) return;

    for (const { start, end, url } of findLinks(node.text)) tr.addMark(pos + start, pos + end, linkType.create({ href: url }));
  });

  if (!tr.docChanged) return;

  tr.setMeta("addToHistory", false).setMeta("preventUpdate", true);

  editor.view.dispatch(tr);
}

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

/** Текст страницы: TipTap JSON; не JSON (старые страницы, Markdown) — как есть */
function parseContent(content: string): object | string {
  if (!content) return "";

  try {
    return JSON.parse(content);
  } catch {
    return content;
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

  const closeInput = () => {
    setInputValue("");
    setInputVisible(false);
  };

  // Без # в начале и без запятых; повтор не добавляем
  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "").replace(/,/g, "");

    if (tag && !tags.includes(tag)) onChange([...tags, tag]);

    closeInput();
  };

  // Enter и запятая — добавить, Escape — отменить
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return closeInput();

    if (e.key !== "Enter" && e.key !== ",") return;

    e.preventDefault();

    addTag(inputValue);
  };

  const removeTag = (tag: string) => onChange(tags.filter((x) => x !== tag));

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
          onBlur={() => (inputValue ? addTag(inputValue) : setInputVisible(false))}
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
