import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Square,
  X,
  PanelRight,
  PanelBottom,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import {
  streamCompletion,
  getProvider,
  AI_PROVIDERS,
  type ChatMessage,
} from "../lib/aiProviders";
import { setSetting } from "../lib/tauriCommands";

// Вне компонента — переживает ремонт при смене позиции панели
let _abortController: AbortController | null = null;

export function AiPanel() {
  const {
    settings,
    terminalSelection,
    aiPanelPosition,
    setAiPanelPosition,
    toggleAiPanel,
    showToast,
    setSetting: storeSetting,
    // Состояние чата — в store, не теряется при смене позиции
    aiMessages,
    setAiMessages,
    aiInput,
    setAiInput,
    aiIsStreaming,
    setAiIsStreaming,
  } = useAppStore();

  // Локальное состояние — ОК сбрасывать при смене позиции
  const [contextExpanded, setContextExpanded] = useState(true);
  const [dismissedSelection, setDismissedSelection] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Show context block when selection changes
  useEffect(() => {
    if (terminalSelection && terminalSelection !== dismissedSelection) {
      setContextExpanded(true);
    }
  }, [terminalSelection, dismissedSelection]);

  const provider = getProvider(settings["ai.provider"] ?? "openai");
  const apiKey = settings["ai.apiKey"] ?? "";
  const model = settings["ai.model"] ?? provider.defaultModel;
  const showContext =
    terminalSelection && terminalSelection !== dismissedSelection;

  const handleSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text && !showContext) return;
    if (!apiKey) {
      showToast("error", "Укажите API-ключ в Настройках → Агенты");
      return;
    }

    let userContent = text;
    if (showContext && terminalSelection) {
      const prefix = text ? `${text}\n\n` : "";
      userContent = `${prefix}Объясни это:\n\`\`\`\n${terminalSelection.slice(0, 4000)}\n\`\`\``;
    }

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput("");
    setDismissedSelection(terminalSelection);

    // Добавляем пустое сообщение ассистента — будем заполнять чанками
    setAiMessages((m) => [...m, { role: "assistant", content: "" }]);
    setAiIsStreaming(true);

    const controller = new AbortController();
    _abortController = controller;

    try {
      await streamCompletion(
        provider,
        newHistory,
        model,
        apiKey,
        (chunk) => {
          setAiMessages((m) => {
            const last = m[m.length - 1];
            if (last?.role === "assistant") {
              return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
            }
            return m;
          });
        },
        controller.signal
      );
    } catch (e: unknown) {
      const err = e as Error;
      if (err.name !== "AbortError") {
        setAiMessages((m) => {
          const last = m[m.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            return [...m.slice(0, -1), { role: "assistant", content: `Ошибка: ${err.message}` }];
          }
          return m;
        });
      }
    } finally {
      setAiIsStreaming(false);
      _abortController = null;
    }
  }, [aiInput, aiMessages, showContext, terminalSelection, apiKey, provider, model, setAiMessages, setAiInput, setAiIsStreaming, showToast]);

  const handleStop = () => {
    _abortController?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePositionChange = async (pos: "right" | "bottom") => {
    setAiPanelPosition(pos);
    try {
      await setSetting("ui.aiPanelPosition", pos);
      storeSetting("ui.aiPanelPosition", pos);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="h-9 flex items-center gap-1.5 px-3 bg-surface-1 border-b border-border shrink-0">
        <Bot className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-xs font-semibold text-text-primary flex-1">
          AI Ассистент
        </span>

        {/* Позиция */}
        <button
          onClick={() => handlePositionChange("right")}
          className={`p-1 rounded transition-colors ${
            aiPanelPosition === "right"
              ? "text-accent bg-accent/10"
              : "text-text-muted hover:text-text-secondary"
          }`}
          title="Справа от терминала"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handlePositionChange("bottom")}
          className={`p-1 rounded transition-colors ${
            aiPanelPosition === "bottom"
              ? "text-accent bg-accent/10"
              : "text-text-muted hover:text-text-secondary"
          }`}
          title="Снизу под терминалом"
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>

        {/* Очистить историю */}
        {aiMessages.length > 0 && (
          <button
            onClick={() => setAiMessages([])}
            className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
            title="Очистить историю"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Закрыть */}
        <button
          onClick={toggleAiPanel}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          title="Закрыть (Cmd+I)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {aiMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <Bot className="w-8 h-8 mb-2 opacity-30" />
            <div className="text-xs text-center px-4">
              {!apiKey
                ? "Настройте AI-провайдера в Настройках → Агенты"
                : "Задайте вопрос или выделите текст в терминале"}
            </div>
          </div>
        )}

        {aiMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-accent/20 text-text-primary"
                  : "bg-surface-2 text-text-primary"
              }`}
            >
              {msg.content || (
                <span className="text-text-muted animate-pulse">●●●</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Context block — selection from terminal */}
      {showContext && (
        <div className="border-t border-border shrink-0">
          <button
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-2xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
            onClick={() => setContextExpanded((v) => !v)}
          >
            {contextExpanded ? (
              <ChevronDown className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0" />
            )}
            <span className="flex-1 text-left truncate">
              Контекст из терминала
            </span>
            <span
              className="px-1.5 py-0.5 rounded bg-surface-3 hover:bg-danger/20 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedSelection(terminalSelection);
              }}
              title="Убрать контекст"
            >
              ✕
            </span>
          </button>
          {contextExpanded && (
            <div className="px-3 pb-2">
              <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-2xs font-mono text-text-secondary max-h-20 overflow-y-auto whitespace-pre-wrap break-all">
                {terminalSelection.slice(0, 500)}
                {terminalSelection.length > 500 && (
                  <span className="text-text-muted">
                    {" "}
                    …ещё {terminalSelection.length - 500} символов
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provider selector (compact, shown only when no provider configured) */}
      {!settings["ai.provider"] && (
        <div className="border-t border-border px-3 py-2 shrink-0">
          <div className="flex gap-1">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={async () => {
                  await setSetting("ai.provider", p.id).catch(() => {});
                  storeSetting("ai.provider", p.id);
                }}
                className="flex-1 py-1 text-2xs rounded border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              showContext ? "Вопрос (или отправить с контекстом)..." : "Введите вопрос... (Enter)"
            }
            rows={2}
            className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            disabled={aiIsStreaming}
          />
          {aiIsStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors shrink-0"
              title="Остановить"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!aiInput.trim() && !showContext}
              className="p-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Отправить (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
