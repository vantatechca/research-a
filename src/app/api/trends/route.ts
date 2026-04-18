export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Get trending data from ideas
  const [risingIdeas, decliningIdeas, recentIdeas, topCategories] = await Promise.all([
    prisma.idea.findMany({
      where: { googleTrendsDirection: "rising" },
      orderBy: { googleTrendsScore: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        peptideTopics: true,
        googleTrendsScore: true,
        googleTrendsDirection: true,
        redditMentionCount: true,
        youtubeVideoCount: true,
        priorityScore: true,
      },
    }),
    prisma.idea.findMany({
      where: { googleTrendsDirection: "declining" },
      orderBy: { googleTrendsScore: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        peptideTopics: true,
        googleTrendsScore: true,
        googleTrendsDirection: true,
      },
    }),
    prisma.idea.findMany({
      orderBy: { discoveredAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        discoverySource: true,
        priorityScore: true,
        discoveredAt: true,
      },
    }),
    prisma.idea.groupBy({
      by: ["category"],
      _count: { id: true },
      _avg: { priorityScore: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  // Get scrape activity for research pulse
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentScrapeCount = await prisma.scrapeLog.count({
    where: { startedAt: { gte: hourAgo } },
  });

  return NextResponse.json({
    rising: risingIdeas,
    declining: decliningIdeas,
    recentIdeas,
    topCategories,
    researchPulse: recentScrapeCount,
  });
}
