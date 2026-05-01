export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Whitelist of fields the client may update. Without this, `data: body`
// would accept arbitrary keys (id, createdAt, slug, etc.) and let any caller
// overwrite primary keys or break invariants.
const PATCHABLE_FIELDS = new Set<string>([
  "title",
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
  "declineReason",
  "approvalNotes",
]);

function pickPatchable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (PATCHABLE_FIELDS.has(key)) out[key] = body[key];
  }
  return out;
}

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idea = await prisma.idea.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });
    if (!idea) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(idea);
  } catch (err) {
    console.error("[api/ideas/:id] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Database unavailable", message }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const data = pickPatchable(body);
    if (data.status) {
      data.statusChangedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const idea = await prisma.idea.update({ where: { id }, data });
    return NextResponse.json(idea);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/ideas/:id] PATCH failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not update idea", message }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.idea.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/ideas/:id] DELETE failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not delete idea", message }, { status: 503 });
  }
}