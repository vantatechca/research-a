"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  // Tick down the retry-after countdown every second so the user sees it
  // unblock without manual refresh.
  useEffect(() => {
    if (retryAfterSec === null || retryAfterSec <= 0) return;
    const t = setTimeout(() => setRetryAfterSec((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [retryAfterSec]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || password.length === 0) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Sanitise the redirect target — only allow same-origin paths so a
        // crafted ?next=https://evil.com link can't bounce the user offsite.
        const safeNext = next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/";
        router.push(safeNext);
        router.refresh();
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setRetryAfterSec(body.retryAfterSec ?? 60);
        setError(body.error ?? "Too many attempts");
      } else {
        setError(body.error ?? "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const locked = retryAfterSec !== null && retryAfterSec > 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">PeptideBrain</h1>
            <p className="text-xs text-gray-500 mt-0.5">Operator sign-in</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700 mb-1 block">
                  Password
                </span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || locked}
                  placeholder="Enter operator password"
                  className="font-mono text-sm"
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    {error}
                    {locked && retryAfterSec !== null && (
                      <span className="block text-gray-500 mt-0.5">
                        Try again in {retryAfterSec}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || locked || password.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          Single-operator mode. Set <code className="font-mono">AUTH_PASSWORD</code>{" "}
          in your env to configure.
        </p>
      </div>
    </div>
  );
}

// useSearchParams must be inside a Suspense boundary in Next.js app router.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}