export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { generateEmbedding } from "@/lib/embeddings/client";
import {
  findSimilarIdea,
  markAsDuplicate,
  saveEmbedding,
} from "@/lib/embeddings/dedup";

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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
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
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { subcategory: { contains: search, mode: "insensitive" } },
        { peptideTopics: { has: search.toLowerCase() } },
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
    // We compute the embedding BEFORE creating the row so we can decide
    // whether to mark the new idea as a duplicate atomically. If embedding
    // fails (e.g. provider down), we fall back to creating without one —
    // the idea still goes in, just without dedup protection.
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

    // Find the closest existing idea in the same category, if any
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

    // Create the idea (with duplicateOfId set if we found a match)
    const idea = await withTimeout(
      prisma.idea.create({
        data: {
          ...data,
          duplicateOfId: duplicateMatch?.id ?? null,
        } as Prisma.IdeaUncheckedCreateInput,
      }),
      10_000,
      "ideas.create"
    );

    // Persist the embedding (raw SQL — Prisma can't bind vector type)
    if (embedding) {
      try {
        await saveEmbedding(idea.id, embedding);
      } catch (err) {
        console.warn(
          `[api/ideas] failed to save embedding for ${idea.id}:`,
          err
        );
      }
    }

    // If we marked it as a duplicate, bump the original's counter
    if (duplicateMatch) {
      try {
        await markAsDuplicate({
          newIdeaId: idea.id,
          originalId: duplicateMatch.id,
        });
        console.log(
          `[api/ideas] new idea ${idea.id} marked duplicate of ${duplicateMatch.id} ` +
            `(similarity ${duplicateMatch.similarity.toFixed(3)})`
        );
      } catch (err) {
        console.warn(
          `[api/ideas] failed to bump duplicate counter on ${duplicateMatch.id}:`,
          err
        );
      }
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