import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/require-admin";

/**
 * Unknown /admin/* URLs: still behind admin authentication (middleware + this
 * check), then the admin-styled 404 instead of the storefront one.
 */
export default async function AdminMissingPage() {
  await requireAdminPage();
  notFound();
}
