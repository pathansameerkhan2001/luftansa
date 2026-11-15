import assert from "node:assert/strict";
import { PRODUCTS } from "../src/data/products";
import { buildLegacyCatalogue } from "../src/lib/catalogue/legacy-catalogue";
import { buildStorefrontCatalogue, fallbackStorefrontCatalogue } from "../src/lib/storefront/products";

console.log("--- Testing Storefront Data Source (DynamoDB single source of truth) ---");

const NOW = "2026-11-15T00:00:00.000Z";
const { entries } = buildLegacyCatalogue({ now: NOW });

// 1. Products deleted from DynamoDB never reappear from the hardcoded catalogue
console.log("1. Deleted products do not reappear...");
{
  const withoutOud = entries.filter((e) => e.product.id !== "oud-forest");
  const catalogue = buildStorefrontCatalogue(withoutOud);
  assert.ok(!catalogue.some((p) => p.slug === "oud-forest"), "Deleted product must not be resurrected from code");
  assert.equal(catalogue.length, PRODUCTS.length - 1);
  assert.ok(catalogue.every((p) => p.source === "dynamodb"));
  console.log("   ✓ Storefront reflects DynamoDB exactly (no hardcoded merge)");
}

// 2. Inactive products are suppressed
console.log("2. Inactive products are suppressed...");
{
  const catalogue = buildStorefrontCatalogue(
    entries.map((e) => (e.product.id === "daily-rizz" ? { ...e, product: { ...e.product, status: "INACTIVE" as const } } : e)),
  );
  assert.ok(!catalogue.some((p) => p.slug === "daily-rizz"));
  console.log("   ✓ Inactive suppression verified");
}

// 3. Admin data is what the storefront shows
console.log("3. DynamoDB values are rendered as-is...");
{
  const catalogue = buildStorefrontCatalogue(
    entries.map((e) => (e.product.id === "black-velvet" ? { ...e, product: { ...e.product, name: "Black Velvet Royale" } } : e)),
  );
  assert.equal(catalogue.find((p) => p.slug === "black-velvet")!.name, "Black Velvet Royale");
  console.log("   ✓ Admin edits flow through unchanged");
}

// 4. An empty DynamoDB catalogue means an empty storefront (no silent merge)
console.log("4. Empty DynamoDB catalogue is respected...");
{
  assert.deepEqual(buildStorefrontCatalogue([]), []);
  console.log("   ✓ No hardcoded products injected");
}

// 5. Outage fallback (used only when DynamoDB cannot be reached)
console.log("5. Outage fallback contains the legacy catalogue...");
{
  const fallback = fallbackStorefrontCatalogue();
  assert.equal(fallback.length, PRODUCTS.length);
  assert.ok(fallback.every((p) => p.source === "fallback"));
  console.log("   ✓ Outage fallback verified");
}

console.log("\n🎉 STOREFRONT BRIDGE UNIT TESTS PASSED SUCCESSFULLY!");
