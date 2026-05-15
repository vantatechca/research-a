import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NICHEIQ_URL = process.env.NICHEIQ_URL!;
const NICHEIQ_KEY = process.env.NICHEIQ_SERVICE_KEY!;
const MIN_SCORE = process.env.NICHEIQ_MIN_SCORE ?? "65";
const CRON_SECRET = process.env.CRON_SECRET!;

function extractPlatform(rationale?: string | null): string | null {
  if (!rationale) return null;
  const match = rationale.match(/via\s+(\w+)\./i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function fetchNiche(niche: string) {
  // Normalize: "ai prompt pack" → "ai_prompt_pack" to match nicheiq's format
  const normalizedNiche = niche.toLowerCase().replace(/\s+/g, '_');
  const params = new URLSearchParams({ niche: normalizedNiche, minScore: MIN_SCORE, limit: "20" });
  const res = await fetch(`${NICHEIQ_URL}/api/service/opportunities?${params}`, {
    headers: { Authorization: `Bearer ${NICHEIQ_KEY}` },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) { console.warn(`  [${niche}] fetch failed: ${res.status}`); return []; }
  const { opportunities } = await res.json();
  return opportunities ?? [];
}

export async function POST(req: Request) {
  // Auth: only allow with the cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
    where: { active: true },
    select: { niche: true },
  });
  const niches = [...new Set(sites.map((s) => s.niche))];

  let inserted = 0;
  let skipped = 0;

  for (const niche of niches) {
    try {
      const opps = await fetchNiche(niche);
      for (const opp of opps) {
        const exists = await prisma.digitalOpportunity.findUnique({ where: { id: opp.id } });
        if (exists) {
          skipped++;
          continue;
        }
        const platform = opp.sourcePlatform ?? extractPlatform(opp.aiRationale) ?? "unknown";
        await prisma.digitalOpportunity.create({
          data: {
            id: opp.id,
            title: opp.title ?? "Untitled",
            score: opp.score ?? 0,
            category: opp.opportunityType ?? "unknown",
            niche: opp.niche ?? niche,
            platform,
            sourceUrl: opp.sourceUrl ?? null,
            summary: opp.summary ?? null,
            rawData: opp,
            status: "QUEUED",
          },
        });
        inserted++;
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.warn(`[${niche}] error:`, e);
    }
  }

  return NextResponse.json({ 
  inserted, 
  skipped, 
  niches: niches.length,
  sampleNiches: niches.slice(0, 10),
  sampleNormalized: niches.slice(0, 10).map(n => n.toLowerCase().replace(/\s+/g, '_'))
});
}