import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { getNoteImage, NOTE_IMAGES } from "@/data/fragrance-profiles";
import { ALL_NOTE_PHOTOS, FAMILY_IMAGES, noteFamily, withFamilyImages } from "@/data/note-families";
import { ENTITY } from "@/lib/db/keys";
import type { ProductItem } from "@/lib/db/schemas";
import { mapProductToStorefront } from "@/lib/storefront/products";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = "2026-11-28T10:00:00.000Z";
function product(id: string, notes: ProductItem["notes"]): ProductItem {
  return {
    pk: `PRODUCT#${id}`, sk: "META", entityType: ENTITY.product, id, name: id, productTypeId: "perfume-spray", category: "Perfumes", status: "ACTIVE",
    notesEnabled: true, sizes: [50], galleryImageKeys: [], keywords: [], notes,
    featured: false, bestseller: false, GSI1PK: "PRODUCTS", GSI1SK: `STATUS#ACTIVE#${id}`, createdAt: NOW, updatedAt: NOW, version: 1,
  } as unknown as ProductItem;
}
const note = (name: string, imageKey?: string) => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name, ...(imageKey ? { imageKey } : {}) });

console.log("--- Testing circular fragrance notes ---");

console.log("1. Ingredient photography...");
{
  for (const n of ["Bergamot", "Pineapple", "Birch", "  pineapple ", "BLACK  PEPPER", "Vanilla", "Tuberose", "Neroli"]) assert.ok(getNoteImage(n), `${n} has its own photo`);
  assert.equal(getNoteImage("Neroli"), NOTE_IMAGES["orange blossom"], "aliases: other names of the same ingredient");
  assert.equal(getNoteImage("Cedar"), NOTE_IMAGES.cedarwood);
  assert.notEqual(getNoteImage("Orange"), getNoteImage("Mandarin"), "orange has its own photo");
  const srcs = Object.values(NOTE_IMAGES).map((i) => i.src);
  assert.equal(new Set(srcs).size, srcs.length, "every ingredient has a unique photo");
  const familySrcs = Object.values(FAMILY_IMAGES).flat().map((i) => i.src);
  assert.equal(new Set(familySrcs).size, familySrcs.length, "family photos are unique");
  assert.ok(!familySrcs.some((s) => srcs.includes(s)), "family photos never reuse an ingredient's photo");
  const hosts = /^https:\/\/(images\.unsplash\.com\/photo-[\w-]+\?|images\.pexels\.com\/photos\/\d+\/|cdn\.pixabay\.com\/photo\/)/;
  for (const img of ALL_NOTE_PHOTOS) {
    assert.match(img.src, hosts, `${img.alt}: allowed image host`);
    assert.ok(img.alt.length > 3, `${img.src}: alt text`);
  }
  const config = read("next.config.ts");
  for (const host of ["images.unsplash.com", "images.pexels.com", "cdn.pixabay.com"]) assert.ok(config.includes(`hostname: "${host}"`), `${host} allowed for next/image`);
  // Imported products store these exact URLs; they must not change.
  assert.equal(NOTE_IMAGES.citrus.src, "https://images.unsplash.com/photo-1606926167690-07a1edafd407?w=320&q=75&fm=jpg");
  assert.equal(NOTE_IMAGES.amber.src, "https://images.unsplash.com/photo-1764061148216-f786bcc4b353?w=320&q=75&fm=jpg");
  console.log("   ✓ own photo per ingredient, aliases, unique photos, allowed hosts, alt text, unchanged legacy URLs");
}

console.log("2. Fragrance-family fallback...");
{
  const cases: [string, string][] = [
    ["Musk", "musky"], ["White Musk", "musky"], ["Oud", "woody"], ["Smoked Oud", "woody"], ["Rosewood", "woody"], ["Patchouli", "mossy"],
    ["Tonka Bean", "botanical"], ["Sea Breeze", "aquatic"], ["Green Apple", "fruity"], ["Violet Leaf", "green"], ["Lemon Blossom", "floral"],
    ["Pink Pepper", "spicy"], ["Labdanum", "resinous"], ["Blood Orange", "citrus"], ["Yuzu Zest", "citrus"], ["Xyzzy", "botanical"],
  ];
  for (const [name, family] of cases) assert.equal(noteFamily(name), family, `${name} → ${family}`);
  const [a] = withFamilyImages([[{ name: "Musk" }, { name: "Musk" }, { name: "Ambrette" }]]);
  assert.ok(a.every((n) => n.image), "every note gets a photo");
  assert.equal(new Set(a.map((n) => n.image!.src)).size, 3, "no photo repeats within a product");
  assert.ok(FAMILY_IMAGES.musky.some((i) => i.src === a[0].image!.src), "first choice comes from the note's own family");
  const [b] = withFamilyImages([[{ name: "Musk" }]]);
  assert.deepEqual(b[0].image, a[0].image, "stable: the same note always looks the same");
  const many = withFamilyImages([Array.from({ length: 30 }, (_, i) => ({ name: `Unknown ${i}` }))])[0];
  assert.ok(many.every((n) => n.image), "even beyond the photo pool every note has a photo");
  const kept = { name: "Musk", image: { src: "https://x.test/own.jpg", alt: "own" } };
  assert.equal(withFamilyImages([[kept]])[0][0], kept, "notes with a photo are untouched");
  console.log("   ✓ family by name, unique within a product, stable, never empty");
}

console.log("3. Each product renders its own notes (uploaded → ingredient → family)...");
{
  const a = mapProductToStorefront(product("trail", { top: [note("Bergamot")], heart: [note("Pineapple")], base: [note("Birch")] }), []);
  assert.deepEqual([a.notes.top[0].name, a.notes.heart[0].name, a.notes.base[0].name], ["Bergamot", "Pineapple", "Birch"]);
  assert.deepEqual(a.notes.top[0].image, getNoteImage("Bergamot"));
  assert.deepEqual(a.notes.heart[0].image, getNoteImage("Pineapple"));
  assert.deepEqual(a.notes.base[0].image, getNoteImage("Birch"));
  const own = "https://images.unsplash.com/photo-own?x=1";
  const b = mapProductToStorefront(product("musk", { top: [note("Pineapple", own)], heart: [note("Musk")], base: [note("Oud"), note("Agarwood")] }), []);
  assert.deepEqual(b.notes.top[0].image, { src: own, alt: "Pineapple" }, "an uploaded note photo always wins");
  assert.ok(FAMILY_IMAGES.musky.some((i) => i.src === b.notes.heart[0].image?.src), "Musk: soft musky family photo");
  const woods = b.notes.base.map((n) => n.image?.src);
  assert.ok(woods.every((s) => FAMILY_IMAGES.woody.some((i) => i.src === s)) && woods[0] !== woods[1], "two woods: two different woody photos");
  assert.equal(b.notes.top.length + b.notes.heart.length + b.notes.base.length, 4, "notes come from the product");
  console.log("   ✓ uploaded first, then ingredient, then family; no hardcoded notes");
}

console.log("4. Page structure...");
{
  const circles = read("src/components/product/FragranceNoteCircles.tsx");
  assert.ok(!/Bergamot|Pineapple|Birch/.test(circles), "no hardcoded notes");
  assert.match(circles, /rounded-full/);
  for (const label of ["Top Note", "Heart Note", "Base Note"]) assert.ok(circles.includes(`label: "${label}"`), `${label} label`);
  assert.ok(!/charAt\(0\)/.test(circles), "no letter placeholder");
  const sections = read("src/components/product/ProductInfoSections.tsx");
  assert.match(sections, /<FragranceNoteCircles notes=\{notes\} \/>/, "notes shown as circles in the Fragrance Notes section");
  assert.ok(!sections.includes("#fragrance-notes"), "no link to the removed section");
  const page = read("src/app/products/[slug]/page.tsx");
  assert.ok(!page.includes("FragranceNotesShowcase"), "large Fragrance Notes section removed");
  assert.ok(!existsSync(new URL("../src/components/product/FragranceNotesShowcase.tsx", import.meta.url)), "old component deleted");
  console.log("   ✓ circles in the product information; NOTE labels; no letters; old section gone");
}

console.log("--- Circular fragrance notes tests passed ---");
