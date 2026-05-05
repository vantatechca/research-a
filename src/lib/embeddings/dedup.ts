/**
 * Semantic deduplication for Idea (Phase 2a).
 *
 * Workflow:
 *   1. Caller generates an embedding for a candidate idea.
 *   2. Caller calls findSimilarIdea() to look for a near-match in the DB.
 *   3. If a match comes back with similarity >= DUPE_THRESHOLD, the caller
 *      should mark the new idea as a duplicate of the match.
 *
 * Why category-scoped: same-category similarity is what we care about. A
 * "course" idea and an "ebook" idea with similar wording are NOT duplicates
 * — they're different products even if they cover the same topic.
 */

import { prisma } from "@/lib/db";
import { toVectorLiteral } from "./client";

/**
 * Cosine similarity threshold for marking an idea as a duplicate.
 * 0.95 = "nearly identical meaning", validated empirically with peptide
 * product titles. Tunable; if false positives are too high, raise to 0.96-0.97.
 */
export const DUPE_THRESHOLD = 0.95;

export interface SimilarMatch {
  id: string;
  title: string;
  category: string;
  similarity: number;
}

/**
 * Find the most semantically similar existing idea in the same category.
 * Excludes ideas that are themselves duplicates (we always point new dupes
 * at the canonical original, not at another duplicate).
 *
 * Returns null if nothing crosses DUPE_THRESHOLD.
 */
export async function findSimilarIdea(params: {
  embedding: number[];
  category: string;
  /** Optional: exclude this id (used during backfill to skip self-match). */
  excludeId?: string;
}): Promise<SimilarMatch | null> {
  const { embedding, category, excludeId } = params;
  const vectorLit = toVectorLiteral(embedding);

  // Raw SQL because Prisma's query layer can't express the <=> operator.
  // 1 - (a <=> b) = cosine similarity; <=> alone is cosine DISTANCE.
  // Using LIMIT 1 + the HNSW index keeps this <10ms even at 100k+ rows.
  const rows = await prisma.$queryRawUnsafe<
    { id: string; title: string; category: string; similarity: number }[]
  >(
    `
    SELECT
      id::text AS id,
      title,
      category,
      1 - (embedding <=> $1::vector) AS similarity
    FROM ideas
    WHERE embedding IS NOT NULL
      AND category = $2
      AND duplicate_of_id IS NULL
      ${excludeId ? "AND id <> $3::uuid" : ""}
    ORDER BY embedding <=> $1::vector
    LIMIT 1
    `,
    vectorLit,
    category,
    ...(excludeId ? [excludeId] : [])
  );

  const match = rows[0];
  if (!match) return null;
  if (match.similarity < DUPE_THRESHOLD) return null;

  return {
    id: match.id,
    title: match.title,
    category: match.category,
    similarity: match.similarity,
  };
}

/**
 * After confirming `newIdeaId` is a duplicate of `originalId`, run this to
 * 1) link the new idea, and 2) bump the original's duplicate counter.
 *
 * Wrapped in a transaction because both updates need to land or neither.
 */
export async function markAsDuplicate(params: {
  newIdeaId: string;
  originalId: string;
}): Promise<void> {
  const { newIdeaId, originalId } = params;
  await prisma.$transaction([
    prisma.idea.update({
      where: { id: newIdeaId },
      data: { duplicateOfId: originalId },
    }),
    prisma.idea.update({
      where: { id: originalId },
      data: { duplicateCount: { increment: 1 } },
    }),
  ]);
}

/**
 * Persist an embedding for an idea via raw SQL.
 * Prisma's Unsupported("vector") type doesn't accept number[] through normal
 * .update() — it would try to bind it as JSON. Raw SQL with the literal
 * format is the supported workaround.
 */
export async function saveEmbedding(ideaId: string, embedding: number[]): Promise<void> {
  const vectorLit = toVectorLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE ideas SET embedding = $1::vector WHERE id = $2::uuid`,
    vectorLit,
    ideaId
  );
}