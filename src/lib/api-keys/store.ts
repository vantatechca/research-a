/**
 * Storage layer for API keys.
 *
 * Reads come DB-first, env-fallback. Writes go to DB only — never to env.
 *
 * The DB row is encrypted at rest. The cleartext only lives in memory while
 * a request is being served. There's a small in-process cache (60s TTL) to
 * avoid hitting the DB for every Anthropic call.
 */

import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "./crypto";
import { getProvider, type ApiKeyProvider, PROVIDERS } from "./providers";

// ─── In-process cache ────────────────────────────────────────────────────────

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<ApiKeyProvider, CacheEntry>();

/** Drop the cache entry for a provider (call after writes). */
export function invalidateCache(provider: ApiKeyProvider): void {
  cache.delete(provider);
}

/** Drop the entire cache (used by tests and PUT-many). */
export function invalidateAllCache(): void {
  cache.clear();
}

// ─── Source identification ───────────────────────────────────────────────────

export type KeySource = "db" | "env" | "missing";

export interface KeyStatus {
  provider: ApiKeyProvider;
  configured: boolean;
  source: KeySource;
  /** Masked preview (first 4 + last 4). Never the full key. */
  preview: string;
  updatedAt: string | null;
}

// ─── Read paths ──────────────────────────────────────────────────────────────

/**
 * Get the cleartext API key for a provider. DB takes priority over env.
 * Returns null when neither is set.
 *
 * Cached in-process for 60s. After a successful PUT/DELETE, the cache for
 * that provider is invalidated.
 */
export async function getApiKey(
  provider: ApiKeyProvider
): Promise<string | null> {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 1. DB
  let value: string | null = null;
  try {
    const row = await prisma.apiKey.findUnique({
      where: { provider },
      select: { encryptedValue: true },
    });
    if (row?.encryptedValue) {
      try {
        value = decrypt(row.encryptedValue);
      } catch (err) {
        // Most likely cause: master key changed and old rows can't be
        // decrypted. Don't crash the request — fall through to env.
        console.error(
          `[api-keys] decrypt failed for provider=${provider}:`,
          err
        );
      }
    }
  } catch (err) {
    // DB unreachable / table missing. Fall through to env so the system
    // still works in degraded mode.
    console.error(
      `[api-keys] DB read failed for provider=${provider}:`,
      err
    );
  }

  // 2. Env fallback
  if (!value) {
    const spec = getProvider(provider);
    if (spec) {
      const envValue = process.env[spec.envVar];
      if (envValue && envValue.length > 0) {
        value = envValue;
      }
    }
  }

  cache.set(provider, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

/**
 * Same as getApiKey but throws when missing — useful inside route handlers
 * that can't proceed without a key.
 */
export async function requireApiKey(
  provider: ApiKeyProvider
): Promise<string> {
  const v = await getApiKey(provider);
  if (!v) {
    throw new Error(
      `Missing API key for provider '${provider}'. Set it in /settings/api-keys or via env.`
    );
  }
  return v;
}

/**
 * Status of every provider — for the UI to render the list. Never returns
 * full key values, only previews.
 */
export async function listKeyStatus(): Promise<KeyStatus[]> {
  // Pull all DB rows in one query
  let dbRows: Array<{
    provider: string;
    encryptedValue: string;
    updatedAt: Date;
  }> = [];
  try {
    dbRows = await prisma.apiKey.findMany({
      select: { provider: true, encryptedValue: true, updatedAt: true },
    });
  } catch (err) {
    console.error("[api-keys] listKeyStatus DB read failed:", err);
    // Continue with empty DB rows — env-only mode
  }
  const dbByProvider = new Map(dbRows.map((r) => [r.provider, r]));

  const out: KeyStatus[] = [];
  for (const spec of PROVIDERS) {
    const dbRow = dbByProvider.get(spec.id);
    let preview = "";
    let source: KeySource = "missing";
    let updatedAt: string | null = null;

    if (dbRow) {
      try {
        const cleartext = decrypt(dbRow.encryptedValue);
        preview = previewOf(cleartext);
        source = "db";
        updatedAt = dbRow.updatedAt.toISOString();
      } catch {
        // Decrypt failed — treat as missing rather than crashing the list.
        // The UI will let the user re-enter the key.
      }
    }

    if (source === "missing") {
      const envValue = process.env[spec.envVar];
      if (envValue && envValue.length > 0) {
        preview = previewOf(envValue);
        source = "env";
      }
    }

    out.push({
      provider: spec.id,
      configured: source !== "missing",
      source,
      preview,
      updatedAt,
    });
  }
  return out;
}

function previewOf(value: string): string {
  if (value.length < 8) return "****";
  return value.slice(0, 4) + "…" + value.slice(-4);
}

// ─── Write paths ─────────────────────────────────────────────────────────────

/**
 * Upsert a key for a provider. Encrypts before storing.
 */
export async function setApiKey(
  provider: ApiKeyProvider,
  cleartext: string
): Promise<KeyStatus> {
  const encrypted = encrypt(cleartext);

  const row = await prisma.apiKey.upsert({
    where: { provider },
    create: { provider, encryptedValue: encrypted },
    update: { encryptedValue: encrypted },
  });

  invalidateCache(provider);

  return {
    provider,
    configured: true,
    source: "db",
    preview: previewOf(cleartext),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Delete a key from the DB. The env fallback (if set) takes over.
 */
export async function deleteApiKey(
  provider: ApiKeyProvider
): Promise<{ deleted: boolean }> {
  try {
    await prisma.apiKey.delete({ where: { provider } });
    invalidateCache(provider);
    return { deleted: true };
  } catch (err) {
    // Already gone is fine
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      invalidateCache(provider);
      return { deleted: false };
    }
    throw err;
  }
}