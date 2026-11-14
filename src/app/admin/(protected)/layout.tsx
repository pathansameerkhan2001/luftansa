import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/auth/server";

// Never cache or prerender admin pages.
export const dynamic = "force-dynamic";

/** Every page in this group requires a verified administrator session. */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return <>{children}</>;
}
