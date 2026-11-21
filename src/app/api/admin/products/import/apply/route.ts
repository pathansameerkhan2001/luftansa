import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { applyRequestSchema } from "@/lib/catalogue/excel-import";
import { applyImport } from "@/lib/catalogue/excel-import-apply";
import { getDataServices } from "@/lib/db/client";
import { revalidateStorefront } from "@/lib/storefront/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/products/import/apply
 * Applies an import the admin reviewed. Refused (409) when the result would
 * differ from the reviewed plan; rolled back when any product fails.
 */
export const POST = withAdmin(async (request: NextRequest, { session }) => {
  const data = getDataServices();
  if (!data) return NextResponse.json({ error: "database_not_configured", message: "The product database is not available." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The import request could not be read." }, { status: 400 });
  }
  const parsed = applyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", message: parsed.error.issues[0]?.message ?? "The import request is not valid." }, { status: 400 });
  }
  const { fingerprint, ...req } = parsed.data;
  try {
    const result = await applyImport(data.repo, data.audit, session.email, req, fingerprint);
    if (result.applied.length > 0 || result.status === "rolled_back") revalidateStorefront();
    const status = result.status === "changed_since_preview" ? 409 : result.status === "rolled_back" ? 500 : 200;
    return NextResponse.json({ ok: result.status === "completed", result }, { status });
  } catch (e) {
    console.error("[import] apply failed:", (e as Error).message);
    return NextResponse.json({ error: "import_failed", message: "The import could not be completed. Nothing was changed." }, { status: 500 });
  }
});
