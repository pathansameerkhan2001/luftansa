import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store Settings" };

const CAPABILITIES = [
  "Store email and phone",
  "WhatsApp number",
  "Social media URLs",
  "Shipping settings and policies (confirmed text only)",
] as const;

export default async function AdminStoreSettingsPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Store Settings" description="Contact details, WhatsApp, social links and shipping." phase={5} capabilities={CAPABILITIES} />;
}
