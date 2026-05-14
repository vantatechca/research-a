import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }   = await params;
  const adapter  = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma   = new PrismaClient({ adapter });

  try {
    const body     = await req.json();
    const { status, aiPlaybook } = body;

    const updated = await prisma.digitalOpportunity.update({
      where: { id },
      data:  {
        ...(status     ? { status }     : {}),
        ...(aiPlaybook ? { aiPlaybook } : {}),
      },
    });

    return NextResponse.json(updated);
  } finally {
    await prisma.$disconnect();
  }
}