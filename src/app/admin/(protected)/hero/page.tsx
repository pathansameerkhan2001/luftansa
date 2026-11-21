import type { Metadata } from "next";
import { HeroEditor } from "@/components/admin/hero/HeroEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero Section" };

export default async function AdminHeroPage() {
  await requireAdminPage();
  return <HeroEditor />;
}
