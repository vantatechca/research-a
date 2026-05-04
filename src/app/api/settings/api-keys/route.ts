export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  parseJsonBody,
  safeErrorMessage,
} from "@/lib/api";
import { isMasterKeyConfigured } from "@/lib/api-keys/crypto";
import {
  getProvider,
  isValidProviderId,
  PROVIDERS,
} from "@/lib/api-keys/providers";
import {
  deleteApiKey,
  listKeyStatus,
  setApiKey,
} from "@/lib/api-keys/store";

// ─── GET /api/settings/api-keys ──────────────────────────────────────────────
// Returns the configured status of every provider. Never returns full keys.

export async function GET() {
  try {
    const statuses = await listKeyStatus();
    return NextResponse.json({
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        envVar: p.envVar,
        description: p.description,
        placeholder: p.placeholder,
        patternHint: p.patternHint ?? null,
        testable: p.testable,
      })),
      keys: statuses,
      masterKeyConfigured: isMasterKeyConfigured(),
    });
  } catch (err) {
    console.error("[api/settings/api-keys] GET failed:", err);
    return NextResponse.json(
      { error: "Could not load API key status", message: safeErrorMessage(err) },
      { status: 503 }
    );
  }
}

// ─── PUT /api/settings/api-keys ──────────────────────────────────────────────
// Upsert one or more keys. Body shape:
//   { keys: [{ provider: "anthropic", value: "sk-ant-..." }, ...] }
// Validates each key against its provider's pattern and minLength.

interface PutKeyEntry {
  provider: string;
  value: string;
}

export async function PUT(req: NextRequest) {
  if (!isMasterKeyConfigured()) {
    return errorResponse(
      503,
      "MASTER_ENCRYPTION_KEY is not set on the server. Cannot save API keys."
    );
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const rawKeys = parsed.body.keys;
  if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
    return errorResponse(400, "Field 'keys' must be a non-empty array");
  }
  if (rawKeys.length > PROVIDERS.length) {
    return errorResponse(400, "Too many entries in 'keys'");
  }

  // Validate every entry up front so we don't half-write a batch.
  const validated: PutKeyEntry[] = [];
  for (const [i, entry] of rawKeys.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { provider?: unknown }).provider !== "string" ||
      typeof (entry as { value?: unknown }).value !== "string"
    ) {
      return errorResponse(
        400,
        `keys[${i}] must be { provider: string, value: string }`
      );
    }
    const e = entry as { provider: string; value: string };

    if (!isValidProviderId(e.provider)) {
      return errorResponse(
        400,
        `keys[${i}]: unknown provider '${e.provider}'`
      );
    }
    const spec = getProvider(e.provider)!;
    const value = e.value.trim();

    if (value.length === 0) {
      return errorResponse(
        400,
        `keys[${i}]: value is empty (use DELETE to remove a key)`
      );
    }
    if (value.length < spec.minLength) {
      return errorResponse(
        400,
        `keys[${i}]: value for ${spec.label} is shorter than ${spec.minLength} chars — looks truncated`
      );
    }
    if (value.length > 500) {
      return errorResponse(
        400,
        `keys[${i}]: value is too long (max 500 chars)`
      );
    }
    if (spec.pattern && !spec.pattern.test(value)) {
      return errorResponse(
        400,
        `keys[${i}]: ${spec.patternHint ?? "value does not match expected format"}`
      );
    }

    validated.push({ provider: e.provider, value });
  }

  // Reject duplicate providers in the same request — last write would win
  // silently otherwise.
  const seen = new Set<string>();
  for (const v of validated) {
    if (seen.has(v.provider)) {
      return errorResponse(
        400,
        `Duplicate provider '${v.provider}' in request`
      );
    }
    seen.add(v.provider);
  }

  try {
    const results = [];
    for (const v of validated) {
      // Sequential to keep behaviour deterministic; the list is small.
      // eslint-disable-next-line no-await-in-loop
      const status = await setApiKey(
        v.provider as Parameters<typeof setApiKey>[0],
        v.value
      );
      results.push(status);
    }
    return NextResponse.json({ updated: results });
  } catch (err) {
    console.error("[api/settings/api-keys] PUT failed:", err);
    return NextResponse.json(
      { error: "Could not save API keys", message: safeErrorMessage(err) },
      { status: 503 }
    );
  }
}

// ─── DELETE /api/settings/api-keys?provider=... ──────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return errorResponse(400, "Query param 'provider' is required");
  }
  if (!isValidProviderId(provider)) {
    return errorResponse(400, `Unknown provider '${provider}'`);
  }

  try {
    const result = await deleteApiKey(provider);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/settings/api-keys] DELETE failed:", err);
    return NextResponse.json(
      { error: "Could not delete API key", message: safeErrorMessage(err) },
      { status: 503 }
    );
  }
}