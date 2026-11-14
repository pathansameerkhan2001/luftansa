import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

const CAPABILITIES = [
  "Available quantity per size",
  "Stock adjustments with reasons",
  "Low-stock warnings and thresholds",
  "In-stock / out-of-stock status",
  "Stock history",
] as const;

export default async function AdminInventoryPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Inventory" description="Stock levels, low-stock warnings and history." phase={2} capabilities={CAPABILITIES} />;
}
