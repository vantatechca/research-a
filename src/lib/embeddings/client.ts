/**
 * Embedding client for Phase 2a (semantic dedup).
 *
 * Uses the OpenAI-compatible /embeddings endpoint. Key comes from the
 * api-keys store (DB-encrypted, env-var fallback). Provider is configurable
 * via EMBEDDINGS_API_URL — defaults to OpenAI direct.
 *
 * Single-call function with retry. We don't batch yet because new ideas
 * arrive one at a time; backfill uses a separate batched path.
 */

import { getApiKey } from "@/lib/api-keys/store";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "text-embedding-3-small";
const TIMEOUT_MS = 15_000;
const MAX_INPUT_CHARS = 8000; // OpenAI's limit is ~8191 tokens; chars is a safe approximation

export interface EmbeddingError extends Error {
  status?: number;
  retryable: boolean;
}

function makeError(message: string, status?: number, retryable = false): EmbeddingError {
  const err = new Error(message) as EmbeddingError;
  err.status = status;
  err.retryable = retryable;
  return err;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a single embedding. Truncates input to a safe length.
 * Throws on failure; callers should catch and decide whether to retry or
 * proceed without an embedding (the schema allows NULL).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getApiKey("embeddings");
  if (!apiKey) {
    throw makeError(
      "EMBEDDINGS_API_KEY is not configured (no DB key, no env fallback)",
      undefined,
      false
    );
  }

  const baseUrl = process.env.EMBEDDINGS_API_URL ?? DEFAULT_BASE_URL;
  const model = process.env.EMBEDDINGS_MODEL ?? DEFAULT_MODEL;

  const input = text.trim().slice(0, MAX_INPUT_CHARS);
  if (input.length === 0) {
    throw makeError("Cannot embed empty text", undefined, false);
  }

  let res: Response;
  try {
    res = await timedFetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, input }),
    });
  } catch (err) {
    // Network / timeout — usually retryable
    const msg = err instanceof Error ? err.message : "network error";
    throw makeError(`Embedding request failed: ${msg}`, undefined, true);
  }

  if (!res.ok) {
    // 5xx and 429 are retryable; 4xx are not
    const retryable = res.status >= 500 || res.status === 429;
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // Body not JSON — leave detail as the status code
    }
    throw makeError(`Embedding API error: ${detail}`, res.status, retryable);
  }

  type EmbeddingResponse = {
    data: { embedding: number[]; index: number }[];
    model: string;
  };

  let parsed: EmbeddingResponse;
  try {
    parsed = (await res.json()) as EmbeddingResponse;
  } catch {
    throw makeError("Embedding response was not valid JSON", res.status, true);
  }

  const vec = parsed.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== 1536) {
    throw makeError(
      `Unexpected embedding shape (got length ${vec?.length ?? "missing"}, expected 1536)`,
      res.status,
      false
    );
  }

  return vec;
}

/**
 * Format a number[] as the pgvector literal: '[0.1,0.2,...]'
 * Used when inserting via raw SQL because Prisma's Unsupported() type can't
 * be passed through normal createMany / create calls.
 */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}