import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });

  try {
    const opp = await prisma.digitalOpportunity.findUnique({ where: { id } });
    if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are a digital product research analyst. Evaluate opportunities for digital products that are instantly deliverable, require no physical shipping, and can be sold repeatedly with zero marginal cost.

Be direct and opinionated. If an opportunity is weak, say so immediately.`,
      messages: [{
        role:    "user",
        content: `Analyze this digital product opportunity:

Title: ${opp.title}
Niche: ${opp.niche}
Platform: ${opp.platform}
Score: ${opp.score}
Category: ${opp.category}
Summary: ${opp.summary ?? "No summary available"}
Source: ${opp.sourceUrl ?? "Unknown"}

Respond with exactly these sections:

VERDICT: Strong / Moderate / Weak (one line)
BUYER: Who buys this and exactly why (2-3 sentences)
DIFFERENTIATION: What makes a 10x better version worth 2x the price (2-3 sentences)
BUILD TIME: Realistic estimate in hours or days
PRICE TARGET: Recommended price and why
WATCH OUT: Biggest risk or red flag`,
      }],
    });

    const playbook = message.content[0].type === "text"
      ? message.content[0].text
      : "";

    await prisma.digitalOpportunity.update({
      where: { id },
      data:  { aiPlaybook: playbook, status: "RESEARCHING" },
    });

    return NextResponse.json({ playbook });
  } finally {
    await prisma.$disconnect();
  }
}