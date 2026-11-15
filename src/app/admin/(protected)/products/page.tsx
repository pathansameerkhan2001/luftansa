import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { listAllProductsWithVariants } from "@/lib/db/products-service";
import { ProductManager } from "@/components/admin/ProductManager";
import type { ProductItem, ProductVariantItem } from "@/lib/db/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products - Admin" };

export default async function AdminProductsPage() {
  await requireAdminPage();

  const data = getDataServices();
  let initialProducts: (ProductItem & { variants: ProductVariantItem[] })[] = [];
  let loadError: string | null = null;

  if (data) {
    try {
      // Every product (ACTIVE and INACTIVE) with its variants: inactive products stay manageable.
      const entries = await listAllProductsWithVariants(data.repo);
      initialProducts = entries.map((e) => ({ ...e.product, variants: e.variants }));
    } catch (e) {
      console.error("[admin/products] Failed to load products:", (e as Error).message);
      loadError = "Products could not be loaded from DynamoDB. Use Refresh to try again.";
    }
  }

  return (
    <ProductManager
      initialProducts={initialProducts}
      initialError={loadError}
      dbConfigured={Boolean(data)}
    />
  );
}
