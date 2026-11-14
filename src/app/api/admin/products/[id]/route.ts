import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/db/repository";
import { deleteProduct, getProductWithVariants, updateProduct } from "@/lib/db/products-service";
import { productUpdateInputSchema } from "@/lib/db/schemas";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRouteContext = { id: string };

/**
 * GET /api/admin/products/[id]
 * Retrieves a single product and all its variants.
 */
export const GET = withAdmin<ProductRouteContext>(async (_request, context) => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { id } = await context.params;
  try {
    const result = await getProductWithVariants(data.repo, id);
    if (!result) {
      return NextResponse.json({ error: "not_found", message: `Product ${id} not found` }, { status: 404 });
    }
    return NextResponse.json({ ok: true, product: result.product, variants: result.variants });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "get_product_failed", message }, { status: 500 });
  }
});

/**
 * PUT /api/admin/products/[id]
 * Updates product metadata and variants with optimistic concurrency version check.
 */
export const PUT = withAdmin<ProductRouteContext>(async (request: NextRequest, context) => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const input = productUpdateInputSchema.parse(body);
    const result = await updateProduct(data.repo, data.audit, context.session.email, id, input);
    return NextResponse.json({ ok: true, product: result.product, variants: result.variants });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: "not_found", message: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: "version_conflict", message: e.message }, { status: 409 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "update_product_failed", message }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/products/[id]
 * Deletes a product and its variants with optimistic concurrency version check.
 */
export const DELETE = withAdmin<ProductRouteContext>(async (request: NextRequest, context) => {
  const data = getDataServices();
  if (!data) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { id } = await context.params;

  // Expected version can be passed via searchParams or JSON body
  const { searchParams } = request.nextUrl;
  const versionParam = searchParams.get("version");
  let version = versionParam ? Number.parseInt(versionParam, 10) : undefined;

  if (version === undefined) {
    try {
      const body = (await request.json()) as { version?: number };
      if (typeof body?.version === "number") {
        version = body.version;
      }
    } catch {
      // Body is optional if version is in query or not strictly enforced
    }
  }

  try {
    await deleteProduct(data.repo, data.audit, context.session.email, id, version);
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: "not_found", message: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: "version_conflict", message: e.message }, { status: 409 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: "validation_failed", issues: e.issues }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "delete_product_failed", message }, { status: 500 });
  }
});
