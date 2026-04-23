export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "priority_score";
    const order = searchParams.get("order") || "desc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderByField = sort === "priority_score" ? "priorityScore"
      : sort === "discovered_at" ? "discoveredAt"
      : sort === "reddit_mention_count" ? "redditMentionCount"
      : "priorityScore";

    const [ideas, total] = await withTimeout(
      Promise.all([
        prisma.idea.findMany({
          where,
          orderBy: { [orderByField]: order === "asc" ? "asc" : "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.idea.count({ where }),
      ]),
      8000,
      "ideas.findMany+count"
    );

    return NextResponse.json({ ideas, total, limit, offset });
  } catch (err) {
    console.error("[api/ideas] GET failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Database unavailable", message, ideas: [], total: 0 },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea = await withTimeout(
      prisma.idea.create({ data: body }),
      8000,
      "ideas.create"
    );
    return NextResponse.json(idea, { status: 201 });
  } catch (err) {
    console.error("[api/ideas] POST failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Could not create idea", message },
      { status: 503 }
    );
  }
}