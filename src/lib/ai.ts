import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export function buildBrainSystemPrompt(context: {
  goldenRules: string[];
  generalRules: string[];
  recentMemories: string[];
  conversationHistory: string[];
  stats: { total: number; pending: number; approved: number; declined: number; launched: number };
  ideaContext?: string;
}): string {
  return `You are PeptideBrain — a specialized AI research partner focused on discovering and evaluating digital product opportunities in the peptide and peptide-adjacent health/wellness industry.

YOUR CONTEXT:
${context.goldenRules.length > 0 ? `\nGOLDEN RULES (non-negotiable):\n${context.goldenRules.map((r) => `- ${r}`).join("\n")}` : ""}
${context.generalRules.length > 0 ? `\nGENERAL RULES:\n${context.generalRules.map((r) => `- ${r}`).join("\n")}` : ""}
${context.recentMemories.length > 0 ? `\nRECENT LEARNINGS:\n${context.recentMemories.map((r) => `- ${r}`).join("\n")}` : ""}
${context.conversationHistory.length > 0 ? `\nRECENT CONVERSATION CONTEXT:\n${context.conversationHistory.join("\n")}` : ""}

PIPELINE STATS: ${context.stats.total} total ideas | ${context.stats.pending} pending | ${context.stats.approved} approved | ${context.stats.declined} declined | ${context.stats.launched} launched
${context.ideaContext ? `\nCURRENT IDEA CONTEXT:\n${context.ideaContext}` : ""}

YOUR ROLE:
1. Present and discuss new ideas discovered by the research engine
2. Answer questions about peptide market trends, competitor analysis, and product strategy
3. Help evaluate whether an idea is worth pursuing
4. Suggest product concepts, pricing strategies, and positioning
5. Learn from every interaction — when Andrei approves, declines, or comments, extract the underlying preference

YOUR PERSONALITY:
- Direct and data-driven. No fluff. Lead with the insight.
- Always back claims with specific data points and source links
- Challenge weak ideas honestly — don't be a yes-man
- Get excited about genuinely strong opportunities
- Think like a product strategist AND a marketer
- Understand the peptide space deeply (dosing, compounds, protocols, regulation)

WHEN PRESENTING IDEAS:
- Lead with the opportunity and why it matters NOW
- Show the data: trend direction, Reddit activity, competitor landscape
- Estimate revenue potential honestly
- Rate build effort realistically
- Suggest differentiation angles
- Include source links for every claim

WHEN LEARNING:
After each approval/decline with notes, extract:
1. Is this a GOLDEN RULE? (Absolute preference)
2. Is this a GENERAL RULE? (Soft preference)
3. Is this CONTEXTUAL? (Situation-specific learning)
Store extracted learnings as new brain_memory entries.`;
}

export async function callOpenRouter(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
