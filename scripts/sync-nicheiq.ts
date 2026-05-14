import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

const NICHEIQ_URL = process.env.NICHEIQ_URL!;
const NICHEIQ_KEY = process.env.NICHEIQ_SERVICE_KEY!;
const MIN_SCORE   = process.env.NICHEIQ_MIN_SCORE ?? "65";

function extractPlatform(rationale?: string | null): string | null {
  if (!rationale) return null;
  const match = rationale.match(/via\s+(\w+)\./i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function fetchNiche(niche: string) {
  const params = new URLSearchParams({ niche, minScore: MIN_SCORE, limit: "20" });
  const res = await fetch(`${NICHEIQ_URL}/api/service/opportunities?${params}`, {
    headers: { Authorization: `Bearer ${NICHEIQ_KEY}` },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) { console.warn(`  [${niche}] fetch failed: ${res.status}`); return []; }
  const { opportunities } = await res.json();
  return opportunities ?? [];
}

async function sync() {
  if (!NICHEIQ_URL || !NICHEIQ_KEY) {
    console.error("Missing NICHEIQ_URL or NICHEIQ_SERVICE_KEY");
    process.exit(1);
  }

  const sites  = await prisma.site.findMany({ where: { active: true }, select: { niche: true } });
  const niches = [...new Set(sites.map((s) => s.niche))];
  console.log(`[sync] Syncing ${niches.length} niches from NicheIQ\n`);

  let inserted = 0;
  let skipped  = 0;

  for (const niche of niches) {
    try {
      const opps = await fetchNiche(niche);
      if (opps.length === 0) continue;

      for (const opp of opps) {
        const exists = await prisma.digitalOpportunity.findUnique({ where: { id: opp.id } });
        if (exists) { skipped++; continue; }

        const platform = opp.sourcePlatform ?? extractPlatform(opp.aiRationale) ?? "unknown";

        await prisma.digitalOpportunity.create({
          data: {
            id:        opp.id,
            title:     opp.title           ?? "Untitled",
            score:     opp.score           ?? 0,
            category:  opp.opportunityType ?? "unknown",
            niche:     opp.niche           ?? niche,
            platform,
            sourceUrl: opp.sourceUrl       ?? null,
            summary:   opp.summary         ?? null,
            rawData:   opp,
            status:    "QUEUED",
          },
        });

        inserted++;
        console.log(`  ✓ [${niche}] ${opp.title?.slice(0, 55)} [${platform}]`);
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.warn(`  [${niche}] error:`, e);
    }
  }

  console.log(`\n[sync] Done — inserted: ${inserted} | skipped: ${skipped}`);
  await prisma.$disconnect();
}

sync().catch((e) => { console.error(e); process.exit(1); });