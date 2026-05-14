import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

export async function GET() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });

  try {
    const sites = await prisma.site.findMany({
      where:   { active: true },
      orderBy: { niche: "asc" },
    });

    const nicheCounts = await prisma.digitalOpportunity.groupBy({
      by:     ["niche"],
      where:  { status: { in: ["QUEUED", "RESEARCHING", "VALIDATED"] } },
      _count: { id: true },
    });

    const countMap = new Map(nicheCounts.map((n) => [n.niche, n._count.id]));

    const result = sites.map((s) => ({
      ...s,
      queuedCount: countMap.get(s.niche) ?? 0,
    }));

    return NextResponse.json(result);
  } finally {
    await prisma.$disconnect();
  }
}