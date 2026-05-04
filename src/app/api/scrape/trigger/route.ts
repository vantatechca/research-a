export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, parseJsonBody } from "@/lib/api";

// Mirror the source allow-list from workers/api.py so we reject bad sources
// at the edge instead of round-tripping to FastAPI just to get a 400 back.
const VALID_SOURCES = new Set([
  "reddit",
  "google_trends",
  "youtube",
  "etsy",
  "whop",
  "bhw",
  "rss",
  "web",
]);

const TRIGGER_TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const { source, query } = parsed.body as {
    source?: unknown;
    query?: unknown;
  };

  if (typeof source !== "string" || !VALID_SOURCES.has(source)) {
    return errorResponse(
      400,
      `Field 'source' must be one of: ${[...VALID_SOURCES].join(", ")}`
    );
  }
  if (query !== undefined && query !== null && typeof query !== "string") {
    return errorResponse(400, "Field 'query' must be a string when provided");
  }

  const workerApiUrl = process.env.WORKER_API_URL || "http://localhost:8000";

  // Worker API requires a bearer token. Fail loudly if it isn't configured —
  // otherwise we'd send unauthenticated requests forever and only see 401s
  // in the worker logs.
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerToken) {
    console.error(
      "[api/scrape/trigger] WORKER_API_TOKEN is not set; cannot authenticate to worker"
    );
    return errorResponse(
      503,
      "Worker API token is not configured on this server"
    );
  }

  // Abort the fetch if the worker takes too long — otherwise this route
  // can hang the entire serverless function.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);

  try {
    const response = await fetch(`${workerApiUrl}/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({ source, query: query ?? null }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Worker may return JSON or HTML depending on what failed (proxy 502s
      // return HTML). Read as text first, then try to parse.
      const text = await response.text();
      let detail: string = text.slice(0, 500) || response.statusText;
      try {
        const parsedErr = JSON.parse(text);
        if (typeof parsedErr.detail === "string") detail = parsedErr.detail;
      } catch {
        // not JSON, keep the truncated text
      }
      return NextResponse.json(
        { error: detail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return errorResponse(504, "Worker API timed out");
    }
    console.error("[api/scrape/trigger] fetch failed:", err);
    return errorResponse(
      503,
      "Worker API is not reachable. Make sure Docker services are running."
    );
  } finally {
    clearTimeout(timeout);
  }
}