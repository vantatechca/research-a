export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PATCHABLE_FIELDS = new Set<string>([
  "sourceType",
  "sourceUrl",
  "sourceName",
  "checkFreqHours",
  "lastCheckedAt",
  "active",
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

export async function GET() {
  try {
    const sources = await prisma.monitoredSource.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sources);
  } catch (err) {
    console.error("[api/settings/sources] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Database unavailable", message }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.sourceType !== "string" || typeof body.sourceName !== "string") {
      return NextResponse.json(
        { error: "sourceType and sourceName are required" },
        { status: 400 }
      );
    }

    const source = await prisma.monitoredSource.create({
      data: {
        sourceType: body.sourceType,
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        sourceName: body.sourceName,
        checkFreqHours:
          typeof body.checkFreqHours === "number" ? body.checkFreqHours : 4,
      },
    });
    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    console.error("[api/settings/sources] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not create source", message }, { status: 503 });
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

    const source = await prisma.monitoredSource.update({ where: { id }, data });
    return NextResponse.json(source);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/settings/sources] PATCH failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not update source", message }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await prisma.monitoredSource.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[api/settings/sources] DELETE failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Could not delete source", message }, { status: 503 });
  }
}