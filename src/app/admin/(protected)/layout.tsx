import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/require-admin";

// Never cache or prerender admin pages.
export const dynamic = "force-dynamic";

/** Every page in this group requires a verified administrator session. */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
