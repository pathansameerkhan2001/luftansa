import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { getNoteImage, NOTE_IMAGES } from "@/data/fragrance-profiles";
import { ENTITY } from "@/lib/db/keys";
import type { ProductItem } from "@/lib/db/schemas";
import { mapProductToStorefront } from "@/lib/storefront/products";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const NOW = "2026-11-28T10:00:00.000Z";
function product(id: string, notes: ProductItem["notes"]): ProductItem {
  return {
    pk: `PRODUCT#${id}`, sk: "META", entityType: ENTITY.product, id, name: id, productTypeId: "perfume-spray", category: "Perfumes", status: "ACTIVE",
    notesEnabled: true, sizes: [50], galleryImageKeys: [], keywords: [], notes,
    featured: false, bestseller: false, GSI1PK: "PRODUCTS", GSI1SK: `STATUS#ACTIVE#${id}`, createdAt: NOW, updatedAt: NOW, version: 1,
  } as unknown as ProductItem;
}

console.log("--- Testing circular fragrance notes ---");

console.log("1. Curated ingredient photography...");
{
  for (const n of ["Pineapple", "Birch", "  pineapple ", "BLACK  PEPPER"]) assert.ok(getNoteImage(n), `${n} has a photo`);
  assert.equal(getNoteImage("Orange"), NOTE_IMAGES.mandarin, "aliases share a photo");
  assert.equal(getNoteImage("Cedar"), NOTE_IMAGES.cedarwood);
  assert.equal(getNoteImage("Bergamot"), undefined, "no photo: monogram fallback, never a substitute ingredient");
  for (const [k, v] of Object.entries(NOTE_IMAGES)) {
    assert.match(v.src, /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/, `${k}: allowed image host`);
    assert.ok(v.alt.length > 3, `${k}: alt text`);
  }
  // Imported products store these exact URLs; they must not change.
  assert.equal(NOTE_IMAGES.citrus.src, "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=320&q=75&fm=jpg");
  console.log("   ✓ photos for common notes, aliases, alt text, unchanged legacy URLs");
}

console.log("2. Each product renders its own notes...");
{
  const a = mapProductToStorefront(product("trail", { top: [{ id: "t", name: "Bergamot" }], heart: [{ id: "h", name: "Pineapple" }], base: [{ id: "b", name: "Birch" }] }), []);
  assert.deepEqual([a.notes.top[0].name, a.notes.heart[0].name, a.notes.base[0].name], ["Bergamot", "Pineapple", "Birch"]);
  assert.equal(a.notes.top[0].image, undefined, "Bergamot without a photo: no image (monogram)");
  assert.deepEqual(a.notes.heart[0].image, getNoteImage("Pineapple"), "no upload: curated photo and its alt text");
  const b = mapProductToStorefront(product("rose", { top: [{ id: "t", name: "Pineapple", imageKey: "https://images.unsplash.com/photo-own?x=1" }], heart: [{ id: "h", name: "Rose" }], base: [] }), []);
  assert.deepEqual(b.notes.top[0].image, { src: "https://images.unsplash.com/photo-own?x=1", alt: "Pineapple" }, "an uploaded note photo always wins");
  assert.equal(b.notes.heart[0].name, "Rose");
  assert.equal(b.notes.base.length, 0, "empty tier stays empty");
  console.log("   ✓ notes come from product data; uploads win; curated fallback; no hardcoded notes");
}

console.log("3. Page structure...");
{
  const circles = read("components/product/FragranceNoteCircles.tsx");
  assert.ok(!/Bergamot|Pineapple|Birch/.test(circles), "no hardcoded notes");
  assert.match(circles, /rounded-full/);
  assert.match(circles, /note\.image \?/, "fallback when the photo is missing");
  const sections = read("components/product/ProductInfoSections.tsx");
  assert.match(sections, /<FragranceNoteCircles notes=\{notes\} \/>/, "notes shown as circles in the Fragrance Notes section");
  assert.ok(!sections.includes("#fragrance-notes"), "no link to the removed section");
  const page = read("app/products/[slug]/page.tsx");
  assert.ok(!page.includes("FragranceNotesShowcase"), "large Fragrance Notes section removed");
  assert.ok(!existsSync(new URL("../src/components/product/FragranceNotesShowcase.tsx", import.meta.url)), "old component deleted");
  console.log("   ✓ circles in the product information; old section gone; notes appear once");
}

console.log("--- Circular fragrance notes tests passed ---");
