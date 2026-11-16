import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/db/repository";
import { LocalSafetyError } from "@/lib/runtime/mode";

/**
 * Maps service errors to JSON responses for admin APIs. Raw error messages
 * from AWS or the runtime are never returned to the browser.
 */
export function adminErrorResponse(e: unknown, context: string): NextResponse {
  if (e instanceof ValidationError) return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: "conflict", message: "This item was changed elsewhere. Reload and try again." }, { status: 409 });
  }
  if (e instanceof NotFoundError) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (e instanceof LocalSafetyError) {
    return NextResponse.json({ error: "local_safety", message: "Blocked by the local production-safety guard." }, { status: 503 });
  }
  console.error(`[admin] ${context} failed:`, e instanceof Error ? e.name : "unknown");
  return NextResponse.json({ error: "internal_error", message: "Something went wrong. Please try again." }, { status: 500 });
}

export const databaseUnavailable = () =>
  NextResponse.json({ error: "database_not_configured", message: "The database is not available." }, { status: 503 });
