import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promotions" };

const CAPABILITIES = [
  "Discount configuration",
  "Offer badges (e.g. buy-one-get-one) per product and size",
  "Promotional banners",
  "Only confirmed offers are published",
] as const;

export default async function AdminPromotionsPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Promotions" description="Discounts, offers and promotional banners." phase={5} capabilities={CAPABILITIES} />;
}
