import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/db/repository";
import {
  deleteProductType,
  getProductType,
  updateProductType,
  isProductTypeInUse,
} from "@/lib/db/product-types-service";
import { productTypeUpdateInputSchema } from "@/lib/db/schemas";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductTypeContext = { id: string };

/**
 * GET /api/admin/product-types/[id]
 */
export const GET = withAdmin<ProductTypeContext>(async (_request, context) => {
  const data = getDataServices();
  if (!data) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { id } = await context.params;
  try {
    const item = await getProductType(data.repo, id);
    if (!item) return NextResponse.json({ error: "not_found", message: `Product type ${id} not found` }, { status: 404 });

    const usage = await isProductTypeInUse(data.repo, id, item.name);
    return NextResponse.json({ ok: true, item: { ...item, inUse: usage.inUse } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "get_product_type_failed", message }, { status: 500 });
  }
});

/**
 * PUT /api/admin/product-types/[id]
 * Updates product type with optimistic concurrency.
 */
export const PUT = withAdmin<ProductTypeContext>(async (request: NextRequest, context) => {
  const data = getDataServices();
  if (!data) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const input = productTypeUpdateInputSchema.parse(body);
    const item = await updateProductType(data.repo, data.audit, context.session.email, id, input);
    return NextResponse.json({ ok: true, item });
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
    return NextResponse.json({ error: "update_product_type_failed", message }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/product-types/[id]
 * Protected deletion: fails with 409 if products are assigned to this type.
 */
export const DELETE = withAdmin<ProductTypeContext>(async (request: NextRequest, context) => {
  const data = getDataServices();
  if (!data) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { id } = await context.params;
  const { searchParams } = request.nextUrl;
  const versionParam = searchParams.get("version");
  let version = versionParam ? Number.parseInt(versionParam, 10) : undefined;

  if (version === undefined) {
    try {
      const body = (await request.json()) as { version?: number };
      if (typeof body?.version === "number") version = body.version;
    } catch {
      // Body optional
    }
  }

  try {
    await deleteProductType(data.repo, data.audit, context.session.email, id, version);
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: "not_found", message: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", message: e.message }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: "delete_product_type_failed", message }, { status: 500 });
  }
});
