/**
 * Live key validation. Pings each provider's API with a minimal request to
 * verify the key is accepted. Used by POST /api/settings/api-keys/test.
 *
 * Each tester returns:
 *   { ok: true,  message?: string }  → key works
 *   { ok: false, message:  string }  → key rejected (or some other error)
 *
 * Testers must NEVER throw — they're called from a route handler that already
 * has its own try/catch, but a thrown error here would leak into a 500.
 */

import type { ApiKeyProvider } from "./providers";

export interface TestResult {
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 8000;

async function timedFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function networkError(err: unknown): TestResult {
  if (err instanceof Error && err.name === "AbortError") {
    return { ok: false, message: "Provider API timed out" };
  }
  const msg = err instanceof Error ? err.message : "Network error";
  return { ok: false, message: msg };
}

// ─── Per-provider testers ────────────────────────────────────────────────────

async function testAnthropic(key: string): Promise<TestResult> {
  // Smallest possible request: 1 token, haiku model.
  // Anthropic returns 401 for bad keys and 200 for good ones.
  try {
    const res = await timedFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (res.ok) return { ok: true, message: "Anthropic key is valid" };
    if (res.status === 401)
      return { ok: false, message: "Anthropic rejected the key (401)" };
    if (res.status === 403)
      return { ok: false, message: "Anthropic key lacks permissions (403)" };
    return { ok: false, message: `Anthropic returned HTTP ${res.status}` };
  } catch (err) {
    return networkError(err);
  }
}

async function testOpenRouter(key: string): Promise<TestResult> {
  // GET /api/v1/models is auth-required and cheap.
  try {
    const res = await timedFetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { ok: true, message: "OpenRouter key is valid" };
    if (res.status === 401)
      return { ok: false, message: "OpenRouter rejected the key (401)" };
    return { ok: false, message: `OpenRouter returned HTTP ${res.status}` };
  } catch (err) {
    return networkError(err);
  }
}

async function testYouTube(key: string): Promise<TestResult> {
  // videos.list with a known video ID. Cheapest possible API call.
  // "dQw4w9WgXcQ" is permanent and public.
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "id");
    url.searchParams.set("id", "dQw4w9WgXcQ");
    url.searchParams.set("key", key);
    const res = await timedFetch(url.toString(), { method: "GET" });
    if (res.ok) return { ok: true, message: "YouTube key is valid" };
    if (res.status === 400 || res.status === 403) {
      // Google returns 400 with reason=API_KEY_INVALID or 403 for disabled keys
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        const msg = body.error?.message ?? `HTTP ${res.status}`;
        return { ok: false, message: `YouTube: ${msg}` };
      } catch {
        return { ok: false, message: `YouTube returned HTTP ${res.status}` };
      }
    }
    return { ok: false, message: `YouTube returned HTTP ${res.status}` };
  } catch (err) {
    return networkError(err);
  }
}

async function testSerp(key: string): Promise<TestResult> {
  // Default to Serper (the project default per .env.example). Other providers
  // (SerpAPI, Brave) use different endpoints — we test Serper since that's
  // what SERP_API_PROVIDER defaults to.
  const provider = process.env.SERP_API_PROVIDER ?? "serper";

  try {
    if (provider === "serper") {
      const res = await timedFetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "content-type": "application/json" },
        body: JSON.stringify({ q: "test", num: 1 }),
      });
      if (res.ok) return { ok: true, message: "Serper key is valid" };
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: "Serper rejected the key" };
      return { ok: false, message: `Serper returned HTTP ${res.status}` };
    }

    if (provider === "serpapi") {
      const url = new URL("https://serpapi.com/account");
      url.searchParams.set("api_key", key);
      const res = await timedFetch(url.toString(), { method: "GET" });
      if (res.ok) return { ok: true, message: "SerpAPI key is valid" };
      return { ok: false, message: `SerpAPI returned HTTP ${res.status}` };
    }

    if (provider === "brave") {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", "test");
      url.searchParams.set("count", "1");
      const res = await timedFetch(url.toString(), {
        method: "GET",
        headers: { "X-Subscription-Token": key },
      });
      if (res.ok) return { ok: true, message: "Brave key is valid" };
      return { ok: false, message: `Brave returned HTTP ${res.status}` };
    }

    return {
      ok: false,
      message: `Unknown SERP_API_PROVIDER: ${provider}`,
    };
  } catch (err) {
    return networkError(err);
  }
}

async function testEmbeddings(key: string): Promise<TestResult> {
  const baseUrl =
    process.env.EMBEDDINGS_API_URL ?? "https://api.openai.com/v1";
  const model =
    process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";

  try {
    const res = await timedFetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, input: "test" }),
    });
    if (res.ok) return { ok: true, message: "Embeddings key is valid" };
    if (res.status === 401)
      return { ok: false, message: "Embeddings provider rejected the key" };
    return {
      ok: false,
      message: `Embeddings provider returned HTTP ${res.status}`,
    };
  } catch (err) {
    return networkError(err);
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function testProviderKey(
  provider: ApiKeyProvider,
  key: string
): Promise<TestResult> {
  switch (provider) {
    case "anthropic":
      return testAnthropic(key);
    case "openrouter":
      return testOpenRouter(key);
    case "youtube":
      return testYouTube(key);
    case "serp":
      return testSerp(key);
    case "embeddings":
      return testEmbeddings(key);
    case "etsy":
      // Marked testable=false in the registry, but defensive default.
      return {
        ok: false,
        message: "Etsy keys can't be tested without OAuth",
      };
    default:
      return { ok: false, message: `No tester for provider '${provider}'` };
  }
}