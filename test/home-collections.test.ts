import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import {
  HOME_COLLECTIONS_DEFAULT,
  HOME_COLLECTIONS_MODULE,
  cardNotes,
  cardOption,
  cardPrice,
  concentrationLabel,
  homeCollectionsPayloadSchema,
  resolveHomeCollections,
  selectCollectionProducts,
  toCollectionCard,
  toHomeCollectionsView,
  type CollectionProductSource,
  type HomeCollectionsPayload,
} from "@/lib/cms/modules/home-collections";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import { AuditService } from "@/lib/db/audit";
import { createProduct, getProductWithVariants, updateProduct } from "@/lib/db/products-service";
import { ConflictError, Repository, ValidationError } from "@/lib/db/repository";
import { mapProductToStorefront } from "@/lib/storefront/products";

console.log("--- Testing Homepage Collections CMS ---");

const href = (slug: string) => `/products/${slug}`;
const D = HOME_COLLECTIONS_DEFAULT;
const notes = (top: string[] = [], heart: string[] = [], base: string[] = []) => ({ top: top.map((name) => ({ name })), heart: heart.map((name) => ({ name })), base: base.map((name) => ({ name })) });

function prod(slug: string, patch: Partial<CollectionProductSource> = {}): CollectionProductSource {
  return {
    slug,
    name: slug,
    displayName: slug,
    format: "perfume",
    options: [
      { label: "30 ml", priceInr: 400 },
      { label: "100 ml", priceInr: 1299, mrpInr: 1800 },
      { label: "50 ml", priceInr: 630 },
    ],
    notes: notes(["Citrus"], ["Musk"], ["Amber"]),
    hasNotes: true,
    bestseller: false,
    newLaunch: false,
    buyOneGetOne: false,
    collections: [],
    ...patch,
  };
}

const PRODUCTS: CollectionProductSource[] = [
  prod("daily-rizz", { displayName: "Daily Rizz", bestseller: true, buyOneGetOne: true, displayOrder: 2, concentration: "25%", gender: "Unisex" }),
  prod("main-character", { displayName: "Main Character", newLaunch: true, displayOrder: 1 }),
  prod("black-velvet", { displayName: "Black Velvet", collections: ["personality"], displayOrder: 9 }),
  prod("adventure-trails-roll-on", { displayName: "Adventure Trails Roll-On", format: "roll-on", options: [{ label: "10 ml", priceInr: 449, mrpInr: 599 }], displayOrder: 2, gender: "Unisex", bestseller: true }),
  prod("afghan-tiger-roll-on", { displayName: "Afghan Tiger Roll-On", format: "roll-on", options: [{ label: "10 ml", priceInr: 449, mrpInr: 599 }], displayOrder: 1, buyOneGetOne: true }),
  prod("attar-one", { format: "other" }),
];
const payload = (patch: Partial<HomeCollectionsPayload> = {}) => homeCollectionsPayloadSchema.parse({ ...D, ...patch });
const panel = (key: "personality" | "rollOn", patch: Record<string, unknown>) => ({ [key]: { ...D[key], ...patch } }) as Partial<HomeCollectionsPayload>;

console.log("1. Defaults keep today's homepage...");
{
  assert.ok(homeCollectionsPayloadSchema.safeParse(D).success);
  const v = toHomeCollectionsView(D, PRODUCTS, href);
  assert.deepEqual(v.panels.map((p) => [p.key, p.anchor, p.heading]), [
    ["personality", "personality-collection", "Personality Collection"],
    ["rollOn", "roll-on-collection", "Roll On Collection"],
  ]);
  assert.equal(v.panels[0].subtitle, "Distinctive fragrances that reflect your unique style.");
  assert.equal(v.panels[1].subtitle, "Discover your favourite fragrances in a convenient roll-on format.");
  assert.deepEqual(v.panels.map((p) => p.viewAll), [
    { label: "View All", href: "/perfumes" },
    { label: "View All", href: "/roll-on" },
  ]);
  // Automatic selection: "personality" members first, then other Perfumes by display order.
  assert.deepEqual(v.panels[0].cards.map((c) => c.slug), ["black-velvet", "main-character", "daily-rizz"]);
  assert.deepEqual(v.panels[1].cards.map((c) => c.slug), ["afghan-tiger-roll-on", "adventure-trails-roll-on"]);
  assert.deepEqual([v.decorative, v.imageRatio, v.badgePosition], [true, "4:5", "top-left"]);
  console.log("   ✓ headings, subtitles, View All, automatic selection, design");
}

console.log("2. Validation...");
{
  const bad: [string, Partial<HomeCollectionsPayload>][] = [
    ["empty heading", panel("personality", { heading: " " })],
    ["long heading", panel("personality", { heading: "x".repeat(61) })],
    ["long subtitle", panel("rollOn", { subtitle: "x".repeat(161) })],
    ["View All label required", panel("personality", { viewAll: { show: true, label: "", href: "/perfumes" } })],
    ["unsafe View All link", panel("personality", { viewAll: { show: true, label: "Go", href: "javascript:alert(1)" } })],
    ["protocol-relative link", panel("rollOn", { viewAll: { show: true, label: "Go", href: "//evil.example.com" } })],
    ["manual with no products", panel("personality", { selection: { mode: "manual", productIds: [] } })],
    ["duplicate product", panel("personality", { selection: { mode: "manual", productIds: ["daily-rizz", "daily-rizz"] } })],
    ["invalid product id", panel("personality", { selection: { mode: "manual", productIds: ["../etc"] } })],
    ["too many products", panel("personality", { selection: { mode: "manual", productIds: Array.from({ length: 25 }, (_, i) => `p${i}`) } })],
    ["max products range", panel("personality", { maxProducts: 0 })],
    ["bad background", panel("personality", { background: "neon" })],
    ["bad image ratio", { design: { decorative: true, imageRatio: "16:9", badgePosition: "top-left" } } as never],
    ["bad badge position", { design: { decorative: true, imageRatio: "4:5", badgePosition: "center" } } as never],
    ["bad order", { order: "random" } as never],
    ["unknown field (no raw CSS)", panel("personality", { css: "color:red" })],
    ["unknown top-level field", { html: "<b>x</b>" } as never],
  ];
  for (const [label, patch] of bad) assert.ok(!homeCollectionsPayloadSchema.safeParse({ ...D, ...patch }).success, label);
  const ok = payload(panel("personality", { subtitle: "  ", formatLabel: "" }));
  assert.equal(ok.personality.subtitle, undefined, "empty subtitle = none");
  assert.equal(ok.personality.formatLabel, undefined);
  assert.ok(homeCollectionsPayloadSchema.safeParse({ ...D, ...panel("personality", { viewAll: { show: true, label: "Shop", href: "https://www.instagram.com/luftansa/" } }) }).success);
  console.log("   ✓ required text, lengths, safe links only, product list rules, preset design values, no raw CSS/HTML");
}

console.log("3. Product selection and format separation...");
{
  const manual = payload(panel("personality", { selection: { mode: "manual", productIds: ["daily-rizz", "adventure-trails-roll-on", "deleted-product", "attar-one", "black-velvet"] } }));
  assert.deepEqual(selectCollectionProducts("personality", manual.personality, PRODUCTS).map((p) => p.slug), ["daily-rizz", "black-velvet"], "chosen order; Roll-On, other formats and missing products are never shown");
  const rollManual = payload(panel("rollOn", { selection: { mode: "manual", productIds: ["daily-rizz", "adventure-trails-roll-on"] } }));
  assert.deepEqual(selectCollectionProducts("rollOn", rollManual.rollOn, PRODUCTS).map((p) => p.slug), ["adventure-trails-roll-on"], "Perfumes never appear in the Roll-On panel");
  const limited = payload(panel("personality", { maxProducts: 2 }));
  assert.equal(selectCollectionProducts("personality", limited.personality, PRODUCTS).length, 2, "maximum products");
  // Only active products are passed in (getActiveStorefrontProducts), so a hidden product never appears.
  const withoutInactive = PRODUCTS.filter((p) => p.slug !== "daily-rizz");
  assert.ok(!toHomeCollectionsView(manual, withoutInactive, href).panels[0].cards.some((c) => c.slug === "daily-rizz"), "inactive product not shown");
  console.log("   ✓ automatic and manual selection, order, de-duplication, Perfume/Roll-On separation, limit");
}

console.log("4. Visibility and order...");
{
  const v = toHomeCollectionsView(payload(panel("rollOn", { enabled: false })), PRODUCTS, href);
  assert.deepEqual(v.panels.map((p) => p.key), ["personality"], "disabled panel removed");
  assert.deepEqual(toHomeCollectionsView(payload({ order: "roll-on-first" }), PRODUCTS, href).panels.map((p) => p.key), ["rollOn", "personality"]);
  assert.deepEqual(toHomeCollectionsView(D, PRODUCTS.filter((p) => p.format !== "roll-on"), href).panels.map((p) => p.key), ["personality"], "no Roll-Ons yet: panel left out, no empty box");
  assert.equal(toHomeCollectionsView(payload({ ...panel("personality", { enabled: false }), ...panel("rollOn", { enabled: false }) }), PRODUCTS, href).panels.length, 0);
  const noLinks = toHomeCollectionsView(payload(panel("personality", { viewAll: { show: false, label: "View All", href: "/perfumes" }, showWordmark: false })), PRODUCTS, href).panels[0];
  assert.deepEqual([noLinks.viewAll, noLinks.showWordmark], [undefined, false]);
  console.log("   ✓ enable/disable, order, empty panel left out, View All and wordmark switches");
}

console.log("5. Cards: name, price, discount, notes, attributes, badges...");
{
  assert.deepEqual(cardPrice({ priceInr: 1299, mrpInr: 1800 }), { selling: 1299, original: 1800, discountPercent: 27 }, "27.8% shown as 27% (never overstated)");
  assert.deepEqual(cardPrice({ priceInr: 449, mrpInr: 599 }), { selling: 449, original: 599, discountPercent: 25 });
  assert.deepEqual(cardPrice({ priceInr: 1000 }), { selling: 1000 }, "no original price: no strike-through, no discount");
  assert.deepEqual(cardPrice({ priceInr: 1000, mrpInr: 1000 }), { selling: 1000 }, "equal original price: no discount");
  assert.deepEqual(cardPrice({ priceInr: 995, mrpInr: 1000 }), { selling: 995, original: 1000 }, "under 1%: original shown, no 0% badge");
  assert.equal(cardOption([{ priceInr: 400 }, { priceInr: 1299 }, { priceInr: 630 }], "largest")?.priceInr, 1299);
  assert.equal(cardOption([{ priceInr: 400 }, { priceInr: 1299 }], "smallest")?.priceInr, 400);
  assert.equal(cardOption([], "largest"), undefined);
  assert.deepEqual(cardNotes(notes(["Citrus", "Bergamot"], ["Musk"], ["Amber", "Oud"])), ["Citrus", "Musk", "Amber"]);
  assert.deepEqual(cardNotes(notes(["Citrus", "Bergamot", "Lemon"], [], [])), ["Citrus", "Bergamot", "Lemon"], "fills from the same group");
  assert.deepEqual(cardNotes(notes(["Musk"], ["musk"], ["Amber"])), ["Musk", "Amber"], "no duplicates");
  assert.equal(concentrationLabel("25%"), "25% Oil Concentration");
  assert.equal(concentrationLabel("Eau de Parfum"), "Eau de Parfum");
  assert.equal(concentrationLabel("  "), undefined);

  const v = toHomeCollectionsView(D, PRODUCTS, href);
  const rizz = v.panels[0].cards.find((c) => c.slug === "daily-rizz")!;
  assert.deepEqual(rizz, {
    slug: "daily-rizz",
    title: "Daily Rizz – 100 ml",
    href: "/products/daily-rizz",
    image: undefined,
    placeholder: "spray",
    badges: ["best-seller", "buy-one-get-one"],
    notes: ["Citrus", "Musk", "Amber"],
    price: { selling: 1299, original: 1800, discountPercent: 27 },
    attributes: ["25% Oil Concentration", "Unisex"],
  });
  const trails = v.panels[1].cards.find((c) => c.slug === "adventure-trails-roll-on")!;
  assert.equal(trails.title, "Adventure Trails Roll-On", "single size: no size in the name");
  assert.deepEqual(trails.attributes, ["Roll-On Parfum", "Unisex"]);
  assert.deepEqual(trails.price, { selling: 449, original: 599, discountPercent: 25 });
  assert.equal(trails.placeholder, "roll-on");
  assert.deepEqual(v.panels[0].cards.find((c) => c.slug === "main-character")!.badges, ["new-launch"]);
  assert.deepEqual(v.panels[0].cards.find((c) => c.slug === "black-velvet")!.badges, [], "no badges enabled: none shown");

  const s = payload(panel("personality", { showBadges: false, showNotes: false, showAttributes: false, cardSize: "smallest" })).personality;
  const plain = toCollectionCard(PRODUCTS[0], s, href);
  assert.deepEqual([plain.title, plain.badges, plain.notes, plain.attributes, plain.price], ["Daily Rizz – 30 ml", [], [], [], { selling: 400 }]);
  const bare = toCollectionCard(prod("new", { options: [], hasNotes: false, mainImage: undefined }), D.personality, href);
  assert.deepEqual([bare.price, bare.notes, bare.image], [undefined, [], undefined], "no sizes, notes or image: nothing invented");
  console.log("   ✓ 27%/25% discounts, missing original price, size choice, notes, pills, multiple badges, missing image");
}

console.log("6. Stored settings...");
{
  assert.equal(resolveHomeCollections({ source: "fallback", items: [{ payload: D }] })?.personality.heading, "Personality Collection", "never published / database unavailable → default");
  assert.equal(resolveHomeCollections({ source: "cms", items: [] }), null, "deactivated → section removed");
  assert.equal(resolveHomeCollections({ source: "cms", items: [{ payload: { personality: { heading: "" } } }] })?.personality.heading, "Personality Collection", "invalid stored settings → default, never a broken section");
  console.log("   ✓ default, deactivated, invalid");
}

console.log("7. CMS workflow and product badge flags...");
await (async () => {
  assert.ok(CMS_MODULES.some((m) => m.id === "home-collections"), "registered");
  assert.equal(getCmsModule("home-collections")?.kind, "singleton");
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const audit = new AuditService(repo);
  const ctx = { repo, audit, actorEmail: "admin@luftansa.local" };
  const shown = async () => resolveHomeCollections(resolvePublished(await listEntries(repo, HOME_COLLECTIONS_MODULE), [D], new Date()));

  assert.equal((await shown())?.personality.heading, "Personality Collection", "nothing saved: default");
  const draft = await createEntry(ctx, HOME_COLLECTIONS_MODULE, { draft: payload(panel("personality", { heading: "Draft heading" })) });
  assert.equal((await shown())?.personality.heading, "Personality Collection", "a draft never changes the website");
  await assert.rejects(() => createEntry(ctx, HOME_COLLECTIONS_MODULE, { draft: D }), (e: unknown) => e instanceof ConflictError, "one record only");
  await assert.rejects(() => saveDraft(ctx, HOME_COLLECTIONS_MODULE, draft.id, { ...D, ...panel("personality", { heading: "" }) }, draft.version), (e: unknown) => e instanceof ValidationError, "server validates");
  await assert.rejects(() => saveDraft(ctx, HOME_COLLECTIONS_MODULE, draft.id, D, draft.version - 1 || 99), (e: unknown) => e instanceof ConflictError, "stale version rejected (no silent overwrite)");

  const edited = await saveDraft(ctx, HOME_COLLECTIONS_MODULE, draft.id, payload({ ...panel("personality", { heading: "Signature Picks", selection: { mode: "manual", productIds: ["daily-rizz"] } }), order: "roll-on-first" }), draft.version);
  const pub = await publishEntry(ctx, HOME_COLLECTIONS_MODULE, edited.id, edited.version);
  const live = (await shown())!;
  assert.deepEqual([live.personality.heading, live.personality.selection.productIds, live.order], ["Signature Picks", ["daily-rizz"], "roll-on-first"]);

  await unpublishEntry(ctx, HOME_COLLECTIONS_MODULE, pub.id, pub.version);
  assert.equal(await shown(), null, "deactivated: removed from the homepage");

  // Badge flags live on the product (Admin → Products) and survive unrelated edits.
  await createProduct(repo, audit, ctx.actorEmail, { id: "badge-test", name: "Badge Test", newLaunch: true, variants: [{ capacity: 100, unit: "ml", priceInr: 1299, mrpInr: 1800 }] });
  let p = (await getProductWithVariants(repo, "badge-test"))!;
  assert.deepEqual([p.product.bestseller, p.product.newLaunch, p.product.buyOneGetOne], [false, true, false]);
  await updateProduct(repo, audit, ctx.actorEmail, "badge-test", { version: p.product.version, description: "Updated" });
  p = (await getProductWithVariants(repo, "badge-test"))!;
  assert.equal(p.product.newLaunch, true, "unrelated edit keeps the badge");
  await updateProduct(repo, audit, ctx.actorEmail, "badge-test", { version: p.product.version, newLaunch: false, buyOneGetOne: true, bestseller: true });
  p = (await getProductWithVariants(repo, "badge-test"))!;
  const sf = mapProductToStorefront(p.product, p.variants);
  assert.deepEqual([sf.bestseller, sf.newLaunch, sf.buyOneGetOne], [true, false, true]);
  assert.deepEqual(toCollectionCard({ ...sf, format: "perfume" }, D.personality, href).badges, ["best-seller", "buy-one-get-one"]);
  assert.deepEqual(toCollectionCard({ ...sf, format: "perfume" }, D.personality, href).price, { selling: 1299, original: 1800, discountPercent: 27 });

  // Records saved before these flags existed read as "off".
  const legacy = mapProductToStorefront({ ...p.product, newLaunch: undefined, buyOneGetOne: undefined } as never, p.variants);
  assert.deepEqual([legacy.newLaunch, legacy.buyOneGetOne], [false, false]);
  console.log("   ✓ default until published, drafts private, one record, validation, version check, publish, deactivate, badge flags");
})();

console.log("8. Original price (MRP) per size, and notes, from the product record...");
await (async () => {
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const audit = new AuditService(repo);
  const actor = "admin@luftansa.local";
  const N = (t: string, h: string, b: string) => ({ top: [{ id: t.toLowerCase(), name: t }], heart: [{ id: h.toLowerCase(), name: h }], base: [{ id: b.toLowerCase(), name: b }] });
  await createProduct(repo, audit, actor, {
    id: "mrp-test",
    name: "Mrp Test",
    notes: N("Citrus", "Musk", "Amber"),
    variants: [
      { id: "v30", capacity: 30, unit: "ml", priceInr: 400, mrpInr: 500 },
      { id: "v50", capacity: 50, unit: "ml", priceInr: 630 },
      { id: "v100", capacity: 100, unit: "ml", priceInr: 1299, mrpInr: 1800 },
    ],
  });
  const card = async (size: "largest" | "smallest" = "largest") => {
    const p = (await getProductWithVariants(repo, "mrp-test"))!;
    const sf = mapProductToStorefront(p.product, p.variants);
    return { p, c: toCollectionCard(sf, { ...D.personality, cardSize: size }, href) };
  };
  let { p, c } = await card();
  assert.deepEqual([c.title, c.notes, c.price], ["Mrp Test – 100 ml", ["Citrus", "Musk", "Amber"], { selling: 1299, original: 1800, discountPercent: 27 }]);
  assert.deepEqual((await card("smallest")).c.price, { selling: 400, original: 500, discountPercent: 20 }, "each size has its own original price");
  const vs = (patch: Record<string, Record<string, unknown>>) =>
    p.variants.map((v) => ({ id: v.id, capacity: v.capacity, unit: v.unit, label: v.label, status: v.status, sortOrder: v.sortOrder, ...(patch[v.id!] ?? {}) }));

  // Omitted MRP keeps the saved value (e.g. the Excel import or an older form).
  await updateProduct(repo, audit, actor, "mrp-test", { version: p.product.version, variants: vs({}) });
  ({ p, c } = await card());
  assert.equal(c.price?.original, 1800, "omitted: kept");
  // MRP lower than the selling price: no strike-through, no discount.
  await updateProduct(repo, audit, actor, "mrp-test", { version: p.product.version, variants: vs({ v100: { mrpInr: 1000 } }) });
  ({ p, c } = await card());
  assert.deepEqual(c.price, { selling: 1299 }, "MRP below price: price only");
  // Cleared in Admin (empty field sends null).
  await updateProduct(repo, audit, actor, "mrp-test", { version: p.product.version, variants: vs({ v100: { mrpInr: null } }) });
  ({ p, c } = await card());
  assert.equal(p.variants.find((v) => v.id === "v100")?.mrpInr, undefined, "cleared");
  assert.deepEqual(c.price, { selling: 1299 }, "no MRP: price only");
  // Roll-On: 3 notes, ₹449 / ₹599 → 25% OFF.
  await createProduct(repo, audit, actor, { id: "trails-roll-on", name: "Trails", productTypeId: "roll-on", notes: N("Aquatic", "Fresh", "Woody"), variants: [{ capacity: 10, unit: "ml", priceInr: 449, mrpInr: 599 }] });
  const ro = (await getProductWithVariants(repo, "trails-roll-on"))!;
  const rc = toCollectionCard(mapProductToStorefront(ro.product, ro.variants), D.rollOn, href);
  assert.deepEqual([rc.title, rc.notes, rc.price], ["Trails Roll-On", ["Aquatic", "Fresh", "Woody"], { selling: 449, original: 599, discountPercent: 25 }]);
  // No notes: the line is left out.
  await updateProduct(repo, audit, actor, "mrp-test", { version: p.product.version, notes: { top: [], heart: [], base: [] } });
  assert.deepEqual((await card()).c.notes, [], "no notes: hidden");
  // Zero is not a valid original price.
  await assert.rejects(() => updateProduct(repo, audit, actor, "mrp-test", { version: p.product.version + 1, variants: vs({ v100: { mrpInr: 0 } }) }));
  console.log("   ✓ per-size MRP, 27%/25% OFF, kept when omitted, below-price ignored, cleared, zero refused, notes shown/hidden");
})();

console.log("--- Homepage Collections tests passed ---");
