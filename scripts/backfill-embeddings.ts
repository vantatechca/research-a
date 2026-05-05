/**
 * Phase 2a eager backfill (v3 — uses DB-stored embeddings for Pass 2).
 *
 * Two-pass over your ideas table:
 *   Pass 1: embed any ideas that don't yet have an embedding column populated.
 *   Pass 2: SCAN existing embeddings in the DB (no re-embedding!) and link
 *           pairs that cross the DUPE_THRESHOLD.
 *
 * v3 changes vs. earlier versions:
 *   - Pass 2 reads embeddings from the DB instead of re-generating them.
 *     Cuts API calls in half and eliminates Pass 2 timeouts.
 *   - Pass 1 retries timeouts up to 3 times with exponential backoff.
 *   - Threshold lowered to 0.90 to match observed similarity scores for
 *     short product titles.
 *
 * Run with:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Idempotent — safe to re-run.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── Setup ─────────────────────────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!databaseUrl) {
  console.error("[backfill] DATABASE_URL/DIRECT_URL not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const EMBEDDINGS_API_URL =
  process.env.EMBEDDINGS_API_URL ?? "https://api.openai.com/v1";
const EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const EMBEDDINGS_API_KEY = process.env.EMBEDDINGS_API_KEY;

// Tuned for short product titles per Phase 2a backfill data.
// Real duplicates score 0.905-0.92; raise if false positives appear.
const DUPE_THRESHOLD = 0.9;

const TIMEOUT_MS = 20_000; // bumped from 15s — embeddings sometimes spike
const MAX_INPUT_CHARS = 8000;
const MAX_RETRIES = 3;

if (!EMBEDDINGS_API_KEY) {
  console.error("[backfill] EMBEDDINGS_API_KEY not set in env");
  process.exit(1);
}

// ─── Embedding generation with retry ───────────────────────────────────────

async function generateEmbeddingOnce(text: string): Promise<number[]> {
  const input = text.trim().slice(0, MAX_INPUT_CHARS);
  if (input.length === 0) throw new Error("empty input");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${EMBEDDINGS_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EMBEDDINGS_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDINGS_MODEL, input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        /* not json */
      }
      const err = new Error(`Embedding API: ${detail}`);
      // Retryable: 5xx and 429
      (err as Error & { retryable?: boolean }).retryable =
        res.status >= 500 || res.status === 429;
      throw err;
    }

    const parsed = (await res.json()) as { data: { embedding: number[] }[] };
    const vec = parsed.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== 1536) {
      throw new Error(`unexpected embedding shape (length=${vec?.length})`);
    }
    return vec;
  } finally {
    clearTimeout(timer);
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateEmbeddingOnce(text);
    } catch (err) {
      lastErr = err;
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const isRetryable =
        isTimeout ||
        (err as Error & { retryable?: boolean }).retryable === true;

      if (!isRetryable || attempt === MAX_RETRIES) throw err;

      const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

// ─── DB helpers ────────────────────────────────────────────────────────────

interface RawIdea {
  id: string;
  title: string;
  summary: string;
  category: string;
  has_embedding: boolean;
  duplicate_of_id: string | null;
}

async function listIdeas(): Promise<RawIdea[]> {
  return await prisma.$queryRawUnsafe<RawIdea[]>(`
    SELECT
      id::text AS id,
      title,
      summary,
      category,
      embedding IS NOT NULL AS has_embedding,
      duplicate_of_id::text AS duplicate_of_id
    FROM ideas
    ORDER BY discovered_at ASC
  `);
}

async function saveEmbedding(ideaId: string, embedding: number[]): Promise<void> {
  const vectorLit = toVectorLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE ideas SET embedding = $1::vector WHERE id = $2::uuid`,
    vectorLit,
    ideaId
  );
}

async function markAsDuplicate(newIdeaId: string, originalId: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `UPDATE ideas SET duplicate_of_id = $1::uuid WHERE id = $2::uuid`,
      originalId,
      newIdeaId
    ),
    prisma.$executeRawUnsafe(
      `UPDATE ideas SET duplicate_count = duplicate_count + 1 WHERE id = $1::uuid`,
      originalId
    ),
  ]);
}

// ─── Pass 1: embed everything that's missing an embedding ──────────────────

async function embedMissing(ideas: RawIdea[]): Promise<number> {
  const todo = ideas.filter((i) => !i.has_embedding);
  if (todo.length === 0) {
    console.log("[backfill] all ideas already embedded — skipping pass 1");
    return 0;
  }

  console.log(`[backfill] pass 1: embedding ${todo.length} ideas...`);
  let done = 0;
  let failed = 0;

  for (const idea of todo) {
    const text = `${idea.title}\n\n${idea.summary}`;
    try {
      const vec = await generateEmbedding(text);
      await saveEmbedding(idea.id, vec);
      done++;
      if (done % 10 === 0) console.log(`[backfill]   ${done}/${todo.length}...`);
    } catch (err) {
      failed++;
      console.warn(`[backfill]   failed ${idea.id} (${idea.title}):`, err);
    }
  }

  console.log(`[backfill] pass 1 done: embedded ${done}, failed ${failed}`);
  return done;
}

// ─── Pass 2: scan existing embeddings for duplicates (no re-embedding) ─────

interface DupePair {
  newer_id: string;
  newer_title: string;
  older_id: string;
  older_title: string;
  similarity: number;
}

async function detectDuplicatesSql(): Promise<DupePair[]> {
  // Single SQL query that finds all same-category pairs with similarity
  // above threshold. Uses HNSW index for speed. The `discovered_at`
  // comparison ensures we only emit each pair once and the OLDER row is
  // labeled "original".
  return await prisma.$queryRawUnsafe<DupePair[]>(`
    SELECT
      newer.id::text AS newer_id,
      newer.title AS newer_title,
      older.id::text AS older_id,
      older.title AS older_title,
      1 - (newer.embedding <=> older.embedding) AS similarity
    FROM ideas newer
    JOIN ideas older
      ON newer.category = older.category
     AND older.discovered_at < newer.discovered_at
     AND older.embedding IS NOT NULL
     AND older.duplicate_of_id IS NULL
    WHERE newer.embedding IS NOT NULL
      AND newer.duplicate_of_id IS NULL
      AND 1 - (newer.embedding <=> older.embedding) >= ${DUPE_THRESHOLD}
    ORDER BY similarity DESC
  `);
}

async function pass2(): Promise<number> {
  console.log("[backfill] pass 2: scanning embeddings for duplicates...");
  const pairs = await detectDuplicatesSql();
  console.log(`[backfill]   found ${pairs.length} candidate pair(s)`);

  if (pairs.length === 0) {
    console.log(
      `[backfill]   no pairs above threshold ${DUPE_THRESHOLD} — done.`
    );
    return 0;
  }

  // It's possible the same `newer` shows up paired with multiple older
  // candidates. Take the highest-similarity match per newer id only.
  const seen = new Set<string>();
  const linked: DupePair[] = [];
  for (const p of pairs) {
    if (seen.has(p.newer_id)) continue;
    seen.add(p.newer_id);
    linked.push(p);
  }

  for (const p of linked) {
    try {
      await markAsDuplicate(p.newer_id, p.older_id);
      console.log(
        `[backfill]   linked "${p.newer_title.slice(0, 40)}" → ` +
          `"${p.older_title.slice(0, 40)}" (${p.similarity.toFixed(3)})`
      );
    } catch (err) {
      console.warn(`[backfill]   failed to link ${p.newer_id}:`, err);
    }
  }

  console.log(`[backfill] pass 2 done: linked ${linked.length} pair(s)`);
  return linked.length;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("[backfill] starting Phase 2a backfill (v3)...");
  console.log(`[backfill]   threshold: ${DUPE_THRESHOLD}`);

  const ideas = await listIdeas();
  console.log(`[backfill] found ${ideas.length} total ideas`);

  await embedMissing(ideas);
  await pass2();

  console.log("[backfill] all done");
}

main()
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });