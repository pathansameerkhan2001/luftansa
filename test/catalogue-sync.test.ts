import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { InMemoryDynamoClient } from "./helpers/in-memory-dynamo";
import {
  BEST_SELLER_SLUGS,
  PERSONALITY_COLLECTION_SLUGS,
  PRODUCTS,
  SIGNATURE_PRODUCT_SLUGS,
  sprayOptions,
} from "../src/data/products";
import { FRAGRANCE_PROFILES, getNoteImage } from "../src/data/fragrance-profiles";
import { buildLegacyCatalogue } from "../src/lib/catalogue/legacy-catalogue";
import {
  applyCatalogueImport,
  planCatalogueImport,
  resolveAuthorizedActor,
  UnauthorizedActorError,
} from "../src/lib/catalogue/import-catalogue";
import { AuditService } from "../src/lib/db/audit";
import { ConflictError, Repository, ValidationError } from "../src/lib/db/repository";
import { createProduct, getProductWithVariants, listAllProductsWithVariants, updateProduct } from "../src/lib/db/products-service";
import { productTypeItemSchema, productVariantItemSchema, type ProductItem } from "../src/lib/db/schemas";
import { ENTITY, keys } from "../src/lib/db/keys";
import { selectBestSellers, selectPersonality, selectSignature } from "../src/lib/storefront/collections";
import { buildStorefrontCatalogue, fallbackStorefrontCatalogue, toStorefrontOptions } from "../src/lib/storefront/products";
import { findEncodingWithinLimit, fitWithin, ImageCompressionError } from "../src/lib/media/compress-image";

const TABLE = "luftansa-store";
const NOW = "2026-11-15T00:00:00.000Z";
const ACTOR = "admin@luftansa.example";

function freshRepo() {
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, TABLE);
  return { client, repo, audit: new AuditService(repo) };
}

const slugsOf = (list: { slug: string }[]) => list.map((p) => p.slug);

console.log("--- Catalogue Sync, Collections, Optional SKU/Stock & Image Compression Tests ---");

// 1. Legacy catalogue -> DynamoDB items carry over only what the storefront shows
console.log("1. Legacy catalogue conversion preserves data without inventing values...");
{
  const { entries, warnings } = buildLegacyCatalogue({ now: NOW, productTypeName: "Perfume Spray" });
  assert.equal(entries.length, PRODUCTS.length);
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries.map((e) => e.product.id), PRODUCTS.map((p) => p.slug), "Slugs preserved as product IDs");

  for (const [i, { product, variants }] of entries.entries()) {
    const legacy = PRODUCTS[i];
    assert.equal(product.name, legacy.name);
    assert.equal(product.status, "ACTIVE");
    assert.equal(product.category, "Perfume", "Category shown on the storefront today");
    assert.equal(product.productTypeId, "perfume-spray");
    assert.equal(product.productTypeName, "Perfume Spray");
    assert.equal(product.mainImageKey, undefined, "No images exist; none invented");
    assert.deepEqual(product.galleryImageKeys, []);
    assert.equal(product.concentration, undefined);
    assert.equal(product.gender, undefined);
    assert.equal(product.displayOrder, i);
    assert.deepEqual(variants.map((v) => v.id), ["30ml", "50ml", "100ml"], "Storefront option IDs preserved");
    assert.deepEqual(variants.map((v) => v.sk), ["VARIANT#30ml", "VARIANT#50ml", "VARIANT#100ml"]);
    assert.deepEqual(variants.map((v) => v.priceInr), [400, 630, 1000], "Confirmed standard prices only");
    for (const v of variants) {
      assert.equal(v.sku, undefined, "No SKU is generated");
      assert.equal(v.stockQuantity, undefined, "No stock quantity is invented");
      assert.equal(v.status, "ACTIVE");
      productVariantItemSchema.parse(v);
    }
  }

  const rizz = entries.find((e) => e.product.id === "daily-rizz")!.product;
  assert.equal(rizz.description, FRAGRANCE_PROFILES["daily-rizz"].description, "Daily Rizz description imported exactly");
  assert.deepEqual(rizz.notes.top.map((n) => n.name), ["Citrus"]);
  assert.deepEqual(rizz.notes.heart.map((n) => n.name), ["Musk"]);
  assert.deepEqual(rizz.notes.base.map((n) => n.name), ["Amber"]);
  assert.equal(rizz.notes.top[0].imageKey, getNoteImage("Citrus")!.src, "Note photography preserved");
  assert.equal(rizz.notes.heart[0].imageKey, undefined);
  assert.deepEqual(rizz.unverifiedFields, ["description", "notes"], "Daily Rizz content flagged as unverified");

  for (const e of entries.filter((x) => x.product.id !== "daily-rizz")) {
    assert.equal(e.product.description, undefined, `${e.product.id}: no description invented`);
    assert.equal(e.product.notes.top.length + e.product.notes.heart.length + e.product.notes.base.length, 0);
    assert.equal(e.product.unverifiedFields, undefined);
  }
}
console.log("   ✓ IDs, variant IDs, prices, notes and unverified flags verified (no SKU/stock invented)");

// 2. Homepage collection placements are preserved exactly
console.log("2. Collection placements (Signature, Personality, Best Sellers) preserved...");
{
  const { entries } = buildLegacyCatalogue({ now: NOW });
  const catalogue = buildStorefrontCatalogue(entries);

  assert.deepEqual(slugsOf(selectSignature(catalogue)), [...SIGNATURE_PRODUCT_SLUGS]);
  assert.deepEqual(slugsOf(selectBestSellers(catalogue)), [...BEST_SELLER_SLUGS]);

  // Previous behaviour: personality members first, then every other active product in catalogue order.
  const expectedPersonality = [
    ...PERSONALITY_COLLECTION_SLUGS,
    ...PRODUCTS.map((p) => p.slug).filter((s) => !(PERSONALITY_COLLECTION_SLUGS as readonly string[]).includes(s)),
  ];
  assert.deepEqual(slugsOf(selectPersonality(catalogue)), expectedPersonality);

  // A product without display order (e.g. test-product) is listed after ordered ones.
  const extra = {
    ...entries[0],
    product: { ...entries[0].product, id: "test-product", name: "test", displayOrder: undefined, collections: [], bestseller: true },
  };
  const withExtra = buildStorefrontCatalogue([extra, ...entries]);
  assert.equal(selectPersonality(withExtra).at(-1)!.slug, "test-product");
  assert.equal(selectBestSellers(withExtra).at(-1)!.slug, "test-product");
  assert.deepEqual(slugsOf(selectSignature(withExtra)), [...SIGNATURE_PRODUCT_SLUGS]);
}
console.log("   ✓ Collection membership and order identical to the current storefront");

// 3. Storefront output for imported products matches what is displayed today
console.log("3. Imported products render the same options, prices and notes as before...");
{
  const { entries } = buildLegacyCatalogue({ now: NOW });
  const catalogue = buildStorefrontCatalogue(entries);
  for (const legacy of PRODUCTS) {
    const p = catalogue.find((x) => x.slug === legacy.slug)!;
    const pick = (o: { id: string; label: string; priceInr: number }) => ({ id: o.id, label: o.label, priceInr: o.priceInr });
    assert.deepEqual(p.options.map(pick), sprayOptions(legacy).map(pick), `${legacy.slug}: cart option IDs/prices unchanged`);
    assert.equal(p.mainImage, undefined);
  }
  const rizz = catalogue.find((p) => p.slug === "daily-rizz")!;
  assert.equal(rizz.hasNotes, true);
  assert.deepEqual(rizz.notes.top[0].image, getNoteImage("Citrus"), "Note image src and alt text preserved");
  assert.equal(rizz.notes.heart[0].image, undefined);

  // Outage fallback renders the same catalogue.
  assert.deepEqual(slugsOf(fallbackStorefrontCatalogue()), slugsOf(catalogue));
  assert.ok(fallbackStorefrontCatalogue().every((p) => p.source === "fallback"));
}
console.log("   ✓ Storefront rendering parity verified");

// 4. Only active products and active variants are public; nothing is synthesised
console.log("4. Inactive products/variants hidden; no synthesised options...");
{
  const { entries } = buildLegacyCatalogue({ now: NOW });
  const [first, second, ...rest] = entries;
  const inactive = { ...first, product: { ...first.product, status: "INACTIVE" as const } };
  const mixed = {
    ...second,
    variants: second.variants.map((v, i) => (i === 0 ? { ...v, status: "INACTIVE" as const } : i === 1 ? { ...v, status: "ARCHIVED" as const } : v)),
  };
  const catalogue = buildStorefrontCatalogue([inactive, mixed, ...rest]);
  assert.ok(!catalogue.some((p) => p.slug === first.product.id), "Inactive product hidden");
  assert.deepEqual(catalogue.find((p) => p.slug === second.product.id)!.options.map((o) => o.id), ["100ml"]);
  assert.deepEqual(toStorefrontOptions([]), [], "No options invented when there are no active variants");
}
console.log("   ✓ Public visibility rules verified");

// 5. Import is idempotent, never overwrites, and prevents duplicates
console.log("5. Catalogue import: missing products only, idempotent, no overwrites...");
{
  const { client, repo, audit } = freshRepo();
  await repo.create(
    { ...keys.productType("perfume-spray"), entityType: ENTITY.productType, id: "perfume-spray", name: "Perfume Spray", createdAt: NOW, updatedAt: NOW, version: 1 },
    productTypeItemSchema,
  );
  // Existing products that must be preserved untouched.
  await createProduct(repo, audit, ACTOR, {
    id: "test-product",
    name: "test",
    description: "oijnljljojl",
    bestseller: true,
    mainImageKey: "products/test-product/main/a.png",
    variants: [{ id: "00030", capacity: 30, unit: "ml", priceInr: 400, stockQuantity: 100, sku: "LUF-TEST-PRODUCT-30ML" }],
  });
  await createProduct(repo, audit, ACTOR, {
    id: "oud-forest",
    name: "Oud Forest",
    description: "Admin-written description",
    status: "INACTIVE",
    mainImageKey: "products/oud-forest/main/b.jpg",
    variants: [{ id: "30ml", capacity: 30, unit: "ml", priceInr: 450, stockQuantity: 3, sku: "OF-30" }],
  });
  // Same name under another slug must not be duplicated.
  await createProduct(repo, audit, ACTOR, { id: "nonchalant-edp", name: "Nonchalant", variants: [{ capacity: 30, unit: "ml", priceInr: 400 }] });

  const before = JSON.stringify(client.dump(TABLE).filter((i) => String(i.pk).startsWith("PRODUCT#")));
  const plan = await planCatalogueImport(repo, NOW);
  const byAction = (a: string) => plan.items.filter((i) => i.action === a).map((i) => i.slug);
  assert.deepEqual(byAction("skip_exists"), ["oud-forest"]);
  assert.deepEqual(byAction("skip_possible_duplicate"), ["nonchalant"]);
  assert.deepEqual(byAction("create"), ["black-velvet", "downtown-tam", "daily-rizz", "green-flag-energy", "main-character", "deja-vu"]);
  assert.equal(plan.productTypeName, "Perfume Spray");
  assert.equal(JSON.stringify(client.dump(TABLE).filter((i) => String(i.pk).startsWith("PRODUCT#"))), before, "Planning writes nothing");

  const result = await applyCatalogueImport(repo, audit, ACTOR, plan);
  assert.equal(result.created.length, 6);

  // Existing products untouched (inactive one included).
  const oud = await getProductWithVariants(repo, "oud-forest");
  assert.equal(oud!.product.status, "INACTIVE");
  assert.equal(oud!.product.description, "Admin-written description");
  assert.equal(oud!.product.mainImageKey, "products/oud-forest/main/b.jpg");
  assert.equal(oud!.product.version, 1);
  assert.equal(oud!.variants[0].priceInr, 450);
  const test = await getProductWithVariants(repo, "test-product");
  assert.equal(test!.product.version, 1);
  assert.equal(test!.variants[0].sku, "LUF-TEST-PRODUCT-30ML");
  assert.equal(test!.variants[0].stockQuantity, 100);

  // Re-running is a no-op.
  const again = await planCatalogueImport(repo, NOW);
  assert.equal(again.items.filter((i) => i.action === "create").length, 0);
  const second = await applyCatalogueImport(repo, audit, ACTOR, again);
  assert.equal(second.created.length, 0);

  // A stale plan (product created meanwhile) cannot overwrite.
  const stale = await applyCatalogueImport(repo, audit, ACTOR, plan);
  assert.equal(stale.created.length, 0);
  assert.ok(stale.skipped.some((s) => s.reason.includes("concurrently")));

  // Admin list shows everything, including inactive products.
  const all = await listAllProductsWithVariants(repo);
  assert.equal(all.length, 9);
  assert.ok(all.some((e) => e.product.id === "oud-forest" && e.product.status === "INACTIVE"));

  // Storefront shows active products only, from the same data.
  const storefront = buildStorefrontCatalogue(all);
  assert.ok(!storefront.some((p) => p.slug === "oud-forest"), "Inactive product hidden from storefront");
  assert.ok(storefront.some((p) => p.slug === "black-velvet"));

  const imported = client.dump(TABLE).filter((i) => i.pk === "PRODUCT#black-velvet");
  assert.equal(imported.length, 4, "1 product + 3 variants");
  assert.ok(imported.every((i) => !("sku" in i) && !("stockQuantity" in i)));
}
console.log("   ✓ Idempotent, non-overwriting, duplicate-safe import verified");

// 6. Admin edits flow to the storefront data
console.log("6. Admin edits (incl. collections and order) reflected in storefront data...");
{
  const { repo, audit } = freshRepo();
  const { entries } = buildLegacyCatalogue({ now: NOW });
  const plan = { items: entries.map((entry) => ({ slug: entry.product.id, name: entry.product.name, action: "create" as const, entry })), warnings: [], existingProducts: [] };
  await applyCatalogueImport(repo, audit, ACTOR, plan);

  const current = await getProductWithVariants(repo, "oud-forest");
  await updateProduct(repo, audit, ACTOR, "oud-forest", {
    version: current!.product.version,
    description: "Confirmed description",
    mainImageKey: "products/oud-forest/main/1-photo.jpg",
    collections: ["signature", "personality"],
    displayOrder: 0,
    variants: [
      { id: "30ml", capacity: 30, unit: "ml", priceInr: 400 },
      { id: "50ml", capacity: 50, unit: "ml", priceInr: 630, status: "INACTIVE" },
      { id: "100ml", capacity: 100, unit: "ml", priceInr: 1000 },
    ],
  });
  const storefront = buildStorefrontCatalogue(await listAllProductsWithVariants(repo));
  const oud = storefront.find((p) => p.slug === "oud-forest")!;
  assert.equal(oud.description, "Confirmed description");
  assert.equal(oud.mainImage!.src, "/media/products/oud-forest/main/1-photo.jpg", "Image key resolves through /media/");
  assert.deepEqual(oud.options.map((o) => o.id), ["30ml", "100ml"]);
  // displayOrder 0 ties with Black Velvet (0) and sorts by name; Downtown Tam (1) follows.
  assert.deepEqual(slugsOf(selectPersonality(storefront)).slice(0, 3), ["black-velvet", "oud-forest", "downtown-tam"]);
  assert.deepEqual(slugsOf(selectSignature(storefront)), ["black-velvet", "oud-forest", "downtown-tam"]);

  // Unverified flag cleared by the admin.
  const rizz = await getProductWithVariants(repo, "daily-rizz");
  const verified = await updateProduct(repo, audit, ACTOR, "daily-rizz", { version: rizz!.product.version, unverifiedFields: [] });
  assert.deepEqual(verified.product.unverifiedFields, []);
  assert.equal(verified.product.description, FRAGRANCE_PROFILES["daily-rizz"].description, "Content untouched when verified");
}
console.log("   ✓ Admin edits reflected verified");

// 7. Optional SKU and stock
console.log("7. Optional SKU/stock: unset vs genuine zero, preservation of existing values...");
{
  const { repo, audit } = freshRepo();
  const created = await createProduct(repo, audit, ACTOR, {
    id: "sku-test",
    name: "SKU Test",
    variants: [
      { id: "30ml", capacity: 30, unit: "ml", priceInr: 400 },
      { id: "50ml", capacity: 50, unit: "ml", priceInr: 630, stockQuantity: 0, sku: "REAL-50" },
    ],
  });
  assert.equal(created.variants[0].sku, undefined, "No SKU generated");
  assert.equal(created.variants[0].stockQuantity, undefined, "Stock left unset");
  assert.equal(created.variants[1].stockQuantity, 0, "Zero stock is a real value");
  assert.equal(created.variants[1].sku, "REAL-50");

  // Omitted fields keep existing values; null clears; 0 stays 0.
  let r = await updateProduct(repo, audit, ACTOR, "sku-test", {
    version: 1,
    variants: [{ id: "30ml", capacity: 30, unit: "ml", priceInr: 400 }, { id: "50ml", capacity: 50, unit: "ml", priceInr: 630 }],
  });
  assert.equal(r.variants.find((v) => v.id === "50ml")!.sku, "REAL-50");
  assert.equal(r.variants.find((v) => v.id === "50ml")!.stockQuantity, 0);
  r = await updateProduct(repo, audit, ACTOR, "sku-test", {
    version: 2,
    variants: [
      { id: "30ml", capacity: 30, unit: "ml", priceInr: 400, stockQuantity: 12, sku: "REAL-30" },
      { id: "50ml", capacity: 50, unit: "ml", priceInr: 630, stockQuantity: null, sku: null },
    ],
  });
  const stored = await getProductWithVariants(repo, "sku-test");
  const v30 = stored!.variants.find((v) => v.id === "30ml")!;
  const v50 = stored!.variants.find((v) => v.id === "50ml")!;
  assert.equal(v30.stockQuantity, 12);
  assert.equal(v30.sku, "REAL-30");
  assert.equal(v50.stockQuantity, undefined, "null clears stock to Not set");
  assert.equal(v50.sku, undefined, "null clears SKU");

  // Legacy items with required-era SKU/stock still parse and are preserved.
  productVariantItemSchema.parse({ ...v30, sku: "LEGACY", stockQuantity: 5 });

  // Prices are never invented for non-standard sizes.
  await assert.rejects(
    createProduct(repo, audit, ACTOR, { id: "no-price", name: "No Price", variants: [{ capacity: 8, unit: "ml" }] }),
    ValidationError,
  );
  await assert.rejects(
    createProduct(repo, audit, ACTOR, { id: "sku-test", name: "Duplicate", variants: [{ capacity: 30, unit: "ml" }] }),
    ConflictError,
    "Duplicate product IDs rejected",
  );
}
console.log("   ✓ Optional SKU/stock semantics verified");

// 8. Browser image compression search
console.log("8. Image compression: original kept when small, quality-first search, clear failure...");
{
  assert.deepEqual(fitWithin(6000, 4000, 4096), { width: 4096, height: 2731 });
  assert.deepEqual(fitWithin(800, 600, 4096), { width: 800, height: 600 });

  const LIMIT = 4 * 1024 * 1024;
  const calls: { w: number; q: number; type: string }[] = [];
  // Synthetic encoder: size proportional to pixels * quality.
  const encoder = (bytesPerPixelAtFull: number, supportsWebp = true) =>
    async (w: number, h: number, type: string, q: number) => {
      calls.push({ w, q, type });
      const outType = type === "image/webp" && !supportsWebp ? "image/png" : type;
      // Size-only stand-in for a Blob (avoids allocating large buffers in tests).
      return { size: Math.round(w * h * bytesPerPixelAtFull * q), type: outType } as unknown as Blob;
    };

  // Fits at the first (highest) quality and full resolution.
  calls.length = 0;
  let r = await findEncodingWithinLimit({ width: 4000, height: 3000 }, "image/jpeg", encoder(0.3));
  assert.equal(r.quality, 0.92);
  assert.equal(r.width, 4000);
  assert.ok(r.blob.size <= LIMIT);
  assert.equal(calls.length, 1);

  // Needs downscaling: never below the minimum edge, quality tried before resolution.
  calls.length = 0;
  r = await findEncodingWithinLimit({ width: 6000, height: 4000 }, "image/jpeg", encoder(0.6));
  assert.ok(r.blob.size <= LIMIT);
  assert.ok(r.width < 4096 && Math.max(r.width, r.height) >= 1200);
  assert.equal(calls[0].q, 0.92);

  // Browser without WebP encoding falls back to JPEG.
  r = await findEncodingWithinLimit({ width: 3000, height: 2000 }, "image/webp", encoder(0.5, false));
  assert.equal(r.blob.type, "image/jpeg");

  // Impossible: clear error.
  await assert.rejects(
    findEncodingWithinLimit({ width: 6000, height: 4000 }, "image/jpeg", encoder(1000)),
    (e: unknown) => e instanceof ImageCompressionError && /could not be reduced below 4\.0 MB/.test((e as Error).message),
  );
}
console.log("   ✓ Compression strategy verified");

// 9. Import actor must be on the ADMIN_EMAILS allow-list
console.log("9. Import --apply actor authorization against ADMIN_EMAILS...");
{
  const allow = "owner@luftansa.example, second@luftansa.example";
  assert.equal(resolveAuthorizedActor("owner@luftansa.example", allow), "owner@luftansa.example");
  // Same normalisation as the admin login (case, whitespace, mailto:, quotes).
  assert.equal(resolveAuthorizedActor("  Mailto:OWNER@Luftansa.Example ", allow), "owner@luftansa.example");
  assert.equal(resolveAuthorizedActor("second@luftansa.example", "owner@luftansa.example;second@luftansa.example"), "second@luftansa.example");

  const rejects = (actor: string | undefined, list: string | undefined, pattern: RegExp) =>
    assert.throws(() => resolveAuthorizedActor(actor, list), (e: unknown) => e instanceof UnauthorizedActorError && pattern.test((e as Error).message));
  rejects("intruder@example.com", allow, /not on the ADMIN_EMAILS allow-list/);
  rejects("owner@luftansa.example.evil.com", allow, /not on the ADMIN_EMAILS allow-list/);
  rejects("owner", allow, /not on the ADMIN_EMAILS allow-list/);
  rejects(undefined, allow, /requires --actor/);
  rejects("", allow, /requires --actor/);
  rejects("owner@luftansa.example", undefined, /not configured/);
  rejects("owner@luftansa.example", "   ", /not configured/);
  rejects("owner@luftansa.example", "not-an-email", /no valid email addresses/);

  // Rejection messages never disclose the allow-list.
  try {
    resolveAuthorizedActor("intruder@example.com", allow);
  } catch (e) {
    assert.ok(!(e as Error).message.includes("owner@") && !(e as Error).message.includes("second@"));
    assert.ok((e as Error).message.includes("in***@example.com"), "Actor shown masked");
  }
}
console.log("   ✓ Only allow-listed administrators can apply the import");

// Type-level guard: ProductItem gained optional metadata only.
const _typeCheck: Pick<ProductItem, "collections" | "displayOrder" | "unverifiedFields"> = {};
void _typeCheck;

console.log("\n🎉 ALL CATALOGUE SYNC TESTS PASSED SUCCESSFULLY!");
