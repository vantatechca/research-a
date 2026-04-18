export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take: 50,
  });
  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const conversation = await prisma.conversation.create({
    data: {
      title: body.title,
      relatedIdeaId: body.relatedIdeaId,
    },
  });
  return NextResponse.json(conversation, { status: 201 });
}
