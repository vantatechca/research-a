export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const archivedParam = searchParams.get("archived");

    // archivedParam: null/undefined = active only (default)
    //                "true"          = archived only
    //                "all"           = both
    const where: Record<string, unknown> = {};
    if (archivedParam === "true") {
      where.archived = true;
    } else if (archivedParam !== "all") {
      where.archived = false;
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("[api/conversations] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Database unavailable", message },
      { status: 503 }
    );
  }
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
