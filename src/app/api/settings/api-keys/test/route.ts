export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  parseJsonBody,
  safeErrorMessage,
} from "@/lib/api";
import {
  getProvider,
  isValidProviderId,
} from "@/lib/api-keys/providers";
import { getApiKey } from "@/lib/api-keys/store";
import { testProviderKey } from "@/lib/api-keys/test";

/**
 * POST /api/settings/api-keys/test
 *
 * Body shapes:
 *   { provider: "anthropic" }                       → test the stored key
 *   { provider: "anthropic", value: "sk-ant-..." }  → test an unsaved key
 *
 * The second form lets the user verify a key WORKS before they save it.
 */

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const provider = parsed.body.provider;
  const valueOverride = parsed.body.value;

  if (typeof provider !== "string") {
    return errorResponse(400, "Field 'provider' is required");
  }
  if (!isValidProviderId(provider)) {
    return errorResponse(400, `Unknown provider '${provider}'`);
  }

  const spec = getProvider(provider)!;
  if (!spec.testable) {
    return errorResponse(
      400,
      `Provider '${provider}' does not support live testing`
    );
  }

  // Resolve the key to test
  let keyToTest: string | null = null;
  if (typeof valueOverride === "string" && valueOverride.length > 0) {
    keyToTest = valueOverride.trim();
    // Same length sanity checks as the save endpoint, so users get the same
    // hint here.
    if (keyToTest.length < spec.minLength) {
      return errorResponse(
        400,
        `Value is shorter than ${spec.minLength} chars — looks truncated`
      );
    }
    if (keyToTest.length > 500) {
      return errorResponse(400, "Value is too long (max 500 chars)");
    }
  } else {
    try {
      keyToTest = await getApiKey(provider);
    } catch (err) {
      console.error(
        "[api/settings/api-keys/test] failed to read stored key:",
        err
      );
      return NextResponse.json(
        {
          error: "Could not read stored key",
          message: safeErrorMessage(err),
        },
        { status: 503 }
      );
    }
  }

  if (!keyToTest) {
    return errorResponse(
      400,
      `No key configured for '${provider}'. Save one first or pass a value to test.`
    );
  }

  // Run the test. testers never throw, but we wrap for paranoia.
  try {
    const result = await testProviderKey(provider, keyToTest);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/settings/api-keys/test] tester threw:", err);
    return NextResponse.json(
      {
        ok: false,
        message: safeErrorMessage(err),
      },
      { status: 200 } // Test result, not a server error
    );
  }
}