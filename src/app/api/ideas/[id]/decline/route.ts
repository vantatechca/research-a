export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = await req.json();

  if (!reason) {
    return NextResponse.json({ error: "Decline reason is required" }, { status: 400 });
  }

  const idea = await prisma.idea.update({
    where: { id },
    data: {
      status: "declined",
      declineReason: reason,
      statusChangedAt: new Date(),
      operatorNotes: { push: `[DECLINED] ${reason}` },
    },
  });

  // Store decline learning as brain memory
  await prisma.brainMemory.create({
    data: {
      memoryType: "operator_note",
      content: `Declined idea "${idea.title}": ${reason}`,
      source: "decline_learning",
      importance: 0.7,
      relatedIdeaIds: [id],
    },
  });

  return NextResponse.json(idea);
}
