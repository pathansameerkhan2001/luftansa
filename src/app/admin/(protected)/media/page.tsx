import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media Library" };

const CAPABILITIES = [
  "Product, hero, banner and category images",
  "Instagram reel videos and thumbnails",
  "Brand story videos",
  "Secure presigned uploads (bucket stays private)",
  "Safe delete with usage checks",
] as const;

export default async function AdminMediaLibraryPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Media Library" description="Images and videos stored in the private S3 bucket." phase={3} capabilities={CAPABILITIES} />;
}
