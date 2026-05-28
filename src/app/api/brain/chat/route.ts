export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAnthropicClient, buildBrainSystemPrompt } from "@/lib/ai";
import { checkRateLimit, identifyClient } from "@/lib/rate-limit";

// RFC-4122 UUID (any version). Used to reject bad input before it hits Prisma,
// which would otherwise throw a 500 with a confusing P2023 error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Max characters accepted per user message. Cheap denial-of-wallet guard —
// the system prompt already pads several KB so we don't want one body
// blowing past the Anthropic context window or the per-call budget.
const MAX_MESSAGE_CHARS = 8000;

// Each chat call streams a Sonnet 4.6 response — meaningfully expensive.
// 30 messages per 5 minutes is plenty for one human typing, well below
// anything a runaway script could burn.
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_HITS = 30;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Anthropic model for the operator-facing brain chat. Defaults to Sonnet 4.6 —
// the bulk pipeline already uses Haiku 4.5; the operator chat is the place to
// spend the extra capability budget. Override via env without redeploying.
const BRAIN_MODEL = process.env.BRAIN_MODEL || "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  // Token-cost guard — see RATE_LIMIT_* constants above.
  const gate = checkRateLimit("brain-chat", identifyClient(req), {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxHits: RATE_LIMIT_MAX_HITS,
  });
  if (!gate.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Slow down.",
        retryAfterSec: gate.retryAfterSec,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(gate.retryAfterSec),
        },
      }
    );
  }

  let body: { message?: unknown; conversationId?: unknown; relatedIdeaId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON");
  }

  const message = body.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return jsonError(400, "Field 'message' is required and must be a non-empty string");
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return jsonError(400, `Message exceeds ${MAX_MESSAGE_CHARS} character limit`);
  }

  // Validate UUIDs BEFORE any DB call. Passing a non-UUID into Prisma against
  // a @db.Uuid column throws a 500 — we want a 400.
  const conversationIdInput =
    typeof body.conversationId === "string" ? body.conversationId : null;
  if (conversationIdInput !== null && !UUID_RE.test(conversationIdInput)) {
    return jsonError(400, "Field 'conversationId' must be a UUID");
  }
  const relatedIdeaIdInput =
    typeof body.relatedIdeaId === "string" ? body.relatedIdeaId : null;
  if (relatedIdeaIdInput !== null && !UUID_RE.test(relatedIdeaIdInput)) {
    return jsonError(400, "Field 'relatedIdeaId' must be a UUID");
  }

  // Get or create conversation. When the caller supplies a conversationId we
  // verify it actually exists (and isn't archived) before writing into it —
  // previously any UUID was accepted and Prisma would happily create messages
  // pointing at a deleted parent until cascade caught up.
  let convId: string;
  if (conversationIdInput) {
    const existing = await prisma.conversation.findUnique({
      where: { id: conversationIdInput },
      select: { id: true, archived: true },
    });
    if (!existing) {
      return jsonError(404, "Conversation not found");
    }
    if (existing.archived) {
      return jsonError(409, "Conversation is archived");
    }
    convId = existing.id;
  } else {
    const conv = await prisma.conversation.create({
      data: { title: message.slice(0, 100), relatedIdeaId: relatedIdeaIdInput ?? undefined },
    });
    convId = conv.id;
  }

  // Save user message
  await prisma.message.create({
    data: { conversationId: convId, role: "user", content: message },
  });

  // Gather context for brain
  const [goldenRules, generalRules, operatorDecisions, recentMemories, stats, recentMessages] = await Promise.all([
    prisma.brainMemory.findMany({
      where: { memoryType: "golden_rule", active: true },
      orderBy: { importance: "desc" },
    }),
    prisma.brainMemory.findMany({
      where: { memoryType: "general_rule", active: true },
      orderBy: { importance: "desc" },
      take: 10,
    }),
    // Recent approve/decline notes — strongest behavioral signal we have.
    // Threaded as a distinct section in the prompt so a future refactor of
    // the "recent memories" query can't silently drop them.
    prisma.brainMemory.findMany({
      where: { active: true, memoryType: "operator_note" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.brainMemory.findMany({
      where: {
        active: true,
        memoryType: { notIn: ["golden_rule", "general_rule", "operator_note"] },
      },
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
  if (relatedIdeaIdInput) {
    const idea = await prisma.idea.findUnique({ where: { id: relatedIdeaIdInput } });
    if (idea) {
      ideaContext = JSON.stringify(idea, null, 2);
    }
  }

  // recentMessages comes back DESC (newest first); reverse a copy so we get
  // chronological order without mutating the original twice.
  const chronologicalMessages = [...recentMessages].reverse();

  const systemPrompt = buildBrainSystemPrompt({
    goldenRules: goldenRules.map((r) => r.content),
    generalRules: generalRules.map((r) => r.content),
    operatorDecisions: operatorDecisions.map((r) => r.content),
    recentMemories: recentMemories.map((r) => `[${r.memoryType}] ${r.content}`),
    conversationHistory: chronologicalMessages.map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
    stats: {
      total: stats[0],
      pending: stats[1],
      approved: stats[2],
      declined: stats[3],
      launched: stats[4],
    },
    ideaContext,
  });

  const orderedMessages = chronologicalMessages;

  // Stream response from Claude
  let stream;
  try {
    const client = await getAnthropicClient();
    stream = await client.messages.stream({
      model: BRAIN_MODEL,
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

  // Persist whatever streamed so the conversation history is complete even
  // when the model errors halfway. Previously the save lived inside the try
  // block; a mid-stream throw meant the user saw partial output on screen
  // with nothing in the DB, so on refresh the message vanished.
  const persistAssistantMessage = async (): Promise<void> => {
    if (fullResponse.length === 0) return;
    try {
      await prisma.message.create({
        data: { conversationId: convId, role: "assistant", content: fullResponse },
      });
    } catch (saveErr) {
      console.error("[api/brain/chat] failed to persist assistant message:", saveErr);
    }
  };

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
        await persistAssistantMessage();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`));
      } catch (err) {
        // Save whatever we got before signalling the error, so the user can
        // see partial context on next load instead of "where did my reply go?".
        await persistAssistantMessage();
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