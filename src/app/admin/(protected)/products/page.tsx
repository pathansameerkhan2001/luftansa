import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { getDataServices } from "@/lib/db/client";
import { listProducts } from "@/lib/db/products-service";
import { ProductManager } from "@/components/admin/ProductManager";
import type { ProductItem } from "@/lib/db/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products - Admin" };

export default async function AdminProductsPage() {
  await requireAdminPage();

  const data = getDataServices();
  let initialProducts: ProductItem[] = [];

  if (data) {
    try {
      const res = await listProducts(data.repo, { limit: 100 });
      initialProducts = res.items;
    } catch {
      // If table is newly provisioned or during build/local mode, fallback to empty list
      initialProducts = [];
    }
  }

  return (
    <ProductManager
      initialProducts={initialProducts}
      dbConfigured={Boolean(data)}
    />
  );
}
