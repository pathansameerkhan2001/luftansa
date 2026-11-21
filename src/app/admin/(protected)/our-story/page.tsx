import type { Metadata } from "next";
import { OurStoryEditor } from "@/components/admin/our-story/OurStoryEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Our Story" };

export default async function AdminOurStoryPage() {
  await requireAdminPage();
  return <OurStoryEditor />;
}
