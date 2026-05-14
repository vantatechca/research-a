import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const niche  = searchParams.get("niche")  ?? undefined;

  const opps = await prisma.digitalOpportunity.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(niche  ? { niche  } : {}),
    },
    orderBy: { score: "desc" },
    take: 200,
  });

  return NextResponse.json(opps);
}