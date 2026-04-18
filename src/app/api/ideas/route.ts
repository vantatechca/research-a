export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
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

  const [ideas, total] = await Promise.all([
    prisma.idea.findMany({
      where,
      orderBy: { [orderByField]: order === "asc" ? "asc" : "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.idea.count({ where }),
  ]);

  return NextResponse.json({ ideas, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const idea = await prisma.idea.create({ data: body });
  return NextResponse.json(idea, { status: 201 });
}
