import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { FAQS } from "@/data/faqs";
import { NOTE_CATEGORIES } from "@/data/note-categories";
import { PRIMARY_NAV } from "@/components/header/nav-config";
import { composeContactMessage } from "@/lib/storefront/contact-message";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, unpublishEntry } from "@/lib/cms/service";
import { POLICY_DEFAULTS, POLICY_KEYS, POLICY_MODULES, POLICY_ROUTE, policyPayloadSchema, resolvePolicy, toPolicyBlocks } from "@/lib/cms/modules/policy-pages";
import { AuditService } from "@/lib/db/audit";
import { Repository } from "@/lib/db/repository";
import { inNoteFamily, selectAttar, selectNoteFamily } from "@/lib/storefront/collection-pages";
import { analysePixels, coverCrop, decideFit, FIT_PRESETS, scaleSizes } from "@/lib/storefront/image-fit";

console.log("--- Testing site polish (image fit, policy pages, collection pages) ---");

console.log("1. Product photo fit decisions...");
{
  const card = FIT_PRESETS.card;
  // Small bottle centred on white: zoomed (capped), centred, white blended into the frame.
  const iso = decideFit({ ratio: 1, plain: true, transparent: false, background: [255, 255, 255], bbox: { x: 0.375, y: 0.3, w: 0.25, h: 0.4 } }, 0.8, card);
  assert.equal(iso.mode, "isolated");
  assert.equal(iso.zoom, card.maxZoom, "zoom capped: never artificially enlarged");
  assert.deepEqual([iso.translateX, iso.translateY, iso.blend, iso.frameColor], [0, 0, true, undefined]);
  // A product that already fills the photo is not zoomed.
  assert.equal(decideFit({ ratio: 0.8, plain: true, transparent: true, background: [0, 0, 0], bbox: { x: 0.05, y: 0.02, w: 0.9, h: 0.96 } }, 0.8, card).zoom, 1);
  // Off-centre product on a flat beige background: re-centred, frame tinted to match.
  const off = decideFit({ ratio: 2 / 3, plain: true, transparent: false, background: [232, 221, 208], bbox: { x: 0.1, y: 0.4, w: 0.3, h: 0.4 } }, 0.8, card);
  assert.ok(off.translateX > 0 && off.translateY < 0, "moved right and up towards the centre");
  assert.equal(off.frameColor, "rgb(232 221 208)");
  assert.equal(off.blend, false);
  // Scene photographs: square in a 4:5 card fills it (10% trimmed per side); landscape is shown whole.
  assert.ok(Math.abs(coverCrop(1, 0.8) - 0.2) < 1e-9);
  assert.equal(decideFit({ ratio: 1, plain: false, background: [200, 180, 170] }, 0.8, card).mode, "cover");
  const land = decideFit({ ratio: 16 / 9, plain: false, background: [60, 50, 40] }, 0.8, card);
  assert.deepEqual([land.mode, land.frameColor], ["contain", "rgb(60 50 40)"]);
  // Unreadable pixels (cross-origin): decided from the shape only, never cropped heavily.
  assert.equal(decideFit({ ratio: 2 }, 0.8, card).mode, "contain");
  assert.equal(decideFit({ ratio: 0 }, 0.8, card).mode, "contain", "broken image: safe default");
  console.log("   ✓ isolated zoom/centre/blend/tint, cover only for similar shapes, contain otherwise, safe defaults");
}

console.log("2. Pixel analysis...");
{
  const W = 40;
  const H = 50;
  const img = (fill: (x: number, y: number) => [number, number, number, number]) => {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set(fill(x, y), (y * W + x) * 4);
    return d;
  };
  const bottle = (x: number, y: number) => x >= 15 && x < 25 && y >= 10 && y < 40;
  const white = analysePixels(img((x, y) => (bottle(x, y) ? [30, 30, 30, 255] : [255, 255, 255, 255])), W, H);
  assert.equal(white.plain, true);
  assert.deepEqual(white.bbox, { x: 15 / W, y: 10 / H, w: 10 / W, h: 30 / H });
  const cut = analysePixels(img((x, y) => (bottle(x, y) ? [200, 160, 60, 255] : [0, 0, 0, 0])), W, H);
  assert.deepEqual([cut.plain, cut.transparent, cut.bbox?.w], [true, true, 10 / W]);
  const scene = analysePixels(img((x, y) => [Math.round((x / W) * 255), Math.round((y / H) * 200), 120, 255]), W, H);
  assert.equal(scene.plain, false, "gradient backdrop is a scene");
  assert.equal(scaleSizes("(min-width: 1280px) 290px, (min-width: 480px) 45vw, 90vw", 2), "(min-width: 1280px) 580px, (min-width: 480px) 90vw, 180vw");
  assert.equal(scaleSizes("88px", 1), "88px");
  console.log("   ✓ white and transparent backgrounds with product box, scenes detected, sizes scaled for zoom");
}

console.log("3. Policy pages: defaults, validation, rendering...");
{
  for (const k of POLICY_KEYS) {
    const d = POLICY_DEFAULTS[k];
    assert.ok(policyPayloadSchema.safeParse(d).success, `${k} default valid`);
    const text = JSON.stringify(d).toLowerCase();
    // Defaults must not invent commitments Luftansa has not confirmed.
    for (const banned of ["within", "business days", "free delivery", "free shipping", "refund will", "guarantee", "cash on delivery", "jurisdiction", "gst"]) assert.ok(!text.includes(banned), `${k} default must not promise "${banned}"`);
    assert.ok(POLICY_ROUTE[k].startsWith("/"));
  }
  const bad: [string, unknown][] = [
    ["no title", { ...POLICY_DEFAULTS.terms, title: " " }],
    ["no sections", { ...POLICY_DEFAULTS.terms, sections: [] }],
    ["empty body", { ...POLICY_DEFAULTS.terms, sections: [{ heading: "A", body: "" }] }],
    ["bad date", { ...POLICY_DEFAULTS.terms, lastUpdated: "2026-13-45" }],
    ["markup field", { ...POLICY_DEFAULTS.terms, html: "<b>x</b>" }],
  ];
  for (const [label, p] of bad) assert.ok(!policyPayloadSchema.safeParse(p).success, label);
  assert.deepEqual(toPolicyBlocks("First line\ncontinues.\n\nIntro:\n- one\n- two\nAfter"), [
    { kind: "p", text: "First line continues." },
    { kind: "p", text: "Intro:" },
    { kind: "ul", items: ["one", "two"] },
    { kind: "p", text: "After" },
  ]);
  assert.deepEqual(toPolicyBlocks("<script>x</script>"), [{ kind: "p", text: "<script>x</script>" }], "text only, rendered escaped by React");
  assert.equal(resolvePolicy("shipping", { source: "fallback", items: [{ payload: POLICY_DEFAULTS.shipping }] })?.title, "Shipping Policy");
  assert.equal(resolvePolicy("shipping", { source: "cms", items: [] }), null, "deactivated → hidden");
  assert.equal(resolvePolicy("returns", { source: "cms", items: [{ payload: { title: "" } }] })?.title, "Return Policy", "invalid stored → default");
  console.log("   ✓ defaults valid and free of unconfirmed promises, validation, paragraphs/lists, default/deactivated/invalid");
}

console.log("4. Policy pages: CMS workflow...");
await (async () => {
  for (const k of POLICY_KEYS) {
    assert.ok(CMS_MODULES.some((m) => m.id === POLICY_MODULES[k].id), `${k} registered`);
    assert.equal(getCmsModule(`policy-${k}`)?.kind, "singleton");
  }
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  const mod = POLICY_MODULES.returns;
  const shown = async () => resolvePolicy("returns", resolvePublished(await listEntries(repo, mod), [POLICY_DEFAULTS.returns], new Date()));
  assert.equal((await shown())?.title, "Return Policy");
  const custom = { ...POLICY_DEFAULTS.returns, title: "Returns & Exchanges", lastUpdated: "2026-11-24" };
  const draft = await createEntry(ctx, mod, { draft: custom });
  assert.equal((await shown())?.title, "Return Policy", "a draft never changes the website");
  const pub = await publishEntry(ctx, mod, draft.id, draft.version);
  assert.deepEqual([(await shown())?.title, (await shown())?.lastUpdated], ["Returns & Exchanges", "2026-11-24"]);
  await unpublishEntry(ctx, mod, pub.id, pub.version);
  assert.equal(await shown(), null, "deactivated");
  console.log("   ✓ default until published, drafts private, publish, deactivate");
})();

console.log("5. Collection pages and links...");
{
  const p = (name: string, notes: string[], extra: object = {}) => ({ slug: name, name, collections: [], bestseller: false, keywords: [], notes: { top: notes.map((n) => ({ name: n })), heart: [], base: [] }, ...extra });
  const products = [p("A", ["Bergamot", "Pink Pepper"]), p("B", ["Rose Absolute"]), p("C", ["Cambodian Oud", "Sandalwood"]), p("D", ["Vanilla"]), p("E", [], { productTypeId: "attar" }), p("F", [], { category: "Attars" })];
  assert.deepEqual(selectNoteFamily(products, "citrus").map((x) => x.slug), ["A"]);
  assert.deepEqual(selectNoteFamily(products, "floral").map((x) => x.slug), ["B"]);
  assert.deepEqual(selectNoteFamily(products, "oud").map((x) => x.slug), ["C"]);
  assert.deepEqual(selectNoteFamily(products, "woody").map((x) => x.slug), ["C"]);
  assert.equal(inNoteFamily(p("G", ["Orangewood"]), "citrus"), false, "whole words only");
  assert.deepEqual(selectAttar(products).map((x) => x.slug), ["E", "F"]);
  assert.ok(NOTE_CATEGORIES.every((c) => c.href === `/notes/${c.slug}`), "every Explore Collection button has a destination");
  assert.equal(PRIMARY_NAV.find((n) => n.label === "Contact Us")?.href, "/contact");
  assert.ok(FAQS.every((f) => !/coming soon|published here soon/i.test(f.answer)), "no unfinished FAQ answers");
  assert.equal(composeContactMessage(" Asha ", "A gift", " Which one? "), "Hello Luftansa, this is Asha.\nI have a question about: A gift.\n\nWhich one?");
  console.log("   ✓ note families from confirmed notes, Attar by type/category, live links, finished FAQs, contact message");
}

console.log("--- Site polish tests passed ---");
