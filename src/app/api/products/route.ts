import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

export async function GET() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });
  try {
    const products = await prisma.product.findMany({
      where:   { status: { not: "REMOVED" } },
      include: { site: true, performance: { orderBy: { month: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });
  try {
    const { opportunityId, siteId, title, price, category } = await req.json();
    const product = await prisma.product.create({
      data: {
        siteId,
        title,
        price:       price ?? null,
        category:    category ?? "unknown",
        sourceOppId: opportunityId ?? null,
        status:      "LIVE",
        listedAt:    new Date(),
      },
    });
    if (opportunityId) {
      await prisma.digitalOpportunity.update({
        where: { id: opportunityId },
        data:  { status: "CONVERTED", usedInProduct: product.id },
      });
    }
    return NextResponse.json(product);
  } finally {
    await prisma.$disconnect();
  }
}