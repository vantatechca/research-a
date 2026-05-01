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
    const { notes } = (await req.json()) as { notes?: string | null };
    const trimmedNotes = typeof notes === "string" ? notes.trim() : "";

    // Atomic: status update + brain memory in one transaction. Previously the
    // two writes were sequential — if the second failed, the idea was marked
    // approved with no learning recorded.
    const idea = await prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: {
          status: "approved",
          approvalNotes: trimmedNotes || null,
          statusChangedAt: new Date(),
          operatorNotes: trimmedNotes
            ? { push: `[APPROVED] ${trimmedNotes}` }
            : undefined,
        },
      });

      if (trimmedNotes) {
        await tx.brainMemory.create({
          data: {
            memoryType: "operator_note",
            content: `Approved idea "${updated.title}": ${trimmedNotes}`,
            source: "approve_learning",
            importance: 0.6,
            relatedIdeaIds: [id],
          },
        });
      }

      return updated;
    });

    return NextResponse.json(idea);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/ideas/:id/approve] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not approve idea", message }, { status: 503 });
  }
}