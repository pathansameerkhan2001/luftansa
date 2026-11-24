import "server-only";

import { loadPublished } from "@/lib/cms/loader";
import { POLICY_DEFAULTS, POLICY_KEYS, POLICY_LABEL, POLICY_MODULES, POLICY_ROUTE, resolvePolicy, toPolicyView, type PolicyKey, type PolicyView } from "@/lib/cms/modules/policy-pages";

/** A policy page as the storefront shows it, or null when deactivated in Admin. */
export async function loadPolicy(key: PolicyKey): Promise<PolicyView | null> {
  return loadPublished(POLICY_MODULES[key], [POLICY_DEFAULTS[key]]).then(
    (r) => resolvePolicy(key, r),
    () => toPolicyView(key, POLICY_DEFAULTS[key]),
  );
}

/** Footer/FAQ links to the policy pages that are live (deactivated pages are left out). */
export async function livePolicyLinks(): Promise<{ key: PolicyKey; label: string; href: string }[]> {
  const views = await Promise.all(POLICY_KEYS.map((k) => loadPolicy(k)));
  return POLICY_KEYS.filter((_, i) => views[i] !== null).map((key) => ({ key, label: POLICY_LABEL[key], href: POLICY_ROUTE[key] }));
}
