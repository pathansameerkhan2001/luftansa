import { countUniqueFragrances, signatureScentsTitle } from "@/lib/catalogue/product-format";
import { getActiveStorefrontProducts } from "@/lib/storefront/products";
import { BenefitsStrip, DEFAULT_BENEFITS } from "./BenefitsStrip";

/**
 * Homepage benefits strip with the live fragrance count (Server Component).
 * Hidden and inactive products are excluded (only active products are read).
 */
export async function HomeBenefits() {
  const count = countUniqueFragrances(await getActiveStorefrontProducts());
  const [scents, ...rest] = DEFAULT_BENEFITS;
  return <BenefitsStrip items={[{ ...scents, title: signatureScentsTitle(count) }, ...rest]} />;
}
