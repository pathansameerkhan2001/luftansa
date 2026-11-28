import type { Metadata } from "next";
import { ProductPageEditor } from "@/components/admin/product-page/ProductPageEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product Page Sections" };

export default async function AdminProductPagePage() {
  await requireAdminPage();
  return <ProductPageEditor />;
}
