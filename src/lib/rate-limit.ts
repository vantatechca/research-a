/**
 * Generic in-memory sliding-window rate limiter.
 *
 * Separate from src/lib/auth/rate-limit.ts on purpose: that one tracks only
 * failed logins. This one tracks any request hit, parameterized by a
 * category key so different endpoints don't share a budget (a brute-force
 * scrape-trigger attack shouldn't lock the brain chat).
 *
 * Single-instance only — for multi-instance deployments swap for Redis.
 * For a one-operator app on Render starter this is plenty.
 */

interface Bucket {
  hits: number[];
}

interface Limiter {
  windowMs: number;
  maxHits: number;
  buckets: Map<string, Bucket>;
}

const MAX_TRACKED_KEYS = 10_000;

// One limiter map per category. Keeps endpoint budgets isolated.
const limiters: Map<string, Limiter> = new Map();

function getOrCreateLimiter(category: string, windowMs: number, maxHits: number): Limiter {
  let l = limiters.get(category);
  if (!l) {
    l = { windowMs, maxHits, buckets: new Map() };
    limiters.set(category, l);
  }
  return l;
}

function pruneOld(bucket: Bucket, cutoff: number): void {
  let i = 0;
  while (i < bucket.hits.length && bucket.hits[i] < cutoff) i++;
  if (i > 0) bucket.hits.splice(0, i);
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until next allowed hit. 0 when allowed=true. */
  retryAfterSec: number;
  /** Hits remaining in the window, after this request would be recorded. */
  remaining: number;
}

/**
 * Check whether a (category, key) pair is allowed to make a request, and
 * if so, record the hit. Returns retry-after seconds when blocked.
 *
 * Categories are conventional strings — pick one per endpoint, e.g.
 * "brain-chat", "scrape-trigger". `key` is per-client (usually the
 * x-forwarded-for IP).
 */
export function checkRateLimit(
  category: string,
  key: string,
  opts: { windowMs: number; maxHits: number }
): RateLimitResult {
  const now = Date.now();
  const limiter = getOrCreateLimiter(category, opts.windowMs, opts.maxHits);
  const cutoff = now - limiter.windowMs;

  let bucket = limiter.buckets.get(key);
  if (!bucket) {
    if (limiter.buckets.size >= MAX_TRACKED_KEYS) {
      // Evict the oldest tracked key (insertion-order iteration).
      const firstKey = limiter.buckets.keys().next().value;
      if (firstKey !== undefined) limiter.buckets.delete(firstKey);
    }
    bucket = { hits: [] };
    limiter.buckets.set(key, bucket);
  } else {
    pruneOld(bucket, cutoff);
  }

  if (bucket.hits.length >= limiter.maxHits) {
    const oldest = bucket.hits[0];
    const unlockAt = oldest + limiter.windowMs;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((unlockAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, limiter.maxHits - bucket.hits.length),
  };
}

/**
 * Pull the client identifier from standard proxy headers. Matches the
 * convention in src/app/api/auth/login/route.ts.
 */
export function identifyClient(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Test-only — drops all rate-limit state. */
export function _resetRateLimitForTests(): void {
  limiters.clear();
}