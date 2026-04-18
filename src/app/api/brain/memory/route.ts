export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = {};
  if (type) where.memoryType = type;
  if (activeOnly) where.active = true;

  const memories = await prisma.brainMemory.findMany({
    where,
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(memories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const memory = await prisma.brainMemory.create({
    data: {
      memoryType: body.memoryType,
      content: body.content,
      source: body.source || "operator_note",
      importance: body.importance || 0.5,
      relatedIdeaIds: body.relatedIdeaIds || [],
    },
  });
  return NextResponse.json(memory, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
  const memory = await prisma.brainMemory.update({ where: { id }, data });
  return NextResponse.json(memory);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.brainMemory.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
