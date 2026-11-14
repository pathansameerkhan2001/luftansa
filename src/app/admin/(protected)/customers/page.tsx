import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

const CAPABILITIES = [
  "Customer listing",
  "Profile, email and contact details",
  "Customer order history",
] as const;

export default async function AdminCustomersPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Customers" description="Customer profiles and order history." phase={6} capabilities={CAPABILITIES} />;
}
