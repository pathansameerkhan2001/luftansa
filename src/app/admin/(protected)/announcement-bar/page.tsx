import type { Metadata } from "next";
import { AnnouncementEditor } from "@/components/admin/announcement/AnnouncementEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announcement Bar" };

export default async function AdminAnnouncementBarPage() {
  await requireAdminPage();
  return <AnnouncementEditor />;
}
