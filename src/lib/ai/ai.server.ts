/**
 * Shared AI provider abstraction.
 *
 * One entry point — `callAI({ task, systemPrompt, userContent, jsonMode })` —
 * routes to a provider+model based on the TASK_ROUTING map below.
 *
 * To switch a task to a different provider/model, edit ONLY TASK_ROUTING.
 * Feature code never imports providers directly.
 */

export type ProviderName = "anthropic" | "openai" | "gemini";

export interface ProviderRequest {
  model: string;
  systemPrompt: string;
  userContent: string;
}

export interface Provider {
  name: ProviderName;
  call(req: ProviderRequest): Promise<string>;
}

// ---------------------------------------------------------------------------
// Task routing — EDIT THIS MAP to swap providers/models per task.
// ---------------------------------------------------------------------------
export type TaskName = "website_analysis" | "content_generation" | "campaign_strategy";

interface TaskRoute {
  provider: ProviderName;
  model: string;
}

const TASK_ROUTING: Record<TaskName, TaskRoute> = {
  website_analysis: { provider: "anthropic", model: "claude-sonnet-4-6" },
  content_generation: { provider: "anthropic", model: "claude-sonnet-4-6" },
  campaign_strategy: { provider: "anthropic", model: "claude-sonnet-4-6" },
};

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

const anthropicProvider: Provider = {
  name: "anthropic",
  async call({ model, systemPrompt, userContent }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic ${res.status}: ${body}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = json.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    if (!text) throw new Error("Anthropic returned no text content");
    return text;
  },
};

const openaiProvider: Provider = {
  name: "openai",
  async call({ model, systemPrompt, userContent }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned no text content");
    return text;
  },
};

const geminiProvider: Provider = {
  name: "gemini",
  async call({ model, systemPrompt, userContent }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("");
    if (!text) throw new Error("Gemini returned no text content");
    return text;
  },
};

const PROVIDERS: Record<ProviderName, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AILogContext {
  ownerId?: string | null;
  projectId?: string | null;
}

export interface CallAIArgs {
  task: TaskName;
  systemPrompt: string;
  userContent: string;
  /** When true, strip markdown fences and return parsed JSON. */
  jsonMode?: boolean;
  /** Optional context for the ai_generation_log audit row. */
  logContext?: AILogContext;
}

async function writeAILog(args: {
  task: string;
  provider: string;
  model: string;
  inputChars: number;
  outputChars: number;
  logContext?: AILogContext;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Rough token estimate (~4 chars/token). Swap for provider-reported usage when available.
    const input_tokens = Math.ceil(args.inputChars / 4);
    const output_tokens = Math.ceil(args.outputChars / 4);
    await supabaseAdmin.from("ai_generation_log").insert({
      owner_id: args.logContext?.ownerId ?? null,
      project_id: args.logContext?.projectId ?? null,
      task: args.task,
      provider: args.provider,
      model: args.model,
      input_tokens,
      output_tokens,
      cost_estimate: null,
    });
  } catch (err) {
    console.warn("[ai_generation_log] write failed:", (err as Error).message);
  }
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  // ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function callAI(args: CallAIArgs & { jsonMode: true }): Promise<unknown>;
export async function callAI(args: CallAIArgs & { jsonMode?: false }): Promise<string>;
export async function callAI(args: CallAIArgs): Promise<unknown> {
  const route = TASK_ROUTING[args.task];
  if (!route) throw new Error(`No provider route configured for task "${args.task}"`);
  const provider = PROVIDERS[route.provider];
  if (!provider) throw new Error(`Unknown provider "${route.provider}"`);

  const raw = await provider.call({
    model: route.model,
    systemPrompt: args.systemPrompt,
    userContent: args.userContent,
  });

  await writeAILog({
    task: args.task,
    provider: route.provider,
    model: route.model,
    inputChars: args.systemPrompt.length + args.userContent.length,
    outputChars: raw.length,
    logContext: args.logContext,
  });

  if (!args.jsonMode) return raw;

  const cleaned = stripJsonFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `callAI jsonMode: failed to parse JSON from ${route.provider}/${route.model}. ` +
        `Parse error: ${(err as Error).message}. Raw (first 500 chars): ${cleaned.slice(0, 500)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Image generation (Gemini / Imagen) — server-side only.
// ---------------------------------------------------------------------------

export type ImageAspectRatio = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

export interface GenerateImageArgs {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  /** Imagen model id; defaults to a current Imagen 4 fast variant. */
  model?: string;
}

export interface GeneratedImage {
  /** Raw base64-encoded PNG bytes (no data: prefix). */
  base64: string;
  mimeType: string;
}

export async function generateImage({
  prompt,
  aspectRatio = "1:1",
  model = "imagen-4.0-generate-001",
}: GenerateImageArgs): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Imagen ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  const pred = json.predictions?.[0];
  if (!pred?.bytesBase64Encoded) {
    throw new Error("Imagen returned no image data");
  }
  return {
    base64: pred.bytesBase64Encoded,
    mimeType: pred.mimeType ?? "image/png",
  };
}


// ---------------------------------------------------------------------------
// Multi-turn chat — used by the campaign strategist.
// Currently only routes that resolve to anthropic are supported.
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface CallAIChatArgs {
  task: TaskName;
  systemPrompt: string;
  messages: ChatTurn[];
  jsonMode?: boolean;
  logContext?: AILogContext;
}

export async function callAIChat(args: CallAIChatArgs & { jsonMode: true }): Promise<unknown>;
export async function callAIChat(args: CallAIChatArgs & { jsonMode?: false }): Promise<string>;
export async function callAIChat(args: CallAIChatArgs): Promise<unknown> {
  const route = TASK_ROUTING[args.task];
  if (!route) throw new Error(`No route for "${args.task}"`);
  if (route.provider !== "anthropic") {
    throw new Error(`callAIChat: provider "${route.provider}" not supported yet`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: route.model,
      max_tokens: 4096,
      system: args.systemPrompt,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = json.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error("Anthropic returned no text content");

  if (!args.jsonMode) return text;
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `callAIChat jsonMode: failed to parse JSON. Parse error: ${(err as Error).message}. ` +
        `Raw (first 500 chars): ${cleaned.slice(0, 500)}`,
    );
  }
}
