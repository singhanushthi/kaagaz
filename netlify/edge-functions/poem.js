// POST /api/poem  { entry, lang, shape, feel }  ->  { title, poem }
//
// Works with any of these AI providers. Add ONE key in Netlify → Site configuration → Environment variables:
//   OPENAI_API_KEY      OpenAI            (paid per use)
//   GROQ_API_KEY        Groq              (free tier)
//   OPENROUTER_API_KEY  OpenRouter        (has free models)
//   DEEPSEEK_API_KEY    DeepSeek          (very cheap)
//   ANTHROPIC_API_KEY   Claude            (paid per use)
//   AI_API_KEY + AI_BASE_URL              any other OpenAI-compatible service
// Optional: AI_PROVIDER to force one when several keys are set, AI_MODEL to change the model.
// Nothing the user writes is stored or logged here.
import { buildPrompt, parsePoem, LANGS, SHAPES, FEELS } from "../../public/prompt.js";

const PROVIDERS = {
  openai:     { key: "OPENAI_API_KEY",     url: "https://api.openai.com/v1/chat/completions",          model: "gpt-6-luna", tokensField: "max_completion_tokens", noTemperature: true, baseEnv: "OPENAI_BASE_URL", path: "/chat/completions" },
  groq:       { key: "GROQ_API_KEY",       url: "https://api.groq.com/openai/v1/chat/completions",     model: "openai/gpt-oss-120b" },
  openrouter: { key: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/chat/completions",       model: "google/gemma-4-31b-it:free" },
  deepseek:   { key: "DEEPSEEK_API_KEY",   url: "https://api.deepseek.com/chat/completions",           model: "deepseek-chat" },
  claude:     { key: "ANTHROPIC_API_KEY",  url: "https://api.anthropic.com/v1/messages",               model: "claude-sonnet-5-5", baseEnv: "ANTHROPIC_BASE_URL", path: "/v1/messages" },
  custom:     { key: "AI_API_KEY",         url: null,                                                  model: null },
};
// When several keys are set (and AI_PROVIDER isn't), use the one that writes the best poems.
// Note: Netlify's AI Gateway adds OPENAI_/ANTHROPIC_ keys to every site automatically, so set
// AI_PROVIDER (e.g. "groq") to make sure your own key is the one used.
const ORDER = ["claude", "openai", "deepseek", "groq", "openrouter", "custom"];

const env = (k) => (globalThis.Netlify?.env?.get(k) ?? globalThis.process?.env?.[k] ?? "").trim();

function pickProvider() {
  const forced = env("AI_PROVIDER").toLowerCase();
  const name = forced && PROVIDERS[forced] ? forced : ORDER.find((n) => env(PROVIDERS[n].key));
  if (!name) return null;
  const p = PROVIDERS[name];
  const key = env(p.key);
  if (!key) return null;
  let url = p.url;
  // Netlify AI Gateway provides its own base URL alongside its key; use it when present.
  const gatewayBase = p.baseEnv && env(p.baseEnv).replace(/\/+$/, "");
  // Same rule as the official SDKs: OpenAI base + "/chat/completions", Anthropic base + "/v1/messages".
  if (gatewayBase) url = gatewayBase + p.path;
  if (name === "custom") {
    const base = env("AI_BASE_URL").replace(/\/+$/, "");
    if (!base) return null;
    url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  }
  const model = env("AI_MODEL") || p.model;
  if (!model) return null;
  return { name, key, url, model, tokensField: p.tokensField || "max_tokens", noTemperature: !!p.noTemperature };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function errorFor(status) {
  if (status === 401 || status === 403) return "bad_key";
  if (status === 402) return "no_credit";
  if (status === 429 || status === 529 || status === 503) return "busy";
  return "upstream_error";
}

async function callClaude(p, prompt) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "x-api-key": p.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: p.model, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return { status: res.status, detail: await res.text().catch(() => "") };
  const data = await res.json();
  if (data.stop_reason === "refusal") return { refused: true };
  return { text: (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") };
}

async function callOpenAICompatible(p, prompt) {
  const headers = { authorization: `Bearer ${p.key}`, "content-type": "application/json" };
  if (p.name === "openrouter") { headers["HTTP-Referer"] = "https://kaagaz.app"; headers["X-Title"] = "Kaagaz"; }
  const res = await fetch(p.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: p.model,
      // generous so "thinking" models still have room left for the poem
      [p.tokensField]: 4000,
      // a little creative, but stays faithful to what they wrote
      ...(p.noTemperature ? {} : { temperature: 0.7 }),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return { status: res.status, detail: await res.text().catch(() => "") };
  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") return { refused: true };
  let text = choice?.message?.content;
  if (Array.isArray(text)) text = text.map((part) => part?.text || "").join("");
  // some open models wrap their reasoning in <think>…</think>; keep only the answer
  text = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  return { text };
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Only accept calls from this site's own pages.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ error: "forbidden" }, 403);
    } catch {
      return json({ error: "forbidden" }, 403);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const entry = typeof body?.entry === "string" ? body.entry.trim() : "";
  if (entry.length < 8) return json({ error: "too_short" }, 400);
  const words = (entry.match(/\S+/g) || []).length;
  if (entry.length > 80000 || words > 10000) return json({ error: "too_long" }, 413);
  const lang = Object.hasOwn(LANGS, body.lang) ? body.lang : "auto";
  const shape = Object.hasOwn(SHAPES, body.shape) ? body.shape : "free";
  const feel = Object.hasOwn(FEELS, body.feel) ? body.feel : "hopeful";

  const provider = pickProvider();
  if (!provider) return json({ error: "not_configured" }, 500);

  const prompt = buildPrompt(entry, lang, shape, feel);
  let r;
  try {
    r = provider.name === "claude" ? await callClaude(provider, prompt) : await callOpenAICompatible(provider, prompt);
  } catch {
    return json({ error: "upstream_error" }, 502);
  }

  if (r.refused) return json({ error: "refused" }, 422);
  if (r.status) {
    console.error(`AI provider error (${provider.name}, ${provider.model})`, r.status, String(r.detail).slice(0, 300));
    const code = errorFor(r.status);
    return json({ error: code }, code === "busy" ? 503 : 502);
  }

  const out = parsePoem(r.text);
  if (!out.poem) return json({ error: "empty" }, 502);
  return json(out);
};

export const config = { path: "/api/poem" };
