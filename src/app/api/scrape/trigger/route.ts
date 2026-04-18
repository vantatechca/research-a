export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { source } = await req.json();
  const workerApiUrl = process.env.WORKER_API_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${workerApiUrl}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Worker API is not reachable. Make sure Docker services are running." },
      { status: 503 }
    );
  }
}
