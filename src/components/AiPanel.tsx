import { useState, useRef, useEffect } from "react";
import { Bot, Send, Square, X, PanelRight, PanelBottom, ChevronDown, ChevronRight, Trash2, Plus, Pencil, Check } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { LinkifiedText } from "./LinkifiedText";
import { streamCompletion, getProvider, AI_PROVIDERS, type AiProvider, type ChatMessage } from "../lib/aiProviders";
import { ask } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  createAiSession,
  deleteAiSession,
  renameAiSession,
  loadAiMessages,
  saveAiMessage,
  updateAiMessage,
  clearAiSession,
  aiRun,
  aiCancel,
} from "../lib/tauriCommands";
import { trackUsage, METRICS } from "../lib/usageStats";

// ══════════════════════════════════════
// AiPanel — AI-чат рядом с терминалом
// ══════════════════════════════════════
// Отправка вопроса:
//  1. Пусто и нет выделенного в терминале — нечего отправлять. HTTP-провайдеру
//     нужен API-ключ; локальный CLI работает по подписке пользователя.
//  2. Выделенное в терминале (до 4000 символов) прикладывается с просьбой
//     объяснить; после отправки этот же текст контекстом больше не предлагается.
//  3. Сообщение пользователя и пустое сообщение ассистента сразу пишутся в БД —
//     ответ дописывается в него по мере прихода.
//  4. CLI — процесс на бэкенде, ответ приходит событиями (подписка одна на
//     панель); HTTP — поток fetch прямо отсюда.
//  5. Конец: ошибка — её текст вместо пустого ответа; остановка — остаётся
//     полученное. Финальный текст — в БД; первый ответ нового чата даёт ему
//     заголовок.
// Позиция панели меняется ремонтом компонента: состояние чата — в сторе, а
// идущий стрим — в переменных модуля, иначе ремонт оборвал бы его.

const NEW_CHAT_TITLE = "Новый чат";

/** Шаг 2: сколько выделенного уходит в вопрос и сколько показывается в панели */
const CONTEXT_SEND_LIMIT = 4000;
const CONTEXT_PREVIEW_LIMIT = 500;

// Идущий стрим — вне компонента: переживает ремонт при смене позиции панели
const stream = {
  /** HTTP-провайдер: отмена fetch */
  abort: null as AbortController | null,
  /** Сообщение ассистента в БД, которое сейчас дописывается */
  messageId: null as string | null,
  /** CLI: чат, ответ для которого сейчас идёт (фильтр событий ai://*) */
  cliSessionId: null as string | null,
  /** Чат, история которого уже в сторе — ремонт не перечитывает её из БД */
  loadedSessionId: null as string | null,
};

export function AiPanel() {
  const {
    settings,
    terminalSelection,
    aiPanelPosition,
    setAiPanelPosition,
    toggleAiPanel,
    showToast,
    saveSetting,
    aiSessions,
    addAiSession,
    removeAiSession,
    updateAiSessionTitle,
    activeAiSessionId,
    setActiveAiSessionId,
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

  const providerId = settings["ai.provider"] ?? "openai";
  const provider = getProvider(providerId);
  const apiKey = settings[`ai.apiKey.${providerId}`] ?? settings["ai.apiKey"] ?? "";
  const model = chatModel(provider, settings["ai.model"] ?? "");
  const showContext = !!terminalSelection && terminalSelection !== dismissedSelection;
  const activeSession = aiSessions.find((s) => s.id === activeAiSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Новое выделение в терминале — блок контекста раскрывается
  useEffect(() => {
    if (showContext) setContextExpanded(true);
  }, [showContext, terminalSelection]);

  // История — при смене чата. Ремонт панели (смена позиции) её не перечитывает:
  // текст идущего ответа ещё не в БД и потерялся бы.
  useEffect(() => {
    if (!activeAiSessionId || stream.loadedSessionId === activeAiSessionId) return;

    stream.loadedSessionId = activeAiSessionId;

    loadAiMessages(activeAiSessionId)
      .then((msgs) => setAiMessages(msgs.map((m) => ({ role: m.role, content: m.content }))))
      .catch((e) => showToast("error", `Не удалось загрузить историю: ${e}`));
  }, [activeAiSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // ── События локального CLI ──
  // Подписка одна на панель: слушатели фильтруют по stream.cliSessionId, поэтому
  // пересоздавать их на каждую отправку не нужно (иначе чанки задвоятся).
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    let disposed = false;

    const keep = (subscribing: Promise<() => void>) =>
      subscribing
        .then((unlisten) => (disposed ? unlisten() : unlisteners.push(unlisten)))
        .catch((e) => console.warn("ai:// subscribe", e));

    keep(
      listen<{ sessionId: string; text: string }>("ai://chunk", (e) => {
        if (e.payload.sessionId === stream.cliSessionId) appendToAssistant(e.payload.text);
      })
    );

    keep(
      listen<{ sessionId: string; content: string; ok: boolean }>("ai://done", (e) => {
        // Финальный текст берём из payload: ai://done может опередить отрисовку
        // последнего чанка. Пустой — при отмене до первого токена: оставляем накопленное.
        if (e.payload.sessionId !== stream.cliSessionId) return;

        if (e.payload.content.trim()) setLastAssistant(e.payload.content);

        finishCliAnswer();
      })
    );

    keep(
      listen<{ sessionId: string; message: string }>("ai://error", (e) => {
        if (e.payload.sessionId !== stream.cliSessionId) return;

        showErrorInsteadOfEmpty(e.payload.message.slice(0, 500));

        finishCliAnswer();
      })
    );

    return () => {
      disposed = true;

      unlisteners.forEach((u) => u());
    };
  }, []);

  // ── Чаты ──
  const handleNewSession = async () => {
    try {
      const session = await createAiSession(NEW_CHAT_TITLE, providerId, model);

      addAiSession(session);
      setActiveAiSessionId(session.id);
      setAiMessages([]);
      setShowSessionList(false);
    } catch {
      showToast("error", "Не удалось создать сессию");
    }
  };

  // Сообщения загрузит эффект смены чата
  const handleSwitchSession = (id: string) => {
    setShowSessionList(false);

    if (id !== activeAiSessionId) setActiveAiSessionId(id);
  };

  // Последний чат не удаляется — только очищается
  const handleDeleteSession = async (id: string) => {
    const session = aiSessions.find((s) => s.id === id);

    const confirmed = await ask(`Удалить чат «${session?.title ?? "чат"}»? Это действие нельзя отменить.`, {
      title: "Удалить чат",
      kind: "warning",
    });

    if (!confirmed) return;

    try {
      if (aiSessions.length <= 1) {
        await clearAiSession(id);

        setAiMessages([]);

        return;
      }

      await deleteAiSession(id);

      removeAiSession(id);

      if (id === activeAiSessionId) setAiMessages([]);
    } catch {
      showToast("error", "Не удалось удалить сессию");
    }
  };

  const handleFinishRename = async () => {
    const id = renamingId;
    const title = renameValue.trim();

    setRenamingId(null);

    if (!id || !title) return;

    try {
      await renameAiSession(id, title);

      updateAiSessionTitle(id, title);
    } catch (e) {
      showToast("error", `Не удалось переименовать: ${e}`);
    }
  };

  const handleClearChat = async () => {
    if (!activeAiSessionId) return;

    const confirmed = await ask("Очистить историю этого чата? Это действие нельзя отменить.", { title: "Очистить чат", kind: "warning" });

    if (!confirmed) return;

    try {
      await clearAiSession(activeAiSessionId);

      setAiMessages([]);
    } catch (e) {
      showToast("error", `Не удалось очистить чат: ${e}`);
    }
  };

  // ── Отправка ──
  const handleSend = async () => {
    const sessionId = activeAiSessionId;
    const text = aiInput.trim();

    // 1. Есть что отправлять и чем.
    if ((!text && !showContext) || !sessionId) return;

    if (!provider.isLocalCli && !apiKey) {
      showToast("error", "Укажите API-ключ в Настройках → Агенты");

      return;
    }

    // 2. Вопрос с контекстом из терминала.
    const content = showContext ? withTerminalContext(text, terminalSelection) : text;

    const history: ChatMessage[] = [...aiMessages, { role: "user", content }];

    setAiMessages(history);
    setAiInput("");
    setDismissedSelection(terminalSelection);

    trackUsage(METRICS.aiMessages, 1);

    // 3. Вопрос и пустой ответ — в БД.
    stream.messageId = crypto.randomUUID();

    await saveOrWarn(crypto.randomUUID(), sessionId, "user", content);
    await saveOrWarn(stream.messageId, sessionId, "assistant", "");

    setAiMessages((m) => [...m, { role: "assistant", content: "" }]);
    setAiIsStreaming(true);

    // 4–5. CLI: дальше — обработчики ai://chunk|done|error.
    if (provider.isLocalCli) {
      stream.cliSessionId = sessionId;

      aiRun(sessionId, model, settings["ai.systemPrompt"] ?? "", cliPrompt(history)).catch((e) => {
        showErrorInsteadOfEmpty(String(e));

        finishCliAnswer();
      });

      return;
    }

    // 4–5. HTTP.
    stream.abort = new AbortController();

    try {
      await streamCompletion({ provider, messages: history, model, apiKey, onChunk: appendToAssistant, signal: stream.abort.signal });
    } catch (e) {
      // Остановка пользователем — не ошибка: остаётся полученное
      if ((e as Error).name !== "AbortError") showErrorInsteadOfEmpty((e as Error).message);
    } finally {
      stream.abort = null;

      await finalizeAssistantMessage(sessionId);
    }
  };

  const handleStop = () => {
    if (stream.cliSessionId) aiCancel(stream.cliSessionId).catch((e) => console.warn("ai cancel", e));
    else stream.abort?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey) return;

    e.preventDefault();

    handleSend();
  };

  const positionButton = (pos: "right" | "bottom", title: string, Icon: typeof PanelRight) => (
    <button
      onClick={() => setAiPanelPosition(pos)}
      className={`p-1 rounded transition-colors ${
        aiPanelPosition === pos ? "text-accent bg-accent/10" : "text-text-muted hover:text-text-secondary"
      }`}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="h-9 flex items-center gap-1.5 px-3 bg-surface-1 border-b border-border shrink-0">
        <Bot className="w-3.5 h-3.5 text-accent shrink-0" />

        <button
          className="flex-1 flex items-center gap-1 text-xs font-semibold text-text-primary hover:text-accent truncate min-w-0"
          onClick={() => setShowSessionList((v) => !v)}
          title="Сессии чата"
        >
          <span className="truncate">{activeSession?.title ?? "AI Ассистент"}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
        </button>

        <button onClick={handleNewSession} className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors" title="Новая сессия">
          <Plus className="w-3.5 h-3.5" />
        </button>

        {positionButton("right", "Справа от терминала", PanelRight)}
        {positionButton("bottom", "Снизу под терминалом", PanelBottom)}

        {aiMessages.length > 0 && (
          <button onClick={handleClearChat} className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors" title="Очистить чат">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button onClick={toggleAiPanel} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors" title="Закрыть (Cmd+I)">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Список чатов */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(s.id);
                  setRenameValue(s.title);
                }}
                title="Переименовать"
              >
                {renamingId === s.id ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
              </button>
              <button
                className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(s.id);
                }}
                title="Удалить"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {aiMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <Bot className="w-8 h-8 mb-2 opacity-30" />
            <div className="text-xs text-center px-4">
              {apiKey ? "Задайте вопрос или выделите текст в терминале" : "Настройте AI-провайдера в Настройках → Агенты"}
            </div>
          </div>
        )}

        {aiMessages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user" ? "bg-accent/20 text-text-primary" : "bg-surface-2 text-text-primary"
              }`}
            >
              {msg.content ? <LinkifiedText text={msg.content} /> : <span className="text-text-muted animate-pulse">●●●</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Контекст — выделенное в терминале */}
      {showContext && (
        <div className="border-t border-border shrink-0">
          <button
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-2xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
            onClick={() => setContextExpanded((v) => !v)}
          >
            {contextExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
            <span className="flex-1 text-left truncate">Контекст из терминала</span>
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
                {terminalSelection.slice(0, CONTEXT_PREVIEW_LIMIT)}
                {terminalSelection.length > CONTEXT_PREVIEW_LIMIT && (
                  <span className="text-text-muted"> …ещё {terminalSelection.length - CONTEXT_PREVIEW_LIMIT} символов</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Выбор провайдера — пока он не задан */}
      {!settings["ai.provider"] && (
        <div className="border-t border-border px-3 py-2 shrink-0">
          <div className="flex gap-1">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => saveSetting("ai.provider", p.id)}
                className="flex-1 py-1 text-2xs rounded border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ввод */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={showContext ? "Вопрос (или отправить с контекстом)..." : "Введите вопрос... (Enter)"}
            rows={2}
            className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
            disabled={aiIsStreaming}
          />
          {aiIsStreaming ? (
            <button onClick={handleStop} className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors shrink-0" title="Остановить">
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

// ══════════════════════════════════════
// Детали
// ══════════════════════════════════════

/**
 * ai.model один на все провайдеры и не сбрасывается при их переключении.
 * Для CLI чужой алиас (напр. "gpt-4o") — жёсткая ошибка запуска, поэтому
 * откатываемся на модель по умолчанию. У HTTP-провайдеров имя модели может
 * быть произвольным (кастомные деплойменты), его не трогаем.
 */
function chatModel(provider: AiProvider, saved: string): string {
  if (provider.isLocalCli && !provider.models.includes(saved)) return provider.defaultModel;

  return saved || provider.defaultModel;
}

/** Шаг 2 */
function withTerminalContext(question: string, selection: string): string {
  const prefix = question ? `${question}\n\n` : "";

  return `${prefix}Объясни это:\n\`\`\`\n${selection.slice(0, CONTEXT_SEND_LIMIT)}\n\`\`\``;
}

/**
 * Локальный CLI получает один промпт, а не массив сообщений, — историю
 * приходится укладывать в текст. Одиночный вопрос отправляем как есть.
 */
function cliPrompt(history: ChatMessage[]): string {
  if (history.length <= 1) return history[history.length - 1]?.content ?? "";

  const transcript = history
    .map((m) => (m.role === "user" ? `## Пользователь\n${m.content}` : `## Ассистент\n${m.content}`))
    .join("\n\n");

  return `Ниже — история диалога. Ответь на последнее сообщение пользователя.\n\n${transcript}`;
}

/** Шаг 3. Не сохранилось — чат работает дальше, но в истории после перезапуска сообщения не будет. */
async function saveOrWarn(id: string, sessionId: string, role: "user" | "assistant", content: string) {
  await saveAiMessage(id, sessionId, role, content).catch((e) => console.warn("save ai message", e));
}

/** Дописать текст к последнему сообщению ассистента */
function appendToAssistant(chunk: string) {
  updateLastAssistant((last) => ({ ...last, content: last.content + chunk }));
}

function setLastAssistant(content: string) {
  updateLastAssistant((last) => ({ ...last, content }));
}

/** Шаг 5: текст ошибки — только вместо пустого ответа; начатый ответ не затираем */
function showErrorInsteadOfEmpty(message: string) {
  updateLastAssistant((last) => (last.content === "" ? { role: "assistant", content: `Ошибка: ${message}` } : last));
}

function updateLastAssistant(update: (last: ChatMessage) => ChatMessage) {
  useAppStore.getState().setAiMessages((m) => {
    const last = m[m.length - 1];

    if (last?.role !== "assistant") return m;

    return [...m.slice(0, -1), update(last)];
  });
}

function finishCliAnswer() {
  const sessionId = stream.cliSessionId;

  stream.cliSessionId = null;

  if (sessionId) finalizeAssistantMessage(sessionId);
}

/**
 * Шаг 5: финальный текст ответа — в БД, снять флаг стриминга. Первый ответ
 * нового чата даёт ему заголовок (40 символов ответа).
 */
async function finalizeAssistantMessage(sessionId: string) {
  const state = useAppStore.getState();

  const messages = state.aiMessages;
  const answer = messages[messages.length - 1];
  const messageId = stream.messageId;

  stream.messageId = null;

  state.setAiIsStreaming(false);

  if (answer?.role !== "assistant" || !messageId) return;

  await updateAiMessage(messageId, answer.content).catch((e) => console.warn("update ai message", e));

  const session = state.aiSessions.find((s) => s.id === sessionId);

  if (messages.length !== 2 || session?.title !== NEW_CHAT_TITLE) return;

  const title = answer.content.trim().slice(0, 40).replace(/\n/g, " ") || "Чат";

  await renameAiSession(sessionId, title).catch((e) => console.warn("rename ai session", e));

  state.updateAiSessionTitle(sessionId, title);
}
