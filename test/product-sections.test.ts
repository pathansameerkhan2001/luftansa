import assert from "node:assert/strict";
import {
  bySection, categoryForType, countUniqueFragrances, signatureScentsTitle, displayName, fragranceKey, looksLikeRollOnVariant, perfumesWithRollOnSizes, productFormat, productIdFor, SECTION_ROUTE,
} from "@/lib/catalogue/product-format";
import { PRIMARY_NAV, SHOW_WISHLIST_ICON } from "@/components/header/nav-config";
import { fragranceNotesSchema, MAX_NOTES_PER_GROUP, productCreateInputSchema } from "@/lib/db/schemas";
import { ENTITY } from "@/lib/db/keys";
import type { ProductItem, ProductVariantItem } from "@/lib/db/schemas";
import { buildStorefrontCatalogue, mapProductToStorefront, toStorefrontCardData } from "@/lib/storefront/products";
import { queryWords, searchProducts } from "@/lib/storefront/search";
import { buildWhatsAppOrderMessage } from "@/lib/storefront/whatsapp-order";

console.log("--- Testing Perfume / Roll-On sections ---");

const NOW = "2026-11-21T10:00:00.000Z";
function product(id: string, name: string, productTypeId: string | undefined, extra: Partial<ProductItem> = {}): ProductItem {
  return {
    pk: `PRODUCT#${id}`, sk: "META", entityType: ENTITY.product, id, name, productTypeId, category: "Perfumes", status: "ACTIVE",
    notesEnabled: true, sizes: [30, 50, 100], galleryImageKeys: [], keywords: [], notes: { top: [{ id: "vanilla", name: "Vanilla" }], heart: [], base: [{ id: "oud", name: "Oud" }] },
    featured: false, bestseller: false, GSI1PK: "PRODUCTS", GSI1SK: `STATUS#ACTIVE#${id}`, createdAt: NOW, updatedAt: NOW, version: 1, ...extra,
  } as ProductItem;
}
function variant(productId: string, id: string, capacity: number, priceInr: number, extra: Partial<ProductVariantItem> = {}): ProductVariantItem {
  return { pk: `PRODUCT#${productId}`, sk: `VARIANT#${id}`, entityType: ENTITY.variant, productId, id, capacity, unit: "ml", label: `${capacity} ml`, priceInr, status: "ACTIVE", sortOrder: capacity, createdAt: NOW, updatedAt: NOW, version: 1, ...extra } as ProductVariantItem;
}

console.log("1. One rule for both sections...");
{
  assert.equal(productFormat("perfume-spray"), "perfume");
  assert.equal(productFormat(undefined), "perfume", "products created before product types are spray perfumes");
  assert.equal(productFormat(null), "perfume");
  assert.equal(productFormat("roll-on"), "roll-on");
  assert.equal(productFormat("attar"), "other", "other types are in neither section");
  assert.equal(displayName("Black Velvet", "roll-on"), "Black Velvet Roll-On");
  assert.equal(displayName("Black Velvet", "perfume-spray"), "Black Velvet");
  assert.equal(displayName("Oud Roll On", "roll-on"), "Oud Roll On", "not doubled");
  assert.equal(productIdFor("black-velvet", "perfume-spray"), "black-velvet");
  assert.equal(productIdFor("black-velvet", undefined), "black-velvet");
  assert.equal(productIdFor("black-velvet", "roll-on"), "black-velvet-roll-on");
  assert.equal(productIdFor("black-velvet-roll-on", "roll-on"), "black-velvet-roll-on", "suffix not repeated");
  assert.equal(productIdFor("rose", "attar"), "rose-attar");
  const long = productIdFor("a".repeat(70), "roll-on");
  assert.ok(long.length <= 64 && long.endsWith("-roll-on"), "ids stay within 64 characters");
  const s = bySection([{ productTypeId: "roll-on", n: 1 }, { productTypeId: undefined, n: 2 }, { productTypeId: "attar", n: 3 }, { productTypeId: "perfume-spray", n: 4 }]);
  assert.deepEqual([s.perfume.map((x) => x.n), s["roll-on"].map((x) => x.n), s.other.map((x) => x.n)], [[2, 4], [1], [3]]);
  assert.deepEqual(SECTION_ROUTE, { perfume: "/perfumes", "roll-on": "/roll-on" });
  console.log("   ✓ product type decides the section; names and web addresses never collide");
}

console.log("2. Storefront model, cards and order message...");
{
  const perfume = product("black-velvet", "Black Velvet", "perfume-spray");
  const rollOn = product("black-velvet-roll-on", "Black Velvet", "roll-on", { sizes: [8] as never });
  const legacy = product("daily-rizz", "Daily Rizz", undefined);
  const hidden = product("hidden-roll-on", "Hidden", "roll-on", { status: "INACTIVE" });
  const shop = buildStorefrontCatalogue([
    { product: perfume, variants: [variant("black-velvet", "30ml", 30, 449), variant("black-velvet", "50ml", 50, 749)] },
    { product: rollOn, variants: [variant("black-velvet-roll-on", "8ml", 8, 229)] },
    { product: legacy, variants: [variant("daily-rizz", "30ml", 30, 400)] },
    { product: hidden, variants: [variant("hidden-roll-on", "8ml", 8, 199)] },
  ]);
  const sections = bySection(shop);
  assert.deepEqual(sections.perfume.map((p) => p.slug).sort(), ["black-velvet", "daily-rizz"], "Perfumes: spray products only");
  assert.deepEqual(sections["roll-on"].map((p) => p.slug), ["black-velvet-roll-on"], "Roll-On: Roll-On products only (active)");
  const ro = mapProductToStorefront(rollOn, [variant("black-velvet-roll-on", "8ml", 8, 229)]);
  assert.deepEqual([ro.format, ro.displayName, ro.options.map((o) => o.label).join()], ["roll-on", "Black Velvet Roll-On", "8 ml"]);
  const card = toStorefrontCardData(ro);
  assert.deepEqual([card.name, card.placeholder, card.href], ["Black Velvet Roll-On", "roll-on", "/products/black-velvet-roll-on"]);
  const pcard = toStorefrontCardData(mapProductToStorefront(perfume, []));
  assert.deepEqual([pcard.name, pcard.placeholder], ["Black Velvet", "spray"]);
  const msg = buildWhatsAppOrderMessage({ productName: ro.displayName, productId: ro.slug, variantId: "8ml", variantLabel: "8 ml", unitPriceInr: 229, quantity: 2 });
  assert.match(msg, /Product: Black Velvet Roll-On/);
  assert.match(msg, /Product code: black-velvet-roll-on \/ 8ml/, "the order identifies the Roll-On product");
  console.log("   ✓ sections, full names, card icons and WhatsApp order identify the product type");
}

console.log("3. Search finds both types and tells them apart...");
{
  const items = [
    { displayName: "Black Velvet", format: "perfume" as const, category: "Perfumes", keywords: [], notes: { top: [{ name: "Coffee" }], heart: [], base: [{ name: "Vanilla" }] } },
    { displayName: "Black Velvet Roll-On", format: "roll-on" as const, category: "Perfumes", keywords: [], notes: { top: [], heart: [], base: [{ name: "Vanilla" }] } },
    { displayName: "Oud Forest", format: "perfume" as const, category: "Perfumes", keywords: ["woody"], notes: { top: [], heart: [], base: [{ name: "Oud" }] } },
  ];
  const names = (q: string) => searchProducts(items, q).map((p) => p.displayName);
  assert.deepEqual(names("black velvet"), ["Black Velvet", "Black Velvet Roll-On"]);
  assert.deepEqual(names("velvet roll-on"), ["Black Velvet Roll-On"]);
  assert.deepEqual(names("roll on"), ["Black Velvet Roll-On"]);
  assert.deepEqual(names("rollon"), ["Black Velvet Roll-On"]);
  assert.deepEqual(names("spray"), ["Black Velvet", "Oud Forest"]);
  assert.deepEqual(names("vanilla"), ["Black Velvet", "Black Velvet Roll-On"], "notes");
  assert.deepEqual(names("vel"), ["Black Velvet", "Black Velvet Roll-On"], "word starts");
  assert.deepEqual(names("woody"), ["Oud Forest"], "keywords");
  assert.deepEqual(names("elvet"), [], "only whole-word starts");
  assert.deepEqual(names("   "), []);
  assert.ok(queryWords("x".repeat(200)).join("").length <= 80, "query length capped");
  console.log("   ✓ name, format, notes and keywords; Roll-On vs Perfume distinguishable");
}

console.log("4. Migration check: Roll-On sizes inside a Perfume (read-only)...");
{
  assert.ok(looksLikeRollOnVariant({ label: "8 ml Roll-On" }));
  assert.ok(looksLikeRollOnVariant({ label: "8 ml", sku: "LFT-004-RO-008" }));
  assert.ok(!looksLikeRollOnVariant({ label: "30 ml", sku: "LFT-004-SP-030" }));
  assert.ok(!looksLikeRollOnVariant({ label: "8 ml Roll-On", status: "ARCHIVED" }), "archived sizes are not reported");
  const found = perfumesWithRollOnSizes([
    { id: "black-velvet", name: "Black Velvet", productTypeId: "perfume-spray", variants: [{ label: "30 ml" }, { label: "8 ml Roll-On", sku: "LFT-004-RO-008" }] },
    { id: "black-velvet-roll-on", name: "Black Velvet", productTypeId: "roll-on", variants: [{ label: "8 ml", sku: "LFT-004-RO-008" }] },
    { id: "daily-rizz", name: "Daily Rizz", variants: [{ label: "30 ml" }] },
  ]);
  assert.deepEqual(found, [{ id: "black-velvet", name: "Black Velvet", sizes: ["8 ml Roll-On"] }], "only Perfumes are checked; Roll-On products are fine");
  console.log("   ✓ detects old-structure data without changing it");
}

console.log("5. Roll-On category...");
{
  assert.equal(categoryForType("roll-on", "Perfumes"), "Roll-On");
  assert.equal(categoryForType("roll-on", " perfume "), "Roll-On");
  assert.equal(categoryForType("roll-on", "Gift Sets"), "Gift Sets", "a deliberate other category is kept");
  assert.equal(categoryForType("perfume-spray", "Perfumes"), "Perfumes", "Perfumes keep their category");
  assert.equal(categoryForType(undefined, "Perfume"), "Perfume");
  console.log("   ✓ Roll-Ons categorised Roll-On; Perfumes unchanged");
}

console.log("6. Dynamic Signature Scents count...");
{
  assert.equal(fragranceKey("  Black   Velvet "), "black velvet");
  assert.equal(fragranceKey("Black Velvet Roll-On"), "black velvet");
  assert.equal(fragranceKey("Black Velvet roll on"), "black velvet");
  assert.equal(
    countUniqueFragrances([{ name: "Black Velvet" }, { name: "Black Velvet" }, { name: "BLACK VELVET Roll-On" }, { name: "Stonewood" }, { name: "Oud Forest" }]),
    3,
    "a Perfume and its Roll-On count once",
  );
  assert.equal(countUniqueFragrances([]), 0);
  assert.equal(signatureScentsTitle(37), "37 Signature Scents");
  assert.equal(signatureScentsTitle(1), "1 Signature Scent");
  assert.equal(signatureScentsTitle(0), "Signature Scents", "no number when the catalogue is empty");
  // Only active products reach the count (the storefront catalogue excludes hidden ones).
  const shop = buildStorefrontCatalogue([
    { product: product("a", "Alpha", "perfume-spray"), variants: [] },
    { product: product("a-roll-on", "Alpha", "roll-on"), variants: [] },
    { product: product("b", "Beta", "perfume-spray", { status: "INACTIVE" }), variants: [] },
  ]);
  assert.equal(countUniqueFragrances(shop), 1, "hidden products are not counted");
  console.log("   ✓ unique active fragrance names; Perfume + Roll-On once; hidden excluded");
}

console.log("7. Notes: up to 12 per group...");
{
  const notes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, name: `Note ${i}` }));
  assert.equal(MAX_NOTES_PER_GROUP, 12);
  assert.ok(fragranceNotesSchema.safeParse({ top: notes(5), heart: notes(7), base: notes(11) }).success, "Afghan Tiger: 11 Base notes");
  assert.ok(fragranceNotesSchema.safeParse({ base: notes(12) }).success);
  assert.ok(!fragranceNotesSchema.safeParse({ base: notes(13) }).success, "13 refused");
  assert.ok(productCreateInputSchema.safeParse({ id: "afghan-tiger", name: "Afghan Tiger", notes: { top: [], heart: [], base: notes(11) } }).success, "product creation accepts 11");
  assert.ok(fragranceNotesSchema.safeParse({ top: notes(10), heart: notes(10), base: notes(10) }).success, "existing products (≤10) unaffected");
  console.log("   ✓ 11 and 12 accepted; 13 refused; existing data unaffected");
}

console.log("8. Navigation: only pages that exist...");
{
  assert.deepEqual(PRIMARY_NAV.map((n) => n.label), ["Home", "Perfumes", "Roll-On", "Our Story", "Contact Us"]);
  assert.ok(!PRIMARY_NAV.some((n) => /^\/(shop|collections|our-story|contact)\b/.test(n.href)), "no links to pages that do not exist");
  assert.equal(SHOW_WISHLIST_ICON, false, "wishlist icon hidden until /wishlist exists");
  console.log("   ✓ Home, Perfumes, Roll-On, Our Story, Contact Us");
}

console.log("--- Perfume / Roll-On section tests passed ---");
