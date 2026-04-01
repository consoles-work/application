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
  Plus,
  Pencil,
  Check,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import {
  streamCompletion,
  getProvider,
  AI_PROVIDERS,
  type ChatMessage,
} from "../lib/aiProviders";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  setSetting,
  createAiSession,
  deleteAiSession,
  renameAiSession,
  loadAiMessages,
  saveAiMessage,
  updateAiMessage,
  clearAiSession,
} from "../lib/tauriCommands";
import type { AiMessage } from "../types";

// Вне компонента — переживает ремонт при смене позиции панели
let _abortController: AbortController | null = null;
// ID сообщения ассистента, которое сейчас стримится (для финализации в БД)
let _streamingMsgId: string | null = null;
// ID последней загруженной сессии — предотвращает перезагрузку из БД при ремонте компонента
let _loadedSessionId: string | null = null;

function uuid() {
  return crypto.randomUUID();
}

export function AiPanel() {
  const {
    settings,
    terminalSelection,
    aiPanelPosition,
    setAiPanelPosition,
    toggleAiPanel,
    showToast,
    setSetting: storeSetting,
    // Сессии
    aiSessions,
    addAiSession,
    removeAiSession,
    updateAiSessionTitle,
    activeAiSessionId,
    setActiveAiSessionId,
    // Состояние чата — в store, не теряется при смене позиции
    aiMessages,
    setAiMessages,
    aiInput,
    setAiInput,
    aiIsStreaming,
    setAiIsStreaming,
  } = useAppStore();

  const [contextExpanded, setContextExpanded] = useState(true);
  const [dismissedSelection, setDismissedSelection] = useState("");
  const [showSessionList, setShowSessionList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  // Загружаем историю при смене сессии.
  // Если сессия не изменилась (компонент просто ремонтировался при смене позиции) — НЕ перезагружаем,
  // чтобы не потерять текст стриминга, который ещё не сохранён в БД.
  useEffect(() => {
    if (!activeAiSessionId) return;
    if (_loadedSessionId === activeAiSessionId) return;
    _loadedSessionId = activeAiSessionId;
    loadAiMessages(activeAiSessionId).then((msgs: AiMessage[]) => {
      setAiMessages(msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }).catch(() => {});
  }, [activeAiSessionId]);

  // Фокус на поле переименования
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const provider = getProvider(settings["ai.provider"] ?? "openai");
  const apiKey = settings[`ai.apiKey.${settings["ai.provider"] ?? "openai"}`] ?? settings["ai.apiKey"] ?? "";
  const model = settings["ai.model"] ?? provider.defaultModel;
  const showContext = terminalSelection && terminalSelection !== dismissedSelection;
  const activeSession = aiSessions.find((s) => s.id === activeAiSessionId);

  const handleNewSession = useCallback(async () => {
    try {
      const session = await createAiSession("Новый чат", settings["ai.provider"] ?? "openai", model);
      addAiSession(session);
      setActiveAiSessionId(session.id);
      setAiMessages([]);
      setShowSessionList(false);
    } catch {
      showToast("error", "Не удалось создать сессию");
    }
  }, [settings, model, addAiSession, setActiveAiSessionId, setAiMessages, showToast]);

  const handleSwitchSession = useCallback(async (id: string) => {
    if (id === activeAiSessionId) { setShowSessionList(false); return; }
    setActiveAiSessionId(id);
    setShowSessionList(false);
    // Сообщения загрузятся через useEffect
  }, [activeAiSessionId, setActiveAiSessionId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    const session = aiSessions.find((s) => s.id === id);
    const confirmed = await ask(
      `Удалить чат «${session?.title ?? "чат"}»? Это действие нельзя отменить.`,
      { title: "Удалить чат", kind: "warning" }
    );
    if (!confirmed) return;

    if (aiSessions.length <= 1) {
      // Нельзя удалить последнюю — очищаем
      await clearAiSession(id).catch(() => {});
      setAiMessages([]);
      return;
    }
    try {
      await deleteAiSession(id);
      removeAiSession(id);
      if (id === activeAiSessionId) setAiMessages([]);
    } catch {
      showToast("error", "Не удалось удалить сессию");
    }
  }, [aiSessions, activeAiSessionId, removeAiSession, setAiMessages, showToast]);

  const handleStartRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const handleFinishRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    try {
      await renameAiSession(renamingId, renameValue.trim());
      updateAiSessionTitle(renamingId, renameValue.trim());
    } catch {}
    setRenamingId(null);
  };

  const handleClearChat = useCallback(async () => {
    if (!activeAiSessionId) return;
    const confirmed = await ask(
      "Очистить историю этого чата? Это действие нельзя отменить.",
      { title: "Очистить чат", kind: "warning" }
    );
    if (!confirmed) return;
    await clearAiSession(activeAiSessionId).catch(() => {});
    setAiMessages([]);
  }, [activeAiSessionId, setAiMessages]);

  const handleSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text && !showContext) return;
    if (!apiKey) {
      showToast("error", "Укажите API-ключ в Настройках → Агенты");
      return;
    }
    if (!activeAiSessionId) return;

    let userContent = text;
    if (showContext && terminalSelection) {
      const prefix = text ? `${text}\n\n` : "";
      userContent = `${prefix}Объясни это:\n\`\`\`\n${terminalSelection.slice(0, 4000)}\n\`\`\``;
    }

    // Сохраняем сообщение пользователя в БД
    const userMsgId = uuid();
    await saveAiMessage(userMsgId, activeAiSessionId, "user", userContent).catch(() => {});

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput("");
    setDismissedSelection(terminalSelection);

    // Резервируем ID для сообщения ассистента
    const assistantMsgId = uuid();
    _streamingMsgId = assistantMsgId;
    // Сохраняем пустое сообщение ассистента сразу
    await saveAiMessage(assistantMsgId, activeAiSessionId, "assistant", "").catch(() => {});

    // Добавляем пустое сообщение ассистента в UI
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
      // Финализируем сообщение в БД
      const finalMessages = useAppStore.getState().aiMessages;
      const finalAssistant = finalMessages[finalMessages.length - 1];
      if (finalAssistant?.role === "assistant" && _streamingMsgId) {
        await updateAiMessage(_streamingMsgId, finalAssistant.content).catch(() => {});
        // Автозаголовок если это первый ответ
        if (finalMessages.length === 2 && activeSession?.title === "Новый чат") {
          const title = finalAssistant.content.trim().slice(0, 40).replace(/\n/g, " ") || "Чат";
          await renameAiSession(activeAiSessionId, title).catch(() => {});
          updateAiSessionTitle(activeAiSessionId, title);
        }
      }
      _streamingMsgId = null;
      setAiIsStreaming(false);
      _abortController = null;
    }
  }, [aiInput, aiMessages, showContext, terminalSelection, apiKey, provider, model, activeAiSessionId, activeSession, setAiMessages, setAiInput, setAiIsStreaming, showToast, updateAiSessionTitle]);

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

        {/* Session selector */}
        <button
          className="flex-1 flex items-center gap-1 text-xs font-semibold text-text-primary hover:text-accent truncate min-w-0"
          onClick={() => setShowSessionList((v) => !v)}
          title="Сессии чата"
        >
          <span className="truncate">{activeSession?.title ?? "AI Ассистент"}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
        </button>

        {/* Новая сессия */}
        <button
          onClick={handleNewSession}
          className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
          title="Новая сессия"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

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
            onClick={handleClearChat}
            className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
            title="Очистить чат"
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

      {/* Session dropdown */}
      {showSessionList && (
        <div className="border-b border-border bg-surface-1 shrink-0 max-h-48 overflow-y-auto">
          {aiSessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1 px-3 py-1.5 group cursor-pointer hover:bg-surface-2 ${
                s.id === activeAiSessionId ? "bg-accent/10" : ""
              }`}
              onClick={() => handleSwitchSession(s.id)}
            >
              {renamingId === s.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishRename();
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onBlur={handleFinishRename}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-surface-0 border border-accent rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-xs truncate text-text-primary">{s.title}</span>
              )}
              <button
                className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-secondary transition-all"
                onClick={(e) => { e.stopPropagation(); handleStartRename(s.id, s.title); }}
                title="Переименовать"
              >
                {renamingId === s.id ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
              </button>
              <button
                className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                title="Удалить"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
