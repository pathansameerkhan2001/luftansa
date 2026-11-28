import type { Metadata } from "next";
import { NavCollectionsEditor } from "@/components/admin/nav-collections/NavCollectionsEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collections Menu" };

export default async function AdminNavCollectionsPage() {
  await requireAdminPage();
  return <NavCollectionsEditor />;
}
