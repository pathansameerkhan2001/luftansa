import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website Content" };

const CAPABILITIES = [
  "Announcement bar",
  "Hero section and slides",
  "Benefits strip",
  "Personality and Roll On collections",
  "Explore by Notes and Best Sellers",
  "Instagram Reels and Brand Story",
  "Product detail content and FAQ",
  "Text, images, links, visibility and ordering (footer stays fixed)",
] as const;

export default async function AdminWebsiteContentPage() {
  await requireAdminPage();
  return <AdminPlaceholder title="Website Content" description="Homepage sections from the announcement bar to the FAQ." phase={4} capabilities={CAPABILITIES} />;
}
