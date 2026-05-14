import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }  = await params;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });
  try {
    const { month, sales, revenue, views, favorites } = await req.json();
    const perf = await prisma.productPerformance.upsert({
      where:  { productId_month: { productId: id, month } },
      update: { sales, revenue, views, favorites },
      create: { productId: id, month, sales, revenue, views, favorites },
    });
    return NextResponse.json(perf);
  } finally {
    await prisma.$disconnect();
  }
}