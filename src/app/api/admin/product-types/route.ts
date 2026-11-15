import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { ConflictError, ValidationError } from "@/lib/db/repository";
import {
  createProductType,
  listProductTypes,
  isProductTypeInUse,
  seedInitialProductTypes,
} from "@/lib/db/product-types-service";
import { productTypeCreateInputSchema } from "@/lib/db/schemas";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/product-types
 * Returns all product types (ACTIVE and INACTIVE) with in-use status.
 * Auto-seeds initial product types if table partition is empty (idempotent).
 */
export const GET = withAdmin(async () => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  try {
    let items = await listProductTypes(data.repo);

    // If partition is completely empty, seed initial standard types idempotently
    if (items.length === 0) {
      await seedInitialProductTypes(data.repo);
      items = await listProductTypes(data.repo);
    }

    // Annotate each type with in-use status (using indexed GSI2 queries: zero table scans!)
    const enriched = await Promise.all(
      items.map(async (t) => {
        const usage = await isProductTypeInUse(data.repo, t.id, t.name);
        return {
          ...t,
          inUse: usage.inUse,
        };
      }),
    );

    return NextResponse.json({ ok: true, items: enriched });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "list_product_types_failed", message }, { status: 500 });
  }
});

/**
 * POST /api/admin/product-types
 * Creates a new product type.
 */
export const POST = withAdmin(async (request: NextRequest, { session }) => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const input = productTypeCreateInputSchema.parse(body);
    const item = await createProductType(data.repo, data.audit, session.email, input);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: "product_type_already_exists", message: e.message }, { status: 409 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "create_product_type_failed", message }, { status: 500 });
  }
});
