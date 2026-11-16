import assert from "node:assert/strict";
import { formatInr, hasPriceRange, startingPrice } from "../src/data/products";
import { buildLegacyCatalogue } from "../src/lib/catalogue/legacy-catalogue";
import type { ProductVariantItem } from "../src/lib/db/schemas";
import { selectPersonality, selectRelated } from "../src/lib/storefront/collections";
import { productJsonLd, productMetaDescription } from "../src/lib/storefront/product-seo";
import { buildStorefrontCatalogue, toStorefrontCardData, toStorefrontOptions } from "../src/lib/storefront/products";
import { clampQuantity, MAX_QTY, maxQuantityFor } from "../src/lib/storefront/quantity";
import { FAQS, PRODUCT_PAGE_FAQ_IDS, productPageFaqs } from "../src/data/faqs";
import { CONTACT } from "../src/data/store";
import { getAssetUrl } from "../src/lib/assets";
import { selectBestSellers, selectSignature } from "../src/lib/storefront/collections";
import { buildWhatsAppOrderMessage, whatsAppOrderHref } from "../src/lib/storefront/whatsapp-order";

console.log("--- Testing Storefront Product Experience ---");

const NOW = "2026-11-16T00:00:00.000Z";
const { entries } = buildLegacyCatalogue({ now: NOW });
const catalogue = buildStorefrontCatalogue(entries);

// 1. Homepage cards: starting price comes from the active variants
console.log("1. Starting price is derived from active variant prices...");
{
  for (const p of catalogue) {
    const card = toStorefrontCardData(p);
    assert.equal(startingPrice(card.options), 400, `${p.slug} should start at ₹400`);
    assert.ok(hasPriceRange(card.options));
    assert.equal(card.href, `/products/${p.slug}`, "card links to the existing product slug");
  }
  assert.equal(formatInr(400), "₹400");
  assert.equal(startingPrice([]), undefined, "no options → no price is invented");
  assert.equal(hasPriceRange([{ priceInr: 500 }, { priceInr: 500 }]), false);
  // A database price change flows through (no hardcoded price on cards).
  const changed = entries.map((e) =>
    e.product.id === "black-velvet"
      ? { ...e, variants: e.variants.map((v) => (v.label === "30 ml" ? { ...v, priceInr: 450 } : v)) }
      : e,
  );
  const bv = buildStorefrontCatalogue(changed).find((p) => p.slug === "black-velvet")!;
  assert.equal(startingPrice(bv.options), 450);
  console.log("   ✓ From-price verified (₹400, database-driven)");
}

// 2. Variant options: inactive variants hidden, stock only when configured
console.log("2. Variant options and configured stock...");
{
  const base = entries[0].variants[0];
  const variants: ProductVariantItem[] = [
    { ...base, id: "a", label: "30 ml", priceInr: 400, sortOrder: 1, status: "ACTIVE", stockQuantity: undefined },
    { ...base, id: "b", label: "50 ml", priceInr: 630, sortOrder: 2, status: "ACTIVE", stockQuantity: 0 },
    { ...base, id: "c", label: "100 ml", priceInr: 1000, sortOrder: 3, status: "INACTIVE", stockQuantity: 4 },
  ];
  const opts = toStorefrontOptions(variants);
  assert.deepEqual(opts.map((o) => o.id), ["a", "b"], "variant IDs preserved, inactive hidden");
  assert.ok(!("stockQuantity" in opts[0]), "unset stock stays unset");
  assert.equal(opts[1].stockQuantity, 0, "genuine zero stock is kept");
  console.log("   ✓ Variant mapping verified");
}

// 3. Quantity rules
console.log("3. Quantity selector rules...");
{
  assert.equal(maxQuantityFor({}), MAX_QTY);
  assert.equal(maxQuantityFor({ stockQuantity: 3 }), 3);
  assert.equal(maxQuantityFor({ stockQuantity: 500 }), MAX_QTY);
  assert.equal(maxQuantityFor({ stockQuantity: 0 }), 0);
  assert.equal(clampQuantity(0, {}), 1);
  assert.equal(clampQuantity(-4, {}), 1);
  assert.equal(clampQuantity(11, {}), MAX_QTY);
  assert.equal(clampQuantity(7, { stockQuantity: 3 }), 3, "switching to a low-stock size lowers the quantity");
  assert.equal(clampQuantity(Number.NaN, {}), 1);
  assert.equal(clampQuantity(2.6, {}), 3);
  console.log("   ✓ Quantity rules verified");
}

// 4. Related fragrances
console.log("4. Related fragrances...");
{
  const bv = catalogue.find((p) => p.slug === "black-velvet")!;
  const related = selectRelated(catalogue, bv, 4);
  assert.equal(related.length, 4);
  assert.ok(!related.some((p) => p.slug === bv.slug), "current product never repeated");
  assert.equal(related[0].slug, "downtown-tam", "shared-collection products come first");
  assert.ok(related.every((p) => p.category === bv.category || p.collections.some((c) => bv.collections.includes(c))));

  const rizz = catalogue.find((p) => p.slug === "daily-rizz")!;
  const rizzRelated = selectRelated(catalogue, rizz, 4);
  assert.ok(rizzRelated.slice(0, 4).every((p) => p.bestseller), "best sellers relate to best sellers first");

  const lone = { ...bv, slug: "lone", category: "Attar", collections: [] as string[], bestseller: false };
  assert.deepEqual(selectRelated([...catalogue, lone], lone, 4), [], "unrelated products are not shown");
  assert.deepEqual(selectRelated(catalogue, bv, 0), []);
  console.log("   ✓ Related selection verified");
}

// 5. Homepage collection order unchanged
console.log("5. Homepage collection order...");
{
  const order = selectPersonality(catalogue).map((p) => p.slug);
  assert.deepEqual(order.slice(0, 2), ["black-velvet", "downtown-tam"]);
  assert.equal(order.length, catalogue.length);
  console.log("   ✓ Personality ordering verified");
}

// 6. SEO
console.log("6. Product SEO metadata...");
{
  const bv = catalogue.find((p) => p.slug === "black-velvet")!;
  const d = productMetaDescription(bv);
  assert.match(d, /Black Velvet/);
  assert.match(d, /from ₹400/);
  const long = productMetaDescription({ ...bv, description: "x ".repeat(200) });
  assert.ok(long.length <= 160);
  const ld = JSON.parse(productJsonLd({ ...bv, description: "</script><b>" }, [{ src: "https://cdn.example/a.jpg" }]));
  assert.equal(ld["@type"], "Product");
  assert.equal(ld.offers.lowPrice, 400);
  assert.equal(ld.offers.highPrice, 1000);
  assert.ok(!("aggregateRating" in ld) && !("review" in ld), "no invented ratings or reviews");
  assert.ok(!productJsonLd({ ...bv, description: "</script>" }, []).includes("</script>"), "script-safe");
  console.log("   ✓ SEO helpers verified");
}

// 7. Product FAQs only use confirmed answers
console.log("7. Product page FAQs...");
{
  const faqs = productPageFaqs();
  assert.ok(faqs.length > 0);
  assert.ok(faqs.every((f) => !f.pendingConfirmation));
  for (const id of PRODUCT_PAGE_FAQ_IDS) assert.ok(FAQS.some((f) => f.id === id), `FAQ ${id} exists`);
  console.log("   ✓ FAQ selection verified");
}

// 8. WhatsApp order message
console.log("8. WhatsApp order message carries the full selection...");
{
  const order = { productName: "Black Velvet", productId: "black-velvet", variantId: "50ml", variantLabel: "50 ml", unitPriceInr: 630, quantity: 3 };
  const msg = buildWhatsAppOrderMessage(order);
  for (const line of ["Product: Black Velvet", "Size: 50 ml", "Quantity: 3", "Price: ₹630 each", "Total: ₹1,890", "Product code: black-velvet / 50ml"]) {
    assert.ok(msg.split("\n").includes(line), `message includes "${line}"`);
  }
  assert.ok(!/free delivery|guarantee|within [0-9]+|[0-9]+ days/i.test(msg), "no delivery promises");
  const href = whatsAppOrderHref(order);
  assert.ok(href.startsWith(`https://wa.me/${CONTACT.phoneDigits}?text=`));
  assert.equal(decodeURIComponent(href.split("?text=")[1]), msg, "link carries exactly the previewed message");
  assert.ok(buildWhatsAppOrderMessage({ ...order, quantity: 0 }).split("\n").includes("Quantity: 1"), "invalid quantity never reaches the message");
  console.log("   ✓ Order message verified");
}

// 9. Compatibility: IDs, variant IDs, prices, image keys and collections pass through unchanged
console.log("9. Data compatibility with the existing admin data...");
{
  const withImages = entries.map((e, i) =>
    i === 0 ? { ...e, product: { ...e.product, mainImageKey: "products/black-velvet/main.jpg", galleryImageKeys: ["products/black-velvet/g1.jpg"] } } : e,
  );
  const mapped = buildStorefrontCatalogue(withImages);
  for (const e of withImages) {
    const p = mapped.find((m) => m.slug === e.product.id);
    assert.ok(p, `product ID ${e.product.id} preserved as slug`);
    const active = e.variants.filter((v) => v.status === "ACTIVE");
    assert.deepEqual(
      p.options.map((o) => `${o.id}:${o.priceInr}`).sort(),
      active.map((v) => `${v.id ?? v.sk.replace("VARIANT#", "")}:${v.priceInr}`).sort(),
      `${e.product.id}: variant IDs and prices unchanged`,
    );
    assert.deepEqual(p.collections, e.product.collections ?? []);
  }
  const bv = mapped.find((p) => p.slug === entries[0].product.id)!;
  assert.equal(bv.mainImage?.src, getAssetUrl("products/black-velvet/main.jpg"), "main image key resolves via the media route");
  assert.equal(bv.galleryImages[0].src, getAssetUrl("products/black-velvet/g1.jpg"));
  assert.deepEqual(selectSignature(catalogue).map((p) => p.slug), ["black-velvet", "downtown-tam", "oud-forest"]);
  assert.deepEqual(selectBestSellers(catalogue).map((p) => p.slug), ["daily-rizz", "nonchalant", "green-flag-energy", "main-character", "deja-vu"]);
  const rizz = entries.find((e) => e.product.id === "daily-rizz")!;
  assert.deepEqual([...(rizz.product.unverifiedFields ?? [])].sort(), ["description", "notes"], "Daily Rizz stays flagged unverified");
  console.log("   ✓ Compatibility verified");
}

console.log("\n🎉 PRODUCT EXPERIENCE TESTS PASSED SUCCESSFULLY!");
