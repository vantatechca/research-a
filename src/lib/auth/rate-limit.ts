/**
 * In-memory sliding-window rate limiter for failed login attempts.
 *
 * Single-instance only — for multi-instance deployments this would need
 * Redis. For a single-operator app on Render starter plan, in-memory is
 * fine.
 *
 * Successful logins do NOT consume budget (otherwise the operator gets
 * locked out of their own app). Only failures count.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const MAX_TRACKED_KEYS = 10_000; // hard cap to bound memory

interface Bucket {
  failures: number[];
}

const buckets = new Map<string, Bucket>();

function pruneOld(bucket: Bucket, now: number): void {
  const cutoff = now - WINDOW_MS;
  // Mutate in place — this map is hot.
  let i = 0;
  while (i < bucket.failures.length && bucket.failures[i] < cutoff) i++;
  if (i > 0) bucket.failures.splice(0, i);
}

/**
 * Check if a key is currently allowed to attempt login.
 * Returns the number of seconds until next allowed attempt (0 = allowed now).
 */
export function checkLoginAllowed(key: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true, retryAfterSec: 0 };

  pruneOld(bucket, now);
  if (bucket.failures.length < MAX_FAILURES) {
    return { allowed: true, retryAfterSec: 0 };
  }

  // Locked out — return seconds until the oldest failure ages out
  const oldest = bucket.failures[0];
  const unlockAt = oldest + WINDOW_MS;
  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((unlockAt - now) / 1000)),
  };
}

/**
 * Record a failed attempt. The bucket auto-evicts when buckets.size grows
 * past MAX_TRACKED_KEYS to bound memory under sustained brute-force traffic.
 */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Evict the oldest tracked key. Map iteration is insertion-order,
      // so the first key is the oldest.
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    bucket = { failures: [] };
    buckets.set(key, bucket);
  }
  bucket.failures.push(now);
  pruneOld(bucket, now);
}

/**
 * Clear a key's record after successful login.
 */
export function clearLoginRecord(key: string): void {
  buckets.delete(key);
}

/**
 * Test-only — drops all rate limit state. Don't call from production code.
 */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}