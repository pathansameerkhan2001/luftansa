import type { Metadata } from "next";
import { ProductImport } from "@/components/admin/products/ProductImport";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import products" };

export default async function AdminProductImportPage() {
  await requireAdminPage();
  return <ProductImport />;
}
