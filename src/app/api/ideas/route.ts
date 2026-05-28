export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { generateEmbedding, toVectorLiteral } from "@/lib/embeddings/client";
import { findSimilarIdea } from "@/lib/embeddings/dedup";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "priority_score";
    const order = searchParams.get("order") || "desc";
    // Clamp pagination. parseInt returns NaN on garbage, and NaN || 50 → 50,
    // so the falsy fallback handles the bad-input case. Cap limit at 200 to
    // protect Postgres + JSON serialization.
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    const search = searchParams.get("search");
    // Phase 2a: by default, hide ideas marked as duplicates of others.
    // Pass ?includeDuplicates=true to see everything (used for debugging
    // and for any "view duplicates" UI we add later).
    const includeDuplicates = searchParams.get("includeDuplicates") === "true";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (!includeDuplicates) where.duplicateOfId = null;
    if (search) {
      // peptideTopics is a String[] in Postgres — `has` is case-sensitive
      // exact match. Stored topics are mixed-case ("BPC-157", "GLP-1") so
      // we send both the raw and lowercased needle through `hasSome` to
      // catch either casing without normalizing at write time.
      const topicCandidates = Array.from(new Set([search, search.toLowerCase(), search.toUpperCase()]));
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { subcategory: { contains: search, mode: "insensitive" } },
        { peptideTopics: { hasSome: topicCandidates } },
      ];
    }

    const orderByField =
      sort === "priority_score"
        ? "priorityScore"
        : sort === "discovered_at"
          ? "discoveredAt"
          : sort === "reddit_mention_count"
            ? "redditMentionCount"
            : "priorityScore";

    const [ideas, total] = await withTimeout(
      Promise.all([
        prisma.idea.findMany({
          where,
          orderBy: { [orderByField]: order === "asc" ? "asc" : "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.idea.count({ where }),
      ]),
      8000,
      "ideas.findMany+count"
    );

    return NextResponse.json({ ideas, total, limit, offset });
  } catch (err) {
    console.error("[api/ideas] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Database unavailable", message, ideas: [], total: 0 },
      { status: 503 }
    );
  }
}

// Whitelist of fields the client may set when creating an idea. Without
// this, `data: body` would accept arbitrary keys including `id`, `createdAt`,
// or another idea's `slug`, letting any caller forge fields.
const CREATABLE_FIELDS = new Set<string>([
  "title",
  "slug",
  "summary",
  "detailedAnalysis",
  "category",
  "subcategory",
  "peptideTopics",
  "status",
  "priorityScore",
  "confidenceScore",
  "googleTrendsScore",
  "googleTrendsDirection",
  "redditMentionCount",
  "redditQuestionCount",
  "youtubeVideoCount",
  "youtubeAvgViews",
  "forumMentionCount",
  "etsyCompetitorCount",
  "etsyAvgPrice",
  "etsyAvgReviews",
  "whopCompetitorCount",
  "searchVolumeMonthly",
  "existingProducts",
  "competitorAnalysis",
  "differentiationNotes",
  "estimatedPriceRange",
  "estimatedMonthlyRev",
  "effortToBuild",
  "timeToBuild",
  "sourceLinks",
  "discoverySource",
  "operatorNotes",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (CREATABLE_FIELDS.has(key)) data[key] = body[key];
    }

    if (
      typeof data.title !== "string" ||
      typeof data.slug !== "string" ||
      typeof data.summary !== "string" ||
      typeof data.category !== "string"
    ) {
      return NextResponse.json(
        { error: "title, slug, summary, and category are required" },
        { status: 400 }
      );
    }

    // ─── Phase 2a: generate embedding + check for duplicates ─────────────
    // We compute the embedding BEFORE the transaction so a slow embedding
    // provider doesn't hold a DB transaction open. If embedding fails we
    // fall back to inserting without one — the idea goes in, just without
    // dedup protection on this row.
    const dedupText = `${data.title}\n\n${data.summary}`;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(dedupText);
    } catch (err) {
      console.warn(
        "[api/ideas] embedding generation failed, creating without dedup:",
        err
      );
    }

    let duplicateMatch: { id: string; title: string; similarity: number } | null = null;
    if (embedding) {
      try {
        duplicateMatch = await findSimilarIdea({
          embedding,
          category: data.category as string,
        });
      } catch (err) {
        console.warn("[api/ideas] dedup query failed, proceeding:", err);
      }
    }

    // Single transaction: create the idea (with duplicateOfId already set),
    // store the embedding via raw SQL, and bump the canonical idea's counter
    // in one atomic block. Previous behavior split these into three separate
    // calls — partial failures left the embedding-missing or the counter
    // out of sync with the dupe link.
    const idea = await withTimeout(
      prisma.$transaction(async (tx) => {
        const created = await tx.idea.create({
          data: {
            ...data,
            duplicateOfId: duplicateMatch?.id ?? null,
          } as Prisma.IdeaUncheckedCreateInput,
        });

        if (embedding) {
          await tx.$executeRawUnsafe(
            `UPDATE ideas SET embedding = $1::vector WHERE id = $2::uuid`,
            toVectorLiteral(embedding),
            created.id
          );
        }

        if (duplicateMatch) {
          await tx.idea.update({
            where: { id: duplicateMatch.id },
            data: { duplicateCount: { increment: 1 } },
          });
        }

        return created;
      }),
      10_000,
      "ideas.create+dedup"
    );

    if (duplicateMatch) {
      console.log(
        `[api/ideas] new idea ${idea.id} marked duplicate of ${duplicateMatch.id} ` +
          `(similarity ${duplicateMatch.similarity.toFixed(3)})`
      );
    }

    return NextResponse.json(
      {
        ...idea,
        duplicateOfId: duplicateMatch?.id ?? null,
        // Include a hint so the client can show "marked as duplicate" UX
        ...(duplicateMatch && {
          _dedup: {
            duplicateOf: {
              id: duplicateMatch.id,
              title: duplicateMatch.title,
              similarity: duplicateMatch.similarity,
            },
          },
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/ideas] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Could not create idea", message },
      { status: 503 }
    );
  }
}