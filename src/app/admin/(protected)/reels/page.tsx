import type { Metadata } from "next";
import { ReelsManager } from "@/components/admin/reels/ReelsManager";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Instagram Reels" };

export default async function AdminReelsPage() {
  await requireAdminPage();
  return <ReelsManager />;
}
