export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PATCHABLE_FIELDS = new Set<string>([
  "memoryType",
  "content",
  "source",
  "importance",
  "active",
  "relatedIdeaIds",
]);

function pickPatchable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (PATCHABLE_FIELDS.has(key)) out[key] = body[key];
  }
  return out;
}

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

export async function GET(req: NextRequest) {
  try {
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
  } catch (err) {
    console.error("[api/brain/memory] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Database unavailable", message }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.memoryType !== "string" || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "memoryType and content are required" },
        { status: 400 }
      );
    }

    const memory = await prisma.brainMemory.create({
      data: {
        memoryType: body.memoryType,
        content: body.content,
        source: typeof body.source === "string" ? body.source : "operator_note",
        // Use `??` so an explicit 0 importance is preserved instead of being
        // silently replaced by 0.5.
        importance: typeof body.importance === "number" ? body.importance : 0.5,
        relatedIdeaIds: Array.isArray(body.relatedIdeaIds)
          ? (body.relatedIdeaIds as string[])
          : [],
      },
    });
    return NextResponse.json(memory, { status: 201 });
  } catch (err) {
    console.error("[api/brain/memory] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not create memory", message }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data = pickPatchable(body);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const memory = await prisma.brainMemory.update({ where: { id }, data });
    return NextResponse.json(memory);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/brain/memory] PATCH failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not update memory", message }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await prisma.brainMemory.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/brain/memory] DELETE failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not delete memory", message }, { status: 503 });
  }
}