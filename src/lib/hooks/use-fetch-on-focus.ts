"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useFetchOnFocus
 * ----------------
 * Runs an async fetcher on mount, then refetches whenever:
 *   - the window regains focus
 *   - the tab becomes visible again
 *   - a polling interval elapses (default: 60s)
 *
 * Returns { data, loading, error, refetch } so callers can also trigger
 * manual refetches (e.g. after a successful POST).
 *
 * The fetcher MUST be wrapped in `useCallback` by the caller — otherwise
 * it'll be a new function every render and the effect will re-run forever.
 *
 * Example:
 *   const fetchTrends = useCallback(async (signal) => {
 *     const res = await fetch("/api/trends", { cache: "no-store", signal });
 *     if (!res.ok) throw new Error("Failed");
 *     return (await res.json()) as TrendsData;
 *   }, []);
 *
 *   const { data, loading, error, refetch } = useFetchOnFocus(fetchTrends);
 */
export function useFetchOnFocus<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: {
    /** Polling interval in ms. Pass 0 to disable. Default: 60_000. */
    pollMs?: number;
    /** Whether to refetch on window focus. Default: true. */
    refetchOnFocus?: boolean;
    /** Whether to refetch on tab visibility change. Default: true. */
    refetchOnVisibility?: boolean;
  } = {}
) {
  const {
    pollMs = 60_000,
    refetchOnFocus = true,
    refetchOnVisibility = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the in-flight controller so we can cancel previous fetches when a
  // new one fires (focus + interval can race otherwise).
  const controllerRef = useRef<AbortController | null>(null);
  // Track whether we've completed at least one successful fetch — used to
  // suppress the loading skeleton on subsequent refetches.
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!hasLoadedRef.current) setLoading(true);
    setError(null);

    try {
      const result = await fetcher(controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      hasLoadedRef.current = true;
    } catch (err) {
      if (controller.signal.aborted) return;
      // Native AbortError on cancelled requests — silent
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refetch();

    function handleFocus() {
      refetch();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") refetch();
    }

    if (refetchOnFocus) {
      window.addEventListener("focus", handleFocus);
    }
    if (refetchOnVisibility) {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollMs > 0) {
      intervalId = setInterval(refetch, pollMs);
    }

    return () => {
      controllerRef.current?.abort();
      if (refetchOnFocus) window.removeEventListener("focus", handleFocus);
      if (refetchOnVisibility) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [refetch, pollMs, refetchOnFocus, refetchOnVisibility]);

  return { data, loading, error, refetch };
}