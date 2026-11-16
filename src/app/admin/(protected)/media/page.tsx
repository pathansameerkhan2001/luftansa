import type { Metadata } from "next";
import { MediaLibrary } from "@/components/admin/media/MediaLibrary";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media Library" };

export default async function AdminMediaLibraryPage() {
  await requireAdminPage();
  return <MediaLibrary />;
}
