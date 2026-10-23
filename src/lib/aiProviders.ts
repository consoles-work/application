// ══════════════════════════════════════════════
// AI провайдеры: OpenAI, Anthropic, Ollama, Claude CLI
// ══════════════════════════════════════════════
// HTTP-провайдеры (OpenAI, Anthropic, Ollama) стримят ответ прямо из фронта:
//  1. Запрос в формате провайдера (ключ — в заголовке).
//  2. Не 2xx — ошибка с кодом и телом ответа.
//  3. Тело читается по строкам SSE; из каждой строки провайдер достаёт кусок
//     текста, кусок сразу уходит в onChunk. Отмена — через AbortSignal.
// Claude CLI — подпроцесс на Rust-стороне (ai_local.rs), сюда не попадает.

export type ProviderId = "openai" | "anthropic" | "ollama" | "claude-cli";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiProvider {
  id: ProviderId;
  name: string;
  models: string[];
  defaultModel: string;
  /**
   * true — провайдер работает не через HTTP, а подпроцессом на Rust-стороне.
   * У такого нет buildFetchParams/parseChunk: streamCompletion его не касается,
   * AiPanel вызывает aiRun и слушает события ai://chunk|done|error.
   * API-ключ ему тоже не нужен — используется подписка пользователя.
   */
  isLocalCli?: boolean;
  buildFetchParams?(
    messages: ChatMessage[],
    model: string,
    apiKey: string
  ): [string, RequestInit];
  parseChunk?(line: string): string | null;
}

export const OpenAiProvider: AiProvider = {
  id: "openai",
  name: "OpenAI",
  models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  defaultModel: "gpt-4o",

  buildFetchParams(messages, model, apiKey) {
    return [
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
      },
    ];
  },

  parseChunk: parseOpenAiChunk,
};

export const AnthropicProvider: AiProvider = {
  id: "anthropic",
  name: "Anthropic",
  models: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  defaultModel: "claude-sonnet-4-6",

  buildFetchParams(messages, model, apiKey) {
    const systemParts = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return [
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          ...(systemParts ? { system: systemParts } : {}),
          messages: chatMessages,
          stream: true,
        }),
      },
    ];
  },

  parseChunk(line) {
    const json = sseJson(line);

    const isText = json?.type === "content_block_delta" && json.delta?.type === "text_delta";

    return isText ? json.delta.text ?? null : null;
  },
};

export const OllamaProvider: AiProvider = {
  id: "ollama",
  name: "Ollama",
  models: [], // динамический список, получается fetch-ом из localhost:11434/api/tags
  defaultModel: "",

  buildFetchParams(messages, model, _apiKey) {
    return [
      "http://localhost:11434/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      },
    ];
  },

  // Формат ответа совместим с OpenAI
  parseChunk: parseOpenAiChunk,
};

/**
 * Claude Code CLI — локальный движок. Бинарь `claude` запускается подпроцессом
 * из Rust (src-tauri/src/ai_local.rs) и работает по подписке пользователя,
 * API-ключ не нужен. Ollama выше — тоже «локальный», но это обычный HTTP
 * к localhost:11434, то есть тот же путь, что у OpenAI/Anthropic.
 */
export const ClaudeCliProvider: AiProvider = {
  id: "claude-cli",
  name: "Claude Code CLI",
  models: ["sonnet", "opus", "haiku"],
  defaultModel: "sonnet",
  isLocalCli: true,
};

export const AI_PROVIDERS: AiProvider[] = [
  OpenAiProvider,
  AnthropicProvider,
  OllamaProvider,
  ClaudeCliProvider,
];

export function getProvider(id: string): AiProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? OpenAiProvider;
}

export interface StreamRequest {
  provider: AiProvider;
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

/** Ответ HTTP-провайдера по кускам; завершается, когда поток закончился (или отменён — AbortError) */
export async function streamCompletion({ provider, messages, model, apiKey, onChunk, signal }: StreamRequest): Promise<void> {
  const { buildFetchParams, parseChunk } = provider;

  if (!buildFetchParams || !parseChunk) throw new Error(`Провайдер ${provider.name} не работает через HTTP`);

  // 1. Запрос.
  const [url, init] = buildFetchParams(messages, model, apiKey);

  const response = await fetch(url, { ...init, signal });

  // 2. Ошибка провайдера.
  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);

  const reader = response.body?.getReader();

  if (!reader) throw new Error("No response body");

  // 3. Строки SSE → куски текста.
  await readLines(reader, (line) => {
    const text = parseChunk(line);

    if (text) onChunk(text);
  });
}

// ── Детали ──

/** Шаг 3: непустые строки потока; хвост без перевода строки ждёт следующего чтения */
async function readLines(reader: ReadableStreamDefaultReader<Uint8Array>, onLine: (line: string) => void) {
  const decoder = new TextDecoder();

  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) return;

    const lines = (buffer + decoder.decode(value, { stream: true })).split("\n");

    buffer = lines.pop() ?? "";

    lines.map((l) => l.trim()).filter(Boolean).forEach(onLine);
  }
}

/** Строка SSE `data: {...}` → JSON; другие строки, `[DONE]` и битый JSON — null.
 *  any: формат куска свой у каждого провайдера, поля читаются через `?.` */
function sseJson(line: string): any {
  if (!line.startsWith("data: ")) return null;

  const data = line.slice(6);

  if (data === "[DONE]") return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** OpenAI и совместимые (Ollama): кусок — choices[0].delta.content */
function parseOpenAiChunk(line: string): string | null {
  return sseJson(line)?.choices?.[0]?.delta?.content ?? null;
}
