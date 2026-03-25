import { useState } from "react";
import { useAppStore } from "../stores/appStore";

// ══════════════════════════════════════
// WikiPanel — база знаний
//
// Здесь будет TipTap редактор:
// npm install @tiptap/react @tiptap/starter-kit
//   @tiptap/extension-code-block-lowlight
//   @tiptap/extension-placeholder
//   @tiptap/extension-task-list
//   @tiptap/extension-task-item
//
// Пока — простой textarea-редактор как placeholder
// ══════════════════════════════════════

export function WikiPanel() {
  const { selectedNode } = useAppStore();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "pages">("edit");

  // Демо-данные wiki
  const [pages] = useState([
    {
      id: "wp-1",
      title: "Deploy процесс",
      tags: ["#deploy", "#prod"],
      updated: "2 часа назад",
    },
    {
      id: "wp-2",
      title: "Переменные окружения",
      tags: ["#config", "#env"],
      updated: "вчера",
    },
    {
      id: "wp-3",
      title: "Доступы к серверам",
      tags: ["#credentials", "#ssh"],
      updated: "3 дня назад",
    },
    {
      id: "wp-4",
      title: "Docker compose заметки",
      tags: ["#docker"],
      updated: "неделю назад",
    },
  ]);

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col bg-surface-1">
        <div className="h-9 flex items-center px-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Wiki
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <div className="text-3xl mb-3">📖</div>
            <div className="text-xs">Выберите элемент в дереве</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Wiki
        </span>
        <div className="flex gap-1">
          <button
            className={`px-2 py-0.5 rounded text-2xs ${
              activeTab === "edit"
                ? "bg-accent-subtle text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => setActiveTab("edit")}
          >
            Edit
          </button>
          <button
            className={`px-2 py-0.5 rounded text-2xs ${
              activeTab === "pages"
                ? "bg-accent-subtle text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => setActiveTab("pages")}
          >
            Pages
          </button>
        </div>
      </div>

      {activeTab === "pages" ? (
        /* ── Список страниц ── */
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <button className="w-full text-left px-3 py-2 rounded-md text-xs text-accent hover:bg-surface-2 border border-dashed border-border">
              + Новая страница
            </button>
          </div>
          {pages.map((page) => (
            <div
              key={page.id}
              className="px-3 py-2 mx-2 rounded-md cursor-pointer hover:bg-surface-2 border-b border-border/50 last:border-0"
              onClick={() => {
                setTitle(page.title);
                setActiveTab("edit");
              }}
            >
              <div className="text-xs font-medium text-text-primary truncate">
                {page.title}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xs text-text-muted">{page.updated}</span>
                <div className="flex gap-1">
                  {page.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Редактор ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок страницы..."
            className="px-4 py-2 bg-transparent border-b border-border text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
          />

          {/* Tags bar */}
          <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-1">
            <span className="text-2xs text-text-muted">Tags:</span>
            <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary cursor-pointer hover:bg-accent-subtle hover:text-accent">
              + добавить
            </span>
          </div>

          {/* Content editor — placeholder для TipTap */}
          {/* TODO: Заменить на:
            import { useEditor, EditorContent } from '@tiptap/react';
            import StarterKit from '@tiptap/starter-kit';
            
            const editor = useEditor({
              extensions: [
                StarterKit,
                CodeBlockLowlight.configure({ lowlight }),
                Placeholder.configure({ placeholder: 'Начните писать...' }),
                TaskList,
                TaskItem,
              ],
              content: '',
            });
            
            <EditorContent editor={editor} className="wiki-editor" />
          */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Начните писать...\n\nПоддерживается Markdown:\n# Заголовок\n- Список\n\`\`\`\nБлок кода\n\`\`\`\n\nПосле подключения TipTap здесь будет\nполноценный WYSIWYG редактор.`}
            className="flex-1 p-4 bg-transparent text-sm text-text-primary outline-none resize-none font-mono leading-relaxed placeholder:text-text-muted/50"
          />

          {/* Bottom toolbar */}
          <div className="h-8 flex items-center justify-between px-3 border-t border-border shrink-0">
            <span className="text-2xs text-text-muted">
              {selectedNode.type}: {selectedNode.id}
            </span>
            <button className="text-2xs px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
