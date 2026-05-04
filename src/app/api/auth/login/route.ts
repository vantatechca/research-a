export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, parseJsonBody } from "@/lib/api";
import {
  checkLoginAllowed,
  clearLoginRecord,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import {
  constantTimeStringEqual,
  isAuthConfigured,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  signSession,
} from "@/lib/auth/session";

/**
 * Identify the requester for rate-limiting. We trust the standard proxy
 * headers because Render (and most platforms) sets x-forwarded-for. Falls
 * back to a fixed "unknown" key — that's not great but it's better than
 * letting the limit be bypassed.
 */
function identifyClient(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the first IP — the leftmost is the original client.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return errorResponse(
      503,
      "AUTH_PASSWORD is not set on the server (or is too short). Cannot accept logins."
    );
  }

  const clientKey = identifyClient(req);

  // Rate limit BEFORE parsing the body — keep the cheap path fast.
  const gate = checkLoginAllowed(clientKey);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "Too many failed attempts. Try again later.",
        retryAfterSec: gate.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(gate.retryAfterSec) },
      }
    );
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const password = parsed.body.password;
  if (typeof password !== "string" || password.length === 0) {
    return errorResponse(400, "Field 'password' is required");
  }
  // Length cap — the configured password is fixed; anything wildly longer
  // is just a brute-force probe wasting our CPU on the constant-time compare.
  if (password.length > 1000) {
    return errorResponse(400, "Password is too long");
  }

  const expected = process.env.AUTH_PASSWORD!;
  const ok = constantTimeStringEqual(password, expected);
  if (!ok) {
    recordLoginFailure(clientKey);
    // Generic message — don't hint at "wrong password" vs "no user" (we don't
    // have users, but the principle still applies: minimise info leakage).
    return errorResponse(401, "Invalid credentials");
  }

  clearLoginRecord(clientKey);
  const { token } = signSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
  return res;
}