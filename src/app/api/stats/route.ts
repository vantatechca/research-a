export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalIdeas,
      pendingIdeas,
      approvedIdeas,
      declinedIdeas,
      launchedIdeas,
      inProgressIdeas,
      todayDiscoveries,
      totalMemories,
      goldenRules,
      recentScrapes,
      topTrending,
    ] = await Promise.all([
      prisma.idea.count(),
      prisma.idea.count({ where: { status: "pending" } }),
      prisma.idea.count({ where: { status: "approved" } }),
      prisma.idea.count({ where: { status: "declined" } }),
      prisma.idea.count({ where: { status: "launched" } }),
      prisma.idea.count({ where: { status: "in_progress" } }),
      prisma.idea.count({ where: { discoveredAt: { gte: dayAgo } } }),
      prisma.brainMemory.count({ where: { active: true } }),
      prisma.brainMemory.count({ where: { memoryType: "golden_rule", active: true } }),
      prisma.scrapeLog.count({ where: { startedAt: { gte: dayAgo } } }),
      prisma.idea.findFirst({
        where: { googleTrendsDirection: "rising" },
        orderBy: { googleTrendsScore: "desc" },
        select: { peptideTopics: true, title: true },
      }),
    ]);

    // Use `??` not `||` so an empty-string topic is still preferred over the
    // title fallback.
    const topTrendingTopic =
      (topTrending?.peptideTopics?.[0] ?? topTrending?.title) ?? null;

    return NextResponse.json({
      totalIdeas,
      pendingIdeas,
      approvedIdeas,
      declinedIdeas,
      launchedIdeas,
      inProgressIdeas,
      todayDiscoveries,
      totalMemories,
      goldenRules,
      recentScrapes,
      topTrendingTopic,
    });
  } catch (err) {
    console.error("[api/stats] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Database unavailable", message },
      { status: 503 }
    );
  }
}