import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Terminal,
  Undo,
  Redo,
  Minus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

// Тулбар редактора wiki: заголовки, начертание, списки, блок кода, отмена/повтор.
// Подсветка кнопок — через useEditorState: TipTap 3 не перерисовывает
// компонент на каждую транзакцию, перерисовывается только тулбар.

interface WikiToolbarProps {
  editor: Editor;
}

export function WikiToolbar({ editor }: WikiToolbarProps) {
  const { t } = useTranslation();

  const active = useEditorState({ editor, selector: ({ editor }) => activeMarks(editor) });

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-surface-1 flex-wrap shrink-0">
      <ToolbarButton
        title={t("wikiToolbar.h1")}
        isActive={active.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.h2")}
        isActive={active.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.h3")}
        isActive={active.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={13} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title={t("wikiToolbar.bold")}
        isActive={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.italic")}
        isActive={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.inlineCode")}
        isActive={active.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={13} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title={t("wikiToolbar.bulletList")}
        isActive={active.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.orderedList")}
        isActive={active.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.taskList")}
        isActive={active.taskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare size={13} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title={t("wikiToolbar.codeBlock")}
        isActive={active.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Terminal size={13} />
      </ToolbarButton>

      <ToolbarButton
        title={t("wikiToolbar.horizontalRule")}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={13} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title={t("wikiToolbar.undo")}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo size={13} />
      </ToolbarButton>
      <ToolbarButton
        title={t("wikiToolbar.redo")}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo size={13} />
      </ToolbarButton>
    </div>
  );
}

/** Какие кнопки тулбара подсвечены при текущем выделении */
function activeMarks(editor: Editor) {
  return {
    h1: editor.isActive("heading", { level: 1 }),
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    code: editor.isActive("code"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    codeBlock: editor.isActive("codeBlock"),
  };
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-6 h-6 rounded text-xs transition-colors ${
        isActive
          ? "bg-accent/30 text-accent"
          : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}
