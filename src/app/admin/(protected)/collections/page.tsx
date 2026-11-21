import type { Metadata } from "next";
import { HomeCollectionsEditor } from "@/components/admin/collections/HomeCollectionsEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage Collections" };

export default async function AdminCollectionsPage() {
  await requireAdminPage();
  return <HomeCollectionsEditor />;
}
