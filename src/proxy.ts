/**
 * Auth middleware. Runs on every request that matches the `matcher` pattern
 * at the bottom of this file.
 *
 * Behaviour:
 *   - GET /login        → always allowed
 *   - POST /api/auth/*  → always allowed (login + logout endpoints)
 *   - everything else   → requires a valid session cookie
 *
 * Unauthenticated API requests get a 401 JSON response (so fetch callers can
 * detect it cleanly). Unauthenticated page loads get a 302 to /login with a
 * `next` query param so we can land them back where they were going.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";

// Paths that bypass auth. Order matters — this list is short and read on
// every request.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
];

function isPublic(pathname: string): boolean {
  // Exact-match first (fastest path)
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true;
  }
  return false;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (verifySession(token)) {
    return NextResponse.next();
  }

  // Unauthenticated. API → 401, page → redirect.
  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Session expired or missing" },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", req.url);
  // Preserve the destination so we can land back here after login. Skip the
  // dance for trivial root requests; clutters the URL bar otherwise.
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
}

/**
 * Matcher: run on everything except Next.js internals and static files.
 *
 * - `_next/static`, `_next/image`: build artefacts, served as-is
 * - `favicon.ico`, `*.svg`, `*.png` etc: public asset files
 *
 * The negative lookahead keeps the middleware off the hot path for asset
 * requests, which would otherwise pay a cookie-parse cost for every image.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};