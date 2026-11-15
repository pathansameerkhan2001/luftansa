import { NextResponse } from "next/server";
import { getDataServices } from "@/lib/db/client";
import { listProductTypes } from "@/lib/db/product-types-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400";

/**
 * GET /api/product-types
 *
 * Public endpoint for storefront navigation and product filtering.
 * Returns ONLY ACTIVE product types.
 * Omits internal audit/version metadata.
 */
export async function GET() {
  const data = getDataServices();
  if (!data) {
    // If DB is offline or not configured, return standard defaults
    return NextResponse.json(
      {
        ok: true,
        items: [
          { id: "perfume-spray", name: "Perfume Spray", defaultUnit: "ml", hasNotes: true },
          { id: "roll-on", name: "Roll-On", defaultUnit: "ml", hasNotes: true },
          { id: "air-freshener", name: "Air Freshener", defaultUnit: "ml", hasNotes: false },
          { id: "attar", name: "Attar", defaultUnit: "ml", hasNotes: true },
        ],
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  try {
    const types = await listProductTypes(data.repo, { status: "ACTIVE" });
    const publicItems = types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      defaultUnit: t.defaultUnit,
      hasNotes: t.hasNotes,
      sortOrder: t.sortOrder,
    }));

    return NextResponse.json(
      { ok: true, items: publicItems },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (e) {
    console.error("[api/product-types] Error fetching product types:", (e as Error).message);
    return NextResponse.json({ error: "failed_to_fetch_product_types" }, { status: 500 });
  }
}
