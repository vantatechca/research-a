export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sources = await prisma.monitoredSource.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const source = await prisma.monitoredSource.create({
    data: {
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      sourceName: body.sourceName,
      checkFreqHours: body.checkFreqHours || 4,
    },
  });
  return NextResponse.json(source, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
  const source = await prisma.monitoredSource.update({ where: { id }, data });
  return NextResponse.json(source);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.monitoredSource.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
