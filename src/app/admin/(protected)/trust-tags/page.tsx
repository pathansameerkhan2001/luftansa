import type { Metadata } from "next";
import { TrustTagsEditor } from "@/components/admin/trust/TrustTagsEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product Trust Tags" };

export default async function AdminTrustTagsPage() {
  await requireAdminPage();
  return <TrustTagsEditor />;
}
