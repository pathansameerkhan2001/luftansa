import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

const CAPABILITIES = [
  "Order listing with search and filters",
  "Order details, items and quantities",
  "Customer and delivery information",
  "Payment method and server-verified payment status",
  "Order status updates with history",
  "Tracking information",
] as const;

export default async function AdminOrdersPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Orders" description="Orders, payment status, fulfilment and tracking." phase={6} capabilities={CAPABILITIES} />;
}
