// ══════════════════════════════════════════════
// AI провайдеры: OpenAI, Anthropic
// ══════════════════════════════════════════════

export type ProviderId = "openai" | "anthropic";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiProvider {
  id: ProviderId;
  name: string;
  models: string[];
  defaultModel: string;
  buildFetchParams(
    messages: ChatMessage[],
    model: string,
    apiKey: string
  ): [string, RequestInit];
  parseChunk(line: string): string | null;
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

  parseChunk(line) {
    if (!line.startsWith("data: ")) return null;
    const data = line.slice(6);
    if (data === "[DONE]") return null;
    try {
      const json = JSON.parse(data);
      return json.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  },
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
    if (!line.startsWith("data: ")) return null;
    const data = line.slice(6);
    try {
      const json = JSON.parse(data);
      if (
        json.type === "content_block_delta" &&
        json.delta?.type === "text_delta"
      ) {
        return json.delta.text ?? null;
      }
      return null;
    } catch {
      return null;
    }
  },
};

export const AI_PROVIDERS: AiProvider[] = [OpenAiProvider, AnthropicProvider];

export function getProvider(id: string): AiProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? OpenAiProvider;
}

export async function streamCompletion(
  provider: AiProvider,
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const [url, init] = provider.buildFetchParams(messages, model, apiKey);
  const response = await fetch(url, { ...init, signal });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const text = provider.parseChunk(trimmed);
      if (text) onChunk(text);
    }
  }
}
