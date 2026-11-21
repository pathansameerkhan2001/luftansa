import type { Metadata } from "next";
import { BrandStoryEditor } from "@/components/admin/story/BrandStoryEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand Story" };

export default async function AdminBrandStoryPage() {
  await requireAdminPage();
  return <BrandStoryEditor />;
}
