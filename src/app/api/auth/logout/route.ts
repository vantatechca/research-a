export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Overwriting with maxAge=0 is the standard idiom — instructs the browser
  // to drop the cookie immediately.
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}