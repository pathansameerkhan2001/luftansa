import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { buildPrimaryNav, isActiveItem, type NavItem } from "@/components/header/nav-config";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import {
  AIR_FRESHENER_TYPE_ID,
  CAR_FRESHENER_TYPE_ID,
  collectionHref,
  findActiveCollection,
  NAV_COLLECTIONS_DEFAULT,
  NAV_COLLECTIONS_MODULE,
  navCollectionsPayloadSchema,
  resolveNavCollections,
  selectNavCollectionProducts,
  toCollectionsMenu,
  type NavCollectionsPayload,
} from "@/lib/cms/modules/nav-collections";
import { PRODUCT_PAGE_DEFAULT, PRODUCT_PAGE_MODULE, resolveProductPage } from "@/lib/cms/modules/product-page";
import { AuditService } from "@/lib/db/audit";
import { Repository, ValidationError } from "@/lib/db/repository";

console.log("--- Testing Collections menu, product page sections, trust section ---");

const D = NAV_COLLECTIONS_DEFAULT;
const appDir = new URL("../src/app/", import.meta.url);
const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

console.log("1. Header: COLLECTIONS replaces Roll-On, with exactly Roll-On, Air Freshener, Car Freshener...");
const nav = buildPrimaryNav(toCollectionsMenu(D));
{
  assert.deepEqual(nav.map((n) => n.label), ["Home", "Perfumes", "Collections", "Our Story", "Contact Us"]);
  const group = nav.find((n) => n.children);
  assert.deepEqual(group?.children, [
    { label: "Roll-On", href: "/roll-on" },
    { label: "Air Freshener", href: "/collections/air-freshener" },
    { label: "Car Freshener", href: "/collections/car-freshener" },
  ]);
  assert.ok(!nav.some((n) => n.label === "Roll-On"), "no separate ROLL-ON item");
  // Every link has a page: a page file, or the dynamic collection page for /collections/<slug>.
  const hrefs = nav.flatMap((n: NavItem) => (n.children ? n.children.map((c) => c.href) : [n.href]));
  for (const href of hrefs) {
    const path = href.replace(/^\//, "");
    const file = path.startsWith("collections/") ? "collections/[slug]/page.tsx" : path ? `${path}/page.tsx` : "page.tsx";
    assert.ok(existsSync(new URL(file, appDir)), `no links to pages that do not exist: ${href}`);
  }
  assert.ok(isActiveItem("/collections/car-freshener", group!), "group active on one of its pages");
  assert.ok(isActiveItem("/roll-on", group!));
  assert.ok(!isActiveItem("/perfumes", group!));
  console.log("   ✓ Home, Perfumes, Collections (Roll-On, Air Freshener, Car Freshener), Our Story, Contact Us; all links exist");
}

console.log("2. Inactive collections and deactivation...");
{
  const oneOff: NavCollectionsPayload = { ...D, collections: D.collections.map((c) => (c.id === "car-freshener" ? { ...c, enabled: false } : c)) };
  assert.deepEqual(toCollectionsMenu(oneOff)?.items.map((i) => i.label), ["Roll-On", "Air Freshener"], "inactive: left out of the menu");
  assert.equal(findActiveCollection(oneOff, "car-freshener"), undefined, "inactive: its page 404s");
  assert.equal(toCollectionsMenu({ ...D, collections: D.collections.map((c) => ({ ...c, enabled: false })) }), null, "none active: no COLLECTIONS item");
  assert.equal(toCollectionsMenu(null), null, "deactivated: no COLLECTIONS item");
  assert.deepEqual(buildPrimaryNav(null).map((n) => n.label), ["Home", "Perfumes", "Our Story", "Contact Us"]);
  assert.equal(resolveNavCollections({ source: "cms", items: [] }), null, "deactivated");
  assert.deepEqual(resolveNavCollections({ source: "fallback", items: [{ payload: D }] }), D, "never published: defaults");
  assert.deepEqual(resolveNavCollections({ source: "cms", items: [{ payload: { bad: true } }] }), D, "invalid stored settings: defaults");
  assert.equal(findActiveCollection(D, "nope"), undefined, "unknown slug: 404");
  console.log("   ✓ inactive hidden + page offline; none active / deactivated → no menu; defaults otherwise");
}

console.log("3. Products: by type (never mixing), manual order, empty, inactive excluded...");
{
  // Only active products reach the selection (getActiveStorefrontProducts).
  const products = [
    { slug: "black-velvet-roll-on", name: "Black Velvet", productTypeId: "roll-on", displayOrder: 2 },
    { slug: "oud-roll-on", name: "Oud", productTypeId: "roll-on", displayOrder: 1 },
    { slug: "black-velvet", name: "Black Velvet", productTypeId: "perfume-spray" },
    { slug: "car-oud", name: "Car Oud", productTypeId: CAR_FRESHENER_TYPE_ID },
    { slug: "room-rose", name: "Room Rose", productTypeId: AIR_FRESHENER_TYPE_ID },
  ];
  const [rollOn, air, car] = D.collections;
  assert.deepEqual(selectNavCollectionProducts(rollOn, products).map((p) => p.slug), ["oud-roll-on", "black-velvet-roll-on"], "Roll-On: roll-ons only, display order");
  assert.deepEqual(selectNavCollectionProducts(car, products).map((p) => p.slug), ["car-oud"], "Car Freshener: car fresheners only, never roll-ons or air fresheners");
  assert.deepEqual(selectNavCollectionProducts(air, products).map((p) => p.slug), ["room-rose"], "Air Freshener: air fresheners only");
  assert.equal(collectionHref(air), "/collections/air-freshener", "Air Freshener: its own page");
  assert.deepEqual(selectNavCollectionProducts(car, products.slice(0, 3)), [], "no car fresheners yet: empty (page shows coming soon)");
  const manual = { selection: { mode: "manual" as const, productIds: ["car-oud", "missing", "oud-roll-on"] } };
  assert.deepEqual(selectNavCollectionProducts(manual, products).map((p) => p.slug), ["car-oud", "oud-roll-on"], "manual: chosen order; hidden/deleted products skipped");
  assert.equal(collectionHref(rollOn), "/roll-on", "Roll-On reuses the existing listing (no duplicate collection)");
  assert.equal(collectionHref(car), "/collections/car-freshener");
  console.log("   ✓ type collections separate; manual order; empty and hidden products handled");
}

console.log("4. Validation...");
{
  assert.ok(navCollectionsPayloadSchema.safeParse(D).success, "defaults valid");
  const withCollections = (collections: unknown) => navCollectionsPayloadSchema.safeParse({ ...D, collections });
  const c0 = D.collections[2];
  assert.ok(!withCollections([c0, { ...c0, id: "other" }]).success, "duplicate web address refused");
  assert.ok(!withCollections([{ ...c0, slug: "Car Freshener" }]).success, "slug format");
  assert.ok(!withCollections([{ ...c0, slug: "personality" }]).success, "reserved slug (existing page)");
  assert.ok(!withCollections([{ ...c0, linkTo: "https://evil.example" }]).success, "external links refused");
  assert.ok(!withCollections([{ ...c0, linkTo: "//evil.example" }]).success);
  assert.ok(!withCollections([{ ...c0, selection: { mode: "product-type", productIds: [] } }]).success, "product type required");
  assert.ok(!withCollections([{ ...c0, imageKey: "secret/file.jpg" }]).success, "images only from allowed media folders");
  const ok = withCollections([{ ...c0, description: "", imageKey: "", imageAlt: "", linkTo: "", selection: { mode: "manual", productTypeId: "", productIds: ["a", "b"] } }]);
  assert.ok(ok.success, "empty optional fields accepted");
  assert.equal(ok.data!.collections[0].linkTo, undefined);
  assert.ok(withCollections([{ ...c0, imageKey: "categories/car.webp", imageAlt: "Car freshener" }]).success, "collection image from the Media Library");
  console.log("   ✓ slugs, links, product type, image keys");
}

console.log("5. CMS workflow (collections menu)...");
await (async () => {
  assert.ok(CMS_MODULES.some((m) => m.id === "nav-collections") && CMS_MODULES.some((m) => m.id === "product-page"), "registered");
  assert.equal(getCmsModule("nav-collections")?.kind, "singleton");
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  const menu = async () => toCollectionsMenu(resolveNavCollections(resolvePublished(await listEntries(repo, NAV_COLLECTIONS_MODULE), [D], new Date())));

  assert.equal((await menu())?.items.length, 3, "nothing saved: defaults");
  const added: NavCollectionsPayload = { ...D, collections: [...D.collections, { id: "gift-sets", name: "Gift Sets", slug: "gift-sets", enabled: true, selection: { mode: "manual", productIds: ["a"] } }] };
  const draft = await createEntry(ctx, NAV_COLLECTIONS_MODULE, { draft: added });
  assert.equal((await menu())?.items.length, 3, "a draft never changes the header");
  await assert.rejects(() => saveDraft(ctx, NAV_COLLECTIONS_MODULE, draft.id, { ...added, collections: [{ ...added.collections[0], slug: "Bad Slug" }] }, draft.version), (e: unknown) => e instanceof ValidationError, "server validates");
  const pub = await publishEntry(ctx, NAV_COLLECTIONS_MODULE, draft.id, draft.version);
  assert.deepEqual((await menu())?.items.map((i) => i.label), ["Roll-On", "Air Freshener", "Car Freshener", "Gift Sets"], "published: new collection in the menu");
  const reordered = { ...added, collections: [added.collections[3], { ...added.collections[2], enabled: false }, added.collections[0], added.collections[1]] };
  const saved = await saveDraft(ctx, NAV_COLLECTIONS_MODULE, pub.id, reordered, pub.version);
  const pub2 = await publishEntry(ctx, NAV_COLLECTIONS_MODULE, saved.id, saved.version);
  assert.deepEqual((await menu())?.items.map((i) => i.label), ["Gift Sets", "Roll-On", "Air Freshener"], "reorder + deactivate one");
  await unpublishEntry(ctx, NAV_COLLECTIONS_MODULE, pub2.id, pub2.version);
  assert.equal(await menu(), null, "deactivated: no menu");
  console.log("   ✓ defaults until published, drafts private, validation, create/edit/reorder/activate, deactivate");
})();

console.log("6. Product page: Description and FAQ hidden by default, content kept...");
await (async () => {
  assert.deepEqual(PRODUCT_PAGE_DEFAULT, { showDescription: false, showFaq: false });
  assert.deepEqual(resolveProductPage({ source: "cms", items: [] }), PRODUCT_PAGE_DEFAULT, "deactivated: hidden");
  assert.deepEqual(resolveProductPage({ source: "cms", items: [{ payload: { showDescription: true, showFaq: false } }] }), { showDescription: true, showFaq: false });
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  await assert.rejects(() => createEntry(ctx, PRODUCT_PAGE_MODULE, { draft: { showDescription: "yes" } }), (e: unknown) => e instanceof ValidationError);

  const sections = read("components/product/ProductInfoSections.tsx");
  assert.match(sections, /display\.showDescription \? product\.description : undefined/, "Description only when switched on");
  assert.match(sections, /display\.showFaq \? productPageFaqs\(\) : \[\]/, "FAQ only when switched on");
  for (const title of ["Fragrance Notes", "Details", "How to Use & Care"]) assert.ok(sections.includes(`title="${title}"`), `${title} kept`);
  assert.ok(!sections.includes("<TrustTags"), "trust tags no longer nested in DETAILS");
  const page = read("app/products/[slug]/page.tsx");
  assert.match(page, /<TrustTagsSection tags=\{trustTags\} \/>\s*<RelatedFragrances/, "trust tags: standalone section after the product");
  console.log("   ✓ defaults hidden; Notes, Details, How to Use kept; trust tags standalone");
})();

console.log("--- Collections menu / product page tests passed ---");
