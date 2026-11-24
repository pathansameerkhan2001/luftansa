import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyEditor } from "@/components/admin/policies/PolicyEditor";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { isPolicyKey, POLICY_LABEL } from "@/lib/cms/modules/policy-pages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ policy: string }> }): Promise<Metadata> {
  const { policy } = await params;
  return { title: isPolicyKey(policy) ? POLICY_LABEL[policy] : "Policy Pages" };
}

export default async function AdminPolicyEditorPage({ params }: { params: Promise<{ policy: string }> }) {
  await requireAdminPage();
  const { policy } = await params;
  if (!isPolicyKey(policy)) notFound();
  return <PolicyEditor policy={policy} />;
}
