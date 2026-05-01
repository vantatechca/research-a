export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reason } = (await req.json()) as { reason?: string };
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";

    if (!trimmedReason) {
      return NextResponse.json(
        { error: "Decline reason is required" },
        { status: 400 }
      );
    }

    // Atomic: idea update + brain memory in one transaction.
    const idea = await prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: {
          status: "declined",
          declineReason: trimmedReason,
          statusChangedAt: new Date(),
          operatorNotes: { push: `[DECLINED] ${trimmedReason}` },
        },
      });

      await tx.brainMemory.create({
        data: {
          memoryType: "operator_note",
          content: `Declined idea "${updated.title}": ${trimmedReason}`,
          source: "decline_learning",
          importance: 0.7,
          relatedIdeaIds: [id],
        },
      });

      return updated;
    });

    return NextResponse.json(idea);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/ideas/:id/decline] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not decline idea", message }, { status: 503 });
  }
}