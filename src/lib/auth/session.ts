/**
 * Stateless session token: <expires_at_ms>.<hmac_hex>
 *
 * The HMAC is computed over the expires_at value with AUTH_SESSION_SECRET as
 * the key. No DB row, no JWT library — just a signed expiry timestamp.
 *
 * Verification rejects:
 *   - Malformed tokens (wrong shape, bad hex, etc.)
 *   - Expired tokens
 *   - Tokens with a tampered expiry (HMAC won't verify)
 *   - Wrong-length signatures (timingSafeEqual requires equal length)
 *
 * The signing key is separate from MASTER_ENCRYPTION_KEY because it has a
 * different blast radius: leaking the session secret lets an attacker forge
 * sessions; leaking the encryption key lets them read stored API keys.
 * Different secrets, different incident playbooks.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "research_a_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionSecret(): Buffer {
  const raw = process.env.AUTH_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET must be set and at least 32 chars. " +
        "Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(raw, "utf8");
}

/**
 * Sign a session token valid for SESSION_DURATION_MS from now.
 */
export function signSession(now: number = Date.now()): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = now + SESSION_DURATION_MS;
  const secret = getSessionSecret();
  const sig = createHmac("sha256", secret)
    .update(String(expiresAt))
    .digest("hex");
  return { token: `${expiresAt}.${sig}`, expiresAt };
}

/**
 * Verify a session token. Returns true iff:
 *   - shape is <number>.<hex>
 *   - HMAC signature verifies under AUTH_SESSION_SECRET
 *   - expires_at > now
 */
export function verifySession(token: string | undefined | null): boolean {
  if (typeof token !== "string" || token.length === 0) return false;

  const dot = token.indexOf(".");
  if (dot < 1) return false;

  const expiresStr = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  // Validate shape before any crypto work — cheap rejection.
  if (!/^\d{10,16}$/.test(expiresStr)) return false;
  if (!/^[0-9a-f]{64}$/.test(sigHex)) return false;

  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  let secret: Buffer;
  try {
    secret = getSessionSecret();
  } catch {
    return false;
  }

  const expectedHex = createHmac("sha256", secret)
    .update(expiresStr)
    .digest("hex");

  // timingSafeEqual requires equal-length buffers, and we already validated
  // both are 64 hex chars above, so this is safe.
  const a = Buffer.from(sigHex, "hex");
  const b = Buffer.from(expectedHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Constant-time string compare for password verification. Equal-length buffers
 * are required by timingSafeEqual — we pad the shorter side so length itself
 * doesn't leak through a fast-path return.
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  // Pad to the longer length so we always do the same amount of work.
  const len = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(len);
  const bPadded = Buffer.alloc(len);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  // Even when lengths differ, timingSafeEqual returns false — but we still
  // need the buffers equal length to call it without throwing.
  const result = timingSafeEqual(aPadded, bPadded);
  return result && aBuf.length === bBuf.length;
}

/**
 * Whether AUTH_PASSWORD is configured. Used to detect mis-deployed instances
 * (no password set = login is impossible).
 */
export function isAuthConfigured(): boolean {
  const pw = process.env.AUTH_PASSWORD;
  return typeof pw === "string" && pw.length >= 8;
}