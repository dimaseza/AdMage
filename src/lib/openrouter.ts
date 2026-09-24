/**
 * Minimal OpenRouter chat-completions client for the Prompt Builder.
 *
 * Two models are used:
 *  - a cheap text model (DeepSeek V4 Flash) that writes the prompts, and
 *  - a cheap vision model (Gemini 2.5 Flash Lite) that describes product photos.
 * Both are env-configurable so they can be swapped without a deploy of new code.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const PROMPT_MODEL = process.env.OPENROUTER_PROMPT_MODEL || 'deepseek/deepseek-v4-flash';
export const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash-lite';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
};

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  /** Hard cap on completion tokens. Bounds cost even if the model rambles. */
  maxTokens: number;
  temperature?: number;
  /** Ask for a JSON object. Providers that ignore it still get the schema in the prompt. */
  json?: boolean;
  timeoutMs?: number;
};

export type ChatResult = {
  content: string;
  model: string;
};

/** A failure the caller can show to the user without leaking provider details. */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    /** Message safe to return to the browser. */
    readonly publicMessage: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      'OPENROUTER_API_KEY is not set',
      'The prompt service is not configured yet. Please try again later.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 50_000);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'AdMage Prompt Builder',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        // Filling a template does not need chain-of-thought, and thinking tokens
        // bill as output - leaving it on roughly quadruples the cost per prompt.
        reasoning: { enabled: false },
        // Several providers serve each model at very different prices.
        provider: { sort: 'price' },
        usage: { include: true },
      }),
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new OpenRouterError(
      `OpenRouter request failed: ${aborted ? 'timeout' : String(err)}`,
      aborted
        ? 'The AI took too long to respond. Please try again.'
        : 'Could not reach the AI service. Please try again.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[openrouter] ${res.status} from ${opts.model}: ${detail.slice(0, 500)}`);
    throw new OpenRouterError(
      `OpenRouter responded ${res.status}`,
      res.status === 429
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'The AI service is temporarily unavailable. Please try again.',
      res.status
    );
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new OpenRouterError(
      `OpenRouter returned no content from ${opts.model}`,
      'The AI returned an empty answer. Please try again.'
    );
  }

  // Real per-call spend, so the cost estimates can be checked against reality.
  if (data.usage) {
    console.info(
      `[openrouter] ${data.model ?? opts.model} in=${data.usage.prompt_tokens} ` +
        `out=${data.usage.completion_tokens} cost=$${data.usage.cost ?? '?'}`
    );
  }

  return { content, model: data.model ?? opts.model };
}
