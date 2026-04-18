export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAnthropicClient, buildBrainSystemPrompt } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { message, conversationId, relatedIdeaId } = await req.json();

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { title: message.slice(0, 100), relatedIdeaId },
    });
    convId = conv.id;
  }

  // Save user message
  await prisma.message.create({
    data: { conversationId: convId, role: "user", content: message },
  });

  // Gather context for brain
  const [goldenRules, generalRules, recentMemories, stats, recentMessages] = await Promise.all([
    prisma.brainMemory.findMany({
      where: { memoryType: "golden_rule", active: true },
      orderBy: { importance: "desc" },
    }),
    prisma.brainMemory.findMany({
      where: { memoryType: "general_rule", active: true },
      orderBy: { importance: "desc" },
      take: 10,
    }),
    prisma.brainMemory.findMany({
      where: { active: true, memoryType: { notIn: ["golden_rule", "general_rule"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    Promise.all([
      prisma.idea.count(),
      prisma.idea.count({ where: { status: "pending" } }),
      prisma.idea.count({ where: { status: "approved" } }),
      prisma.idea.count({ where: { status: "declined" } }),
      prisma.idea.count({ where: { status: "launched" } }),
    ]),
    prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Get idea context if discussing specific idea
  let ideaContext: string | undefined;
  if (relatedIdeaId) {
    const idea = await prisma.idea.findUnique({ where: { id: relatedIdeaId } });
    if (idea) {
      ideaContext = JSON.stringify(idea, null, 2);
    }
  }

  const systemPrompt = buildBrainSystemPrompt({
    goldenRules: goldenRules.map((r) => r.content),
    generalRules: generalRules.map((r) => r.content),
    recentMemories: recentMemories.map((r) => `[${r.memoryType}] ${r.content}`),
    conversationHistory: recentMessages.reverse().map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
    stats: {
      total: stats[0],
      pending: stats[1],
      approved: stats[2],
      declined: stats[3],
      launched: stats[4],
    },
    ideaContext,
  });

  // Build ordered messages for Claude (already reversed above)
  const orderedMessages = recentMessages.reverse();

  // Stream response from Claude
  let stream;
  try {
    const client = getAnthropicClient();
    stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: orderedMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to connect to AI";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Collect full response for saving
  let fullResponse = "";

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && "delta" in event && "text" in event.delta) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save assistant message
        await prisma.message.create({
          data: { conversationId: convId, role: "assistant", content: fullResponse },
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
