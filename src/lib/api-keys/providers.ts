/**
 * API key provider registry.
 *
 * Single source of truth for everything about an API key provider:
 *   - Stable internal ID (used as DB key and in URLs)
 *   - Human label (UI)
 *   - The env var name that workers/Next read at runtime
 *   - Validation pattern (defence in depth — does it look like a key for
 *     this provider?)
 *   - How to test the key live
 *
 * Anything that touches API keys imports from here. Adding a provider means
 * editing this one list.
 */

export type ApiKeyProvider =
  | "anthropic"
  | "openrouter"
  | "youtube"
  | "serp"
  | "etsy"
  | "embeddings";

export interface ProviderSpec {
  id: ApiKeyProvider;
  label: string;
  envVar: string;
  /** Short blurb shown in the UI under the field. */
  description: string;
  /** Placeholder shown in the input when empty. Mostly key-prefix hints. */
  placeholder: string;
  /**
   * Optional regex the key should match. If set, save endpoint rejects
   * keys that don't match. Tolerant by default — only enforce patterns
   * we're sure of (Anthropic, OpenRouter, Google).
   */
  pattern?: RegExp;
  /** Human-readable hint when pattern fails. */
  patternHint?: string;
  /** Minimum sensible length (catches truncation/copy errors). */
  minLength: number;
  /**
   * Whether we know how to test this provider live (POST .../test).
   * If false, the test button is disabled in the UI.
   */
  testable: boolean;
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    description: "Claude Sonnet 4 — powers the brain chat",
    placeholder: "sk-ant-...",
    pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    patternHint: "Anthropic keys start with 'sk-ant-'",
    minLength: 30,
    testable: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    description: "Cheap LLM (DeepSeek) for bulk extraction in workers",
    placeholder: "sk-or-...",
    pattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    patternHint: "OpenRouter keys start with 'sk-or-'",
    minLength: 30,
    testable: true,
  },
  {
    id: "youtube",
    label: "YouTube Data API",
    envVar: "YOUTUBE_API_KEY",
    description: "YouTube search — used by youtube_scraper",
    placeholder: "AIza...",
    pattern: /^AIza[A-Za-z0-9_-]{30,}$/,
    patternHint: "Google API keys start with 'AIza'",
    minLength: 35,
    testable: true,
  },
  {
    id: "serp",
    // NOTE: env var is SERP_API_KEY (with underscore), not SERPAPI_KEY.
    // The previous settings UI claimed SERPAPI_KEY which never existed in
    // any worker — anyone following the UI hint set the wrong variable.
    label: "Search API (Serper / SerpAPI / Brave)",
    envVar: "SERP_API_KEY",
    description: "Web search for the research worker. Provider chosen by SERP_API_PROVIDER.",
    placeholder: "Enter search API key",
    minLength: 16,
    testable: true,
  },
  {
    id: "etsy",
    label: "Etsy Open API",
    envVar: "ETSY_API_KEY",
    description: "Etsy product search for competitor data",
    placeholder: "Enter Etsy API key",
    minLength: 16,
    testable: false, // Etsy v3 needs OAuth dance; not worth testing here
  },
  {
    id: "embeddings",
    label: "Embeddings API",
    envVar: "EMBEDDINGS_API_KEY",
    description: "OpenAI-compatible embeddings for brain memory (text-embedding-3-small)",
    placeholder: "sk-... or vendor key",
    minLength: 20,
    testable: true,
  },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): ProviderSpec | null {
  return PROVIDER_BY_ID.get(id as ApiKeyProvider) ?? null;
}

export function isValidProviderId(id: string): id is ApiKeyProvider {
  return PROVIDER_BY_ID.has(id as ApiKeyProvider);
}