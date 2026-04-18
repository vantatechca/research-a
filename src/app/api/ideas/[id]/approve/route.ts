export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { notes } = await req.json();

  const idea = await prisma.idea.update({
    where: { id },
    data: {
      status: "approved",
      approvalNotes: notes || null,
      statusChangedAt: new Date(),
      operatorNotes: notes ? { push: `[APPROVED] ${notes}` } : undefined,
    },
  });

  // Extract learnings from approval notes and store as brain memory
  if (notes) {
    await prisma.brainMemory.create({
      data: {
        memoryType: "operator_note",
        content: `Approved idea "${idea.title}": ${notes}`,
        source: "approve_learning",
        importance: 0.6,
        relatedIdeaIds: [id],
      },
    });
  }

  return NextResponse.json(idea);
}
