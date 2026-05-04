/**
 * Shared API utilities — validation, type coercion, and error handling
 * used across every route handler in src/app/api.
 */

import { NextResponse } from "next/server";

// ─── Error helpers ───────────────────────────────────────────────────────────

/**
 * Prisma "record not found" error code (thrown by update/delete on missing row).
 */
export function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

/**
 * Prisma unique constraint violation (e.g. duplicate slug).
 */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Prisma foreign-key violation (e.g. referencing a non-existent idea/conversation).
 */
export function isPrismaForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2003"
  );
}

/**
 * Sanitise error messages before returning them to clients.
 * In production, raw Prisma messages can leak schema details; we strip
 * specifics and keep a stable shape.
 */
export function safeErrorMessage(err: unknown): string {
  if (process.env.NODE_ENV === "production") return "Internal error";
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Standardised error JSON response.
 */
export function errorResponse(
  status: number,
  error: string,
  details?: unknown
): NextResponse {
  const body: Record<string, unknown> = { error };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

// ─── Body parsing ────────────────────────────────────────────────────────────

/**
 * Parse a JSON body safely. Returns either the parsed object or a 400 response.
 * Reject anything that isn't a plain object (arrays, primitives, null).
 */
export async function parseJsonBody(
  req: Request
): Promise <
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  // Reject obviously wrong content types early. Some clients still send
  // text/plain for JSON, so we accept missing/empty too.
  const ct = req.headers.get("content-type") ?? "";
  if (ct && !ct.includes("application/json") && !ct.includes("text/plain")) {
    return {
      ok: false,
      response: errorResponse(
        415,
        "Content-Type must be application/json"
      ),
    };
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(400, "Invalid JSON body"),
    };
  }

  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw)
  ) {
    return {
      ok: false,
      response: errorResponse(400, "Body must be a JSON object"),
    };
  }

  return { ok: true, body: raw as Record<string, unknown> };
}

// ─── Field validators ────────────────────────────────────────────────────────

/**
 * Pick whitelisted fields from a body, dropping any unknown keys silently.
 * Mirrors the existing pickPatchable pattern but is shared.
 */
export function pickFields(
  body: Record<string, unknown>,
  allowed: ReadonlySet<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (allowed.has(key)) out[key] = body[key];
  }
  return out;
}

/**
 * Type-coerce and validate a record of fields. Each field declares its expected
 * shape; invalid values cause a 400 with a message naming the field.
 *
 * Returns either the cleaned object or a NextResponse to return immediately.
 */
export type FieldSpec =
  | { type: "string"; maxLength?: number; minLength?: number; nullable?: boolean }
  | { type: "string-array"; maxItems?: number }
  | { type: "number"; min?: number; max?: number; integer?: boolean; nullable?: boolean }
  | { type: "boolean" }
  | { type: "date"; nullable?: boolean }
  | { type: "json"; nullable?: boolean }
  | { type: "enum"; values: readonly string[] };

export function validateFields(
  data: Record<string, unknown>,
  specs: Record<string, FieldSpec>
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse } {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const spec = specs[key];
    if (!spec) {
      // Field isn't in the spec list — caller should have filtered with
      // pickFields first. We skip silently rather than 400, matching prior
      // behaviour.
      continue;
    }

    // null handling
    if (value === null) {
      if ("nullable" in spec && spec.nullable) {
        out[key] = null;
        continue;
      }
      return {
        ok: false,
        response: errorResponse(400, `Field '${key}' cannot be null`),
      };
    }

    switch (spec.type) {
      case "string": {
        if (typeof value !== "string") {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be a string`),
          };
        }
        if (spec.minLength !== undefined && value.length < spec.minLength) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must be at least ${spec.minLength} characters`
            ),
          };
        }
        if (spec.maxLength !== undefined && value.length > spec.maxLength) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must be at most ${spec.maxLength} characters`
            ),
          };
        }
        out[key] = value;
        break;
      }

      case "string-array": {
        if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must be an array of strings`
            ),
          };
        }
        if (spec.maxItems !== undefined && value.length > spec.maxItems) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must contain at most ${spec.maxItems} items`
            ),
          };
        }
        out[key] = value;
        break;
      }

      case "number": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be a finite number`),
          };
        }
        if (spec.integer && !Number.isInteger(value)) {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be an integer`),
          };
        }
        if (spec.min !== undefined && value < spec.min) {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be >= ${spec.min}`),
          };
        }
        if (spec.max !== undefined && value > spec.max) {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be <= ${spec.max}`),
          };
        }
        out[key] = value;
        break;
      }

      case "boolean": {
        if (typeof value !== "boolean") {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' must be a boolean`),
          };
        }
        out[key] = value;
        break;
      }

      case "date": {
        if (typeof value !== "string" && !(value instanceof Date)) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must be an ISO date string`
            ),
          };
        }
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) {
          return {
            ok: false,
            response: errorResponse(400, `Field '${key}' is not a valid date`),
          };
        }
        out[key] = d;
        break;
      }

      case "json": {
        // Accept any JSON-shaped value (object/array). Already deserialised by
        // req.json(), so we just accept as-is.
        out[key] = value;
        break;
      }

      case "enum": {
        if (typeof value !== "string" || !spec.values.includes(value)) {
          return {
            ok: false,
            response: errorResponse(
              400,
              `Field '${key}' must be one of: ${spec.values.join(", ")}`
            ),
          };
        }
        out[key] = value;
        break;
      }
    }
  }

  return { ok: true, data: out };
}

// ─── UUID validation ─────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID path param. Returns the id or a 400 response.
 * Important: without this, Prisma queries with a malformed UUID throw a
 * generic 503 instead of a clean 400.
 */
export function validateUuidParam(
  id: string
): { ok: true; id: string } | { ok: false; response: NextResponse } {
  if (!UUID_RE.test(id)) {
    return {
      ok: false,
      response: errorResponse(400, "Invalid id format"),
    };
  }
  return { ok: true, id };
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationOpts {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Parse `limit` and `offset` query params with safe defaults and an upper
 * bound. Without the bound, a client could request `?limit=999999` and force
 * the API to load every row.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts: PaginationOpts = {}
): { limit: number; offset: number } {
  const defaultLimit = opts.defaultLimit ?? 50;
  const maxLimit = opts.maxLimit ?? 200;

  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10);

  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
}

// ─── Timeout wrapper ─────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout. Lifted from the existing ideas route so
 * every route can use the same protection against hung DB queries.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
        ms
      )
    ),
  ]);
}