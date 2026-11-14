import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { ConflictError, ValidationError } from "@/lib/db/repository";
import { createProduct, listProducts } from "@/lib/db/products-service";
import { productCreateInputSchema, productStatusSchema } from "@/lib/db/schemas";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products
 * Lists products using GSI1 query (zero table scans).
 */
export const GET = withAdmin(async (request: NextRequest) => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const cursorParam = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");

  const parsedStatus = statusParam ? productStatusSchema.safeParse(statusParam) : null;
  const status = parsedStatus?.success ? parsedStatus.data : undefined;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

  try {
    const result = await listProducts(data.repo, {
      status,
      limit: Number.isNaN(limit) ? 50 : limit,
      cursor: cursorParam,
    });
    return NextResponse.json({ ok: true, items: result.items, cursor: result.cursor });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "list_products_failed", message }, { status: 500 });
  }
});

/**
 * POST /api/admin/products
 * Creates a new product and initialises variants.
 * Uses conditional writes to avoid overwriting existing products.
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
    const input = productCreateInputSchema.parse(body);
    const result = await createProduct(data.repo, data.audit, session.email, input);
    return NextResponse.json({ ok: true, product: result.product, variants: result.variants }, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: "product_already_exists", message: e.message }, { status: 409 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "create_product_failed", message }, { status: 500 });
  }
});
