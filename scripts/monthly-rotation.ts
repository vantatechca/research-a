import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

const NICHEIQ_URL      = process.env.NICHEIQ_URL!;
const NICHEIQ_KEY      = process.env.NICHEIQ_SERVICE_KEY!;
const ROTATION_PERCENT = 0.10;
const NEW_PER_SITE     = 5;

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

function perfScore(perf: { revenue: number; sales: number; views: number }[]) {
  if (!perf.length) return 0;
  return perf
    .slice(-2)
    .reduce((sum, p) => sum + p.revenue * 2 + p.sales * 10 + p.views * 0.1, 0);
}

async function fetchNewOpps(niche: string, exclude: string[], count: number) {
  const params = new URLSearchParams({
    niche,
    minScore: "65",
    limit:    String(count),
    exclude:  exclude.join(","),
  });

  const res = await fetch(
    `${NICHEIQ_URL}/api/service/opportunities?${params}`,
    { headers: { Authorization: `Bearer ${NICHEIQ_KEY}` } }
  );

  if (!res.ok) throw new Error(`NicheIQ ${res.status}`);
  const { opportunities } = await res.json();
  return opportunities;
}

async function run() {
  const month = currentMonth();
  console.log(`\n=== Rotation — ${month} ===\n`);

  // Guard: only run once per month
const existing = await prisma.rotationCycle.findUnique({ where: { month } });
if (existing) {
  console.log("Already ran this month. Exiting.");
  await prisma.$disconnect();
  return;
}

  const sites = await prisma.site.findMany({ where: { active: true } });
  console.log(`Sites: ${sites.length}`);

  const entries: {
    siteId:        string;
    action:        string;
    productId?:    string;
    opportunityId?: string;
    reason?:       string;
  }[] = [];

  let totalLive    = 0;
  let flaggedCount = 0;
  let addedCount   = 0;

  for (const site of sites) {
    // ── Get live products with last 2 months performance
    const live = await prisma.product.findMany({
      where:   { siteId: site.id, status: "LIVE" },
      include: { performance: { orderBy: { month: "desc" }, take: 2 } },
    });

    totalLive += live.length;

    if (live.length > 0) {
      // ── Score and rank
      const scored = live
        .map((p) => ({ ...p, pScore: perfScore(p.performance) }))
        .sort((a, b) => a.pScore - b.pScore);

      // ── Flag bottom 10%
      const flagCount = Math.max(1, Math.floor(scored.length * ROTATION_PERCENT));
      const toFlag    = scored.slice(0, flagCount);

      for (const p of toFlag) {
        await prisma.product.update({
          where: { id: p.id },
          data:  {
            status:        "FLAGGED",
            removedAt:     new Date(),
            removalReason: `Bottom ${ROTATION_PERCENT * 100}% — score: ${p.pScore.toFixed(1)}`,
          },
        });

        entries.push({
          siteId:    site.id,
          action:    "REMOVED",
          productId: p.id,
          reason:    `perf ${p.pScore.toFixed(1)} — bottom ${flagCount}/${live.length}`,
        });

        flaggedCount++;
        console.log(`  [${site.niche}] FLAGGED: "${p.title}" (${p.pScore.toFixed(1)})`);
      }
    }

    // ── Pull fresh opportunities from NicheIQ for this niche
    const used = await prisma.digitalOpportunity.findMany({
      where:  { niche: site.niche, status: { in: ["CONVERTED", "DISMISSED"] } },
      select: { id: true },
    });

    try {
      const newOpps = await fetchNewOpps(
        site.niche,
        used.map((o) => o.id),
        NEW_PER_SITE
      );

      for (const opp of newOpps) {
        await prisma.digitalOpportunity.upsert({
          where:  { id: opp.id },
          update: { score: opp.score },
          create: {
            id:        opp.id,
            title:     opp.title            ?? "Untitled",
            score:     opp.score            ?? 0,
            category:  opp.opportunityType  ?? "unknown",
            niche:     site.niche,
            platform:  opp.sourcePlatform   ?? "unknown",
            sourceUrl: opp.sourceUrl        ?? null,
            summary:   opp.summary          ?? null,
            rawData:   opp,
            status:    "QUEUED",
          },
        });

        entries.push({
          siteId:        site.id,
          action:        "ADDED",
          opportunityId: opp.id,
        });

        addedCount++;
        console.log(`  [${site.niche}] QUEUED: "${opp.title}" (${opp.score})`);
      }
    } catch (e) {
      console.error(`  [${site.niche}] NicheIQ fetch failed:`, e);
    }
  }

  // ── Write rotation record
const cycle = await prisma.rotationCycle.upsert({
  where:  { month },
  update: { totalLive, flaggedCount, addedCount },
  create: {
    month,
    totalLive,
    flaggedCount,
    addedCount,
    entries: { create: entries },
  },
});

  console.log(`\n=== Done ===`);
  console.log(`Live:    ${totalLive}`);
  console.log(`Flagged: ${flaggedCount}`);
  console.log(`Added:   ${addedCount}`);
  console.log(`Cycle:   ${cycle.id}`);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});