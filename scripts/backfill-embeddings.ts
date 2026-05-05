/**
 * Phase 2a eager backfill.
 *
 * One-shot script: embeds every existing Idea that doesn't yet have an
 * embedding, then scans the result set for already-existing duplicates
 * within each category and links them.
 *
 * Run with:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Or, if tsx isn't installed, you can run it through ts-node or after
 * compiling. tsx is recommended; install with `npm i -D tsx`.
 *
 * Safe to re-run — only embeds rows where embedding IS NULL, and only
 * marks duplicates that aren't already linked. Idempotent.
 *
 * Cost (text-embedding-3-small @ $0.02 / 1M tokens):
 *   ~150 tokens per idea × 119 ideas ≈ 17,850 tokens ≈ $0.0004
 */

import { PrismaClient } from "../src/generated/prisma";
import { generateEmbedding } from "../src/lib/embeddings/client";
import {
  DUPE_THRESHOLD,
  findSimilarIdea,
  markAsDuplicate,
  saveEmbedding,
} from "../src/lib/embeddings/dedup";

const prisma = new PrismaClient();

interface RawIdea {
  id: string;
  title: string;
  summary: string;
  category: string;
  has_embedding: boolean;
  duplicate_of_id: string | null;
}

async function listIdeas(): Promise<RawIdea[]> {
  // Raw SQL because Prisma can't tell us whether the vector column is null
  // through normal findMany — it skips Unsupported types entirely.
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

async function embedMissing(ideas: RawIdea[]): Promise<number> {
  const todo = ideas.filter((i) => !i.has_embedding);
  if (todo.length === 0) {
    console.log("[backfill] all ideas already embedded — skipping embed step");
    return 0;
  }

  console.log(`[backfill] embedding ${todo.length} ideas...`);
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
      console.warn(`[backfill]   failed for ${idea.id} (${idea.title}):`, err);
    }
  }

  console.log(`[backfill] embedded ${done} ideas (${failed} failed)`);
  return done;
}

async function detectExistingDupes(ideas: RawIdea[]): Promise<number> {
  // For each idea that's NOT already linked as a duplicate, look for an
  // older same-category idea that's semantically nearly identical.
  // "Older" = lower discoveredAt, so we always treat the earliest as the
  // canonical original.
  const candidates = ideas.filter((i) => !i.duplicate_of_id);
  console.log(`[backfill] scanning ${candidates.length} ideas for duplicates...`);

  let linked = 0;

  for (const idea of candidates) {
    // Re-embed on the fly. We could cache from embedMissing() but the cost
    // is negligible and this keeps the script linear and restart-safe.
    let embedding: number[];
    try {
      embedding = await generateEmbedding(`${idea.title}\n\n${idea.summary}`);
    } catch (err) {
      console.warn(`[backfill]   embed failed for ${idea.id}:`, err);
      continue;
    }

    const match = await findSimilarIdea({
      embedding,
      category: idea.category,
      excludeId: idea.id,
    });

    if (match && match.similarity >= DUPE_THRESHOLD) {
      // Only mark as dupe if the match is OLDER (lower id-by-time isn't
      // reliable since UUIDs aren't sortable; use discoveredAt instead).
      const matchRow = ideas.find((i) => i.id === match.id);
      const candidateRow = idea;
      if (matchRow && matchRow.id !== candidateRow.id) {
        // Determine "older": match the one created first.
        // Order in `ideas` is ASC by discoveredAt, so whichever appears
        // first in the array is older.
        const matchIdx = ideas.findIndex((i) => i.id === match.id);
        const candIdx = ideas.findIndex((i) => i.id === idea.id);
        const original = matchIdx < candIdx ? match.id : idea.id;
        const dupe = matchIdx < candIdx ? idea.id : match.id;

        try {
          await markAsDuplicate({ newIdeaId: dupe, originalId: original });
          linked++;
          console.log(
            `[backfill]   linked ${dupe.slice(0, 8)} → ${original.slice(0, 8)} ` +
              `(${match.similarity.toFixed(3)})`
          );
        } catch (err) {
          console.warn(`[backfill]   failed to link ${dupe}:`, err);
        }
      }
    }
  }

  console.log(`[backfill] linked ${linked} duplicate pair(s)`);
  return linked;
}

async function main() {
  console.log("[backfill] starting Phase 2a eager backfill...");

  const ideas = await listIdeas();
  console.log(`[backfill] found ${ideas.length} total ideas`);

  await embedMissing(ideas);

  // Re-fetch after embedding so duplicate detection sees the new vectors.
  const updated = await listIdeas();
  await detectExistingDupes(updated);

  console.log("[backfill] done");
}

main()
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });