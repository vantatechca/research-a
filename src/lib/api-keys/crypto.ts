/**
 * AES-256-GCM encryption for API keys at rest.
 *
 * Format (base64): [12-byte IV][16-byte auth tag][ciphertext]
 *
 * The master key comes from MASTER_ENCRYPTION_KEY (32 bytes hex = 64 chars).
 * Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If the master key is missing or malformed, encrypt/decrypt throws — this is
 * deliberate. Storing plaintext keys is worse than the app refusing to start.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getMasterKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY is not set. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  // Accept either 64 hex chars (32 bytes) or 44 base64 chars (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Try base64 — GCM specifically needs 32 bytes
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === KEY_LENGTH) return buf;
  } catch {
    // fall through
  }
  throw new Error(
    "MASTER_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex chars or base64"
  );
}

/**
 * Encrypt a plaintext string. Returns base64 of [IV | tag | ciphertext].
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new TypeError("encrypt() requires a string");
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;

  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decrypt a value previously produced by encrypt(). Throws if the auth tag
 * doesn't verify (tampering or wrong master key).
 */
export function decrypt(payload: string): string {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new TypeError("decrypt() requires a non-empty string");
  }
  const key = getMasterKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Encrypted payload is too short to be valid");
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM;
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * Mask a key for safe display in the UI / logs.
 * - Empty/undefined → "" (clearly not configured)
 * - Short (< 8 chars) → "****"
 * - Otherwise: first 4 chars + dots + last 4 chars
 */
export function maskKey(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length < 8) return "****";
  return value.slice(0, 4) + "…" + value.slice(-4);
}

/**
 * Check that the master key is configured, without performing an encrypt.
 * Used by the UI to show a clear error before users try to save a key.
 */
export function isMasterKeyConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}