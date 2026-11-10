// One function in front of any OpenAI-compatible chat endpoint. The model gets
// report text only and no tools. Model and provider are settings.

export interface LlmResult {
  model: string;
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  attempts: { model: string; error: string }[];
}

export class LlmError extends Error {
  constructor(message: string, public attempts: { model: string; error: string }[]) { super(message); }
}

export async function callModel(args: {
  system: string; user: string; schema: Record<string, unknown>; schemaName: string; timeoutMs?: number;
}): Promise<LlmResult> {
  const base = process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1";
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmError("LLM_API_KEY is not set", []);
  const models = [process.env.LLM_MODEL, ...(process.env.LLM_FALLBACK_MODELS ?? "").split(",")].map((m) => m?.trim()).filter(Boolean) as string[];
  const attempts: { model: string; error: string }[] = [];

  for (const model of models) {
    // One retry on the same model for a rate limit or a server error, then the next model.
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const started = Date.now();
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          signal: AbortSignal.timeout(args.timeoutMs ?? 120_000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "exterior-estimator" },
          body: JSON.stringify({
            model, temperature: 0,
            messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
            response_format: { type: "json_schema", json_schema: { name: args.schemaName, strict: true, schema: args.schema } },
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) {
          const msg = `${res.status} ${body.error?.message ?? res.statusText}`.slice(0, 300);
          attempts.push({ model, error: msg });
          if ((res.status === 429 || res.status >= 500) && tryNo === 0) { await sleep(3000); continue; }
          break;
        }
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          attempts.push({ model, error: `empty answer (finish: ${body.choices?.[0]?.finish_reason ?? "unknown"})` });
          if (tryNo === 0) continue;
          break;
        }
        return {
          model: body.model ?? model, content, latencyMs: Date.now() - started, attempts,
          tokensIn: body.usage?.prompt_tokens ?? null, tokensOut: body.usage?.completion_tokens ?? null,
        };
      } catch (e) {
        attempts.push({ model, error: (e as Error).message.slice(0, 300) });
        if (tryNo === 0) continue;
      }
    }
  }
  throw new LlmError(`Every model failed: ${attempts.map((a) => `${a.model}: ${a.error}`).join("; ")}`, attempts);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
