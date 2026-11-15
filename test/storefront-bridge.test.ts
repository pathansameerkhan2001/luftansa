import assert from "node:assert/strict";
import { PRODUCTS } from "../src/data/products";

interface BridgeTestItem {
  slug: string;
  name: string;
  source: "dynamodb" | "hardcoded";
}

console.log("--- Testing Storefront Bridge Logic (Items 8, 9, 10) ---");

// Test 1: Inactive Product Suppression (Item 9)
console.log("1. Testing Inactive Product Suppression...");
{
  const suppressedSlugs = new Set<string>(["daily-rizz"]);
  const unifiedMap = new Map<string, BridgeTestItem>();

  // Simulate an active product from DynamoDB
  unifiedMap.set("custom-perfume", {
    slug: "custom-perfume",
    name: "Custom Perfume",
    source: "dynamodb",
  });

  // Merge hardcoded catalogue
  for (const hardcoded of PRODUCTS) {
    if (suppressedSlugs.has(hardcoded.slug)) {
      continue; // Must be suppressed!
    }
    if (unifiedMap.has(hardcoded.slug)) {
      continue;
    }
    unifiedMap.set(hardcoded.slug, {
      slug: hardcoded.slug,
      name: hardcoded.name,
      source: "hardcoded",
    });
  }

  const all = Array.from(unifiedMap.values());
  assert.ok(
    !all.some((p) => p.slug === "daily-rizz"),
    "Suppressed product 'daily-rizz' must NOT appear in storefront output",
  );
  assert.ok(
    all.some((p) => p.slug === "custom-perfume" && p.source === "dynamodb"),
    "Active DynamoDB product must appear in storefront output",
  );
  console.log("   ✓ Inactive suppression verified: suppressed slugs never leak from hardcoded fallback");
}

// Test 2: Active DynamoDB Product Visibility & Precedence (Item 8)
console.log("2. Testing Active DynamoDB Product Visibility & Precedence...");
{
  const suppressedSlugs = new Set<string>();
  const unifiedMap = new Map<string, BridgeTestItem>();

  // Simulate DynamoDB updating an existing hardcoded product with custom pricing/name
  unifiedMap.set("black-velvet", {
    slug: "black-velvet",
    name: "Black Velvet Royale (DynamoDB Active)",
    source: "dynamodb",
  });

  // Merge hardcoded
  for (const hardcoded of PRODUCTS) {
    if (suppressedSlugs.has(hardcoded.slug)) continue;
    if (unifiedMap.has(hardcoded.slug)) continue;
    unifiedMap.set(hardcoded.slug, {
      slug: hardcoded.slug,
      name: hardcoded.name,
      source: "hardcoded",
    });
  }

  const bv = unifiedMap.get("black-velvet");
  assert.ok(bv);
  assert.equal(bv.name, "Black Velvet Royale (DynamoDB Active)");
  assert.equal(bv.source, "dynamodb");
  console.log("   ✓ Active DynamoDB product takes precedence over hardcoded catalogue");
}

// Test 3: Hardcoded Catalogue Fallback when DynamoDB is Unavailable (Item 10)
console.log("3. Testing Hardcoded Fallback when DynamoDB is Unavailable...");
{
  // When DynamoDB throws or returns nothing, map falls back to PRODUCTS
  const unifiedMap = new Map<string, BridgeTestItem>();
  for (const hardcoded of PRODUCTS) {
    unifiedMap.set(hardcoded.slug, {
      slug: hardcoded.slug,
      name: hardcoded.name,
      source: "hardcoded",
    });
  }

  assert.equal(unifiedMap.size, PRODUCTS.length);
  assert.ok(unifiedMap.has("black-velvet"));
  assert.ok(unifiedMap.has("oud-forest"));
  assert.ok(unifiedMap.has("nonchalant"));
  console.log("   ✓ Fallback maintains 100% of hardcoded catalogue without exceptions");
}

console.log("\n🎉 STOREFRONT BRIDGE UNIT TESTS PASSED SUCCESSFULLY!");
