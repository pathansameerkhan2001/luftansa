import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

const CAPABILITIES = [
  "Add, edit and delete products",
  "Names, descriptions, fragrance categories and notes",
  "Bottle types and available sizes",
  "Size-based prices, MRP and configured discounts",
  "Product images from the media library",
  "Status, featured and bestseller flags",
  "SEO title and description",
] as const;

export default async function AdminProductsPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Products" description="Fragrances, sizes, prices, images and SEO." phase={2} capabilities={CAPABILITIES} />;
}
