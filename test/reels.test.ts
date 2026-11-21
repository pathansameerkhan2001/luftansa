import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import {
  isInstagramProfileUrl, isInstagramReelUrl, isSafeVideoUrl, MAX_REELS, REELS_MODULE, REELS_SECTION_DEFAULT, REELS_SECTION_MODULE, reelPayloadSchema,
  reelsSectionPayloadSchema, resolveReelsSection,
} from "@/lib/cms/modules/reels";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { resolvePublished } from "@/lib/cms/published";
import { createEntry, deleteEntry, listEntries, publishEntry, reorderEntries, unpublishEntry } from "@/lib/cms/service";
import { AuditService } from "@/lib/db/audit";
import { Repository, ValidationError } from "@/lib/db/repository";
import { findUsage } from "@/lib/media/library";

console.log("--- Testing Phase 4: Instagram Reels CMS ---");

const VIDEO = "videos/2026-11/black-velvet.mp4";
const POSTER = "general/2026-11/black-velvet-poster.jpg";
const reel = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  caption: "A warm evening trail.",
  fragranceName: "Black Velvet",
  video: { source: "upload", key: VIDEO },
  poster: { key: POSTER, alt: "Black Velvet bottle on velvet" },
  instagramUrl: "https://www.instagram.com/reel/C1a2B3c4D5e/",
  ...extra,
});
const url = (k: string) => `/media/${k}`;
const NO_PRODUCTS = new Map<string, { href: string; name: string }>();

console.log("1. Link validation...");
{
  for (const ok of ["https://www.instagram.com/reel/C1a2B3c4D5e/", "https://instagram.com/reels/C1a2B3c4D5e", "https://www.instagram.com/p/C1a2B3c4D5e/"]) assert.ok(isInstagramReelUrl(ok), ok);
  for (const bad of ["http://www.instagram.com/reel/C1a2B3c4D5e/", "https://www.instagram.com.evil.com/reel/C1a2B3c4D5e/", "https://www.instagram.com/luftansa/", "javascript:alert(1)", "https://user:pw@www.instagram.com/reel/C1a2B3c4D5e/", ""]) {
    assert.ok(!isInstagramReelUrl(bad), `reel ${bad}`);
  }
  assert.ok(isInstagramProfileUrl("https://www.instagram.com/luftansa.perfumes/"));
  assert.ok(!isInstagramProfileUrl("https://www.instagram.com/reel/"), "not a profile");
  assert.ok(!isInstagramProfileUrl("https://twitter.com/luftansa"));
  assert.ok(isSafeVideoUrl("https://cdn.example.com/reels/black-velvet.mp4"));
  assert.ok(isSafeVideoUrl("https://cdn.example.com/a.WEBM"));
  for (const bad of ["http://cdn.example.com/a.mp4", "https://cdn.example.com/a.mov", "https://localhost/a.mp4", "https://127.0.0.1/a.mp4", "https://192.168.1.4/a.mp4", "https://intranet/a.mp4", "https://www.instagram.com/reel/C1a2B3c4D5e/", "javascript:a.mp4", "https://x.com/a b.mp4"]) {
    assert.ok(!isSafeVideoUrl(bad), `video ${bad}`);
  }
  console.log("   ✓ Instagram Reel/profile links and https MP4/WebM video links only");
}

console.log("2. Reel content validation...");
{
  assert.ok(reelPayloadSchema.safeParse(reel("Black Velvet, after dark")).success, "uploaded video");
  assert.ok(reelPayloadSchema.safeParse(reel("Linked video", { video: { source: "url", url: "https://cdn.example.com/a.mp4" }, productId: "black-velvet" })).success, "video link + product");
  const invalid: [string, Record<string, unknown>][] = [
    ["title required", { title: "" }],
    ["poster required", { poster: undefined }],
    ["poster alt required", { poster: { key: POSTER, alt: "" } }],
    ["poster must be an image", { poster: { key: VIDEO, alt: "x" } }],
    ["video must be a video", { video: { source: "upload", key: POSTER } }],
    ["video key in an allowed folder", { video: { source: "upload", key: "secrets/x.mp4" } }],
    ["video link https", { video: { source: "url", url: "http://cdn.example.com/a.mp4" } }],
    ["instagram link", { instagramUrl: "https://example.com/reel/1" }],
    ["unknown fields refused", { rating: 5 }],
    ["caption length", { caption: "x".repeat(201) }],
  ];
  for (const [label, patch] of invalid) assert.ok(!reelPayloadSchema.safeParse(reel("T", patch)).success, label);
  const noProfile = reelsSectionPayloadSchema.parse({ heading: "Moments", instagramProfileUrl: "" });
  assert.deepEqual([noProfile.heading, noProfile.instagramProfileUrl], ["Moments", undefined], "empty profile link is 'not set'");
  assert.ok(!reelsSectionPayloadSchema.safeParse({ heading: "", subtitle: "x" }).success, "heading required");
  console.log("   ✓ required fields, media kinds, folders, links, lengths, no unknown fields");
}

console.log("3. What the homepage shows...");
{
  const published = (items: { id: string; payload: unknown }[]) => ({ source: "cms" as const, items });
  const fallbackSection = { source: "fallback" as const, items: [{ id: "default-0", payload: REELS_SECTION_DEFAULT }] };
  const reels = published([{ id: "r1", payload: reel("First") }, { id: "r2", payload: reel("Second", { video: { source: "url", url: "https://cdn.example.com/b.mp4" }, productId: "black-velvet" }) }]);

  const view = resolveReelsSection(fallbackSection, reels, url, new Map([["black-velvet", { href: "/products/black-velvet", name: "Black Velvet" }]]))!;
  assert.equal(view.heading, REELS_SECTION_DEFAULT.heading, "default text until the admin saves the section");
  assert.deepEqual(view.reels.map((r) => r.id), ["r1", "r2"], "CMS order kept");
  assert.equal(view.reels[0].videoSrc, `/media/${VIDEO}`);
  assert.equal(view.reels[0].poster.src, `/media/${POSTER}`);
  assert.equal(view.reels[1].videoSrc, "https://cdn.example.com/b.mp4");
  assert.deepEqual(view.reels[1].product, { href: "/products/black-velvet", name: "Black Velvet" });
  assert.equal(resolveReelsSection(fallbackSection, reels, url, NO_PRODUCTS)!.reels[1].product, undefined, "hidden/missing product: no Shop link");

  const custom = resolveReelsSection(published([{ id: "main", payload: { heading: "The Fragrance Edit", subtitle: "Watch.", instagramProfileUrl: "https://www.instagram.com/luftansa/" } }]), reels, url, NO_PRODUCTS)!;
  assert.deepEqual([custom.heading, custom.subtitle, custom.instagramProfileUrl], ["The Fragrance Edit", "Watch.", "https://www.instagram.com/luftansa/"]);

  assert.equal(resolveReelsSection(published([]), reels, url, NO_PRODUCTS), null, "section deactivated → hidden");
  assert.equal(resolveReelsSection(fallbackSection, published([]), url, NO_PRODUCTS), null, "no active Reels → hidden");
  assert.equal(resolveReelsSection(fallbackSection, { source: "fallback", items: [] }, url, NO_PRODUCTS), null, "database unavailable → hidden");
  const broken = resolveReelsSection(fallbackSection, published([{ id: "bad", payload: { title: "x" } }, { id: "ok", payload: reel("Fine") }]), url, NO_PRODUCTS)!;
  assert.deepEqual(broken.reels.map((r) => r.id), ["ok"], "invalid stored Reel skipped, never rendered broken");
  assert.equal(resolveReelsSection(fallbackSection, published([{ id: "bad", payload: {} }]), url, NO_PRODUCTS), null, "only invalid Reels → hidden");
  console.log("   ✓ default text, order, uploads and links, product links only when active; hidden when off, empty or failing");
}

console.log("4. CMS workflow (create, activate, deactivate, order, delete)...");
await (async () => {
  // Compared by id (the test loader may load the module file twice via different import paths).
  assert.ok(CMS_MODULES.some((m) => m.id === "reels") && CMS_MODULES.some((m) => m.id === "reels-section"), "registered (admin API + Media Library usage)");
  assert.deepEqual([getCmsModule("reels")?.kind, getCmsModule("reels")?.maxEntries, getCmsModule("reels-section")?.kind], ["list", MAX_REELS, "singleton"]);
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, "luftansa-test");
  const audit = new AuditService(repo);
  const ctx = { repo, audit, actorEmail: "admin@luftansa.local" };

  const a = await createEntry(ctx, REELS_MODULE, { draft: reel("First") });
  const b = await createEntry(ctx, REELS_MODULE, { draft: reel("Second") });
  assert.deepEqual([a.displayOrder, b.displayOrder], [0, 1], "new Reels go to the end");
  await assert.rejects(() => createEntry(ctx, REELS_MODULE, { draft: reel("Bad", { instagramUrl: "nope" }) }), (e: unknown) => e instanceof ValidationError, "server validates");

  const pubA = await publishEntry(ctx, REELS_MODULE, a.id, a.version);
  await publishEntry(ctx, REELS_MODULE, b.id, b.version);
  let shown = resolvePublished(await listEntries(repo, REELS_MODULE), [], new Date());
  assert.deepEqual(shown.items.map((i) => (i.payload as { title: string }).title), ["First", "Second"]);

  await unpublishEntry(ctx, REELS_MODULE, a.id, pubA.version);
  shown = resolvePublished(await listEntries(repo, REELS_MODULE), [], new Date());
  assert.deepEqual(shown.items.map((i) => (i.payload as { title: string }).title), ["Second"], "inactive Reel not shown");

  const [ea, eb] = (await listEntries(repo, REELS_MODULE)).sort((x, y) => x.displayOrder - y.displayOrder);
  const reordered = await reorderEntries(ctx, REELS_MODULE, [{ id: eb.id, version: eb.version }, { id: ea.id, version: ea.version }]);
  assert.deepEqual(reordered.sort((x, y) => x.displayOrder - y.displayOrder).map((e) => (e.draft as { title: string }).title), ["Second", "First"], "reordered");

  // Media in use by a Reel is protected from deletion in the Media Library.
  const usage = await findUsage(repo, POSTER, CMS_MODULES);
  assert.ok(usage.some((u) => u.type === "content" && u.id.startsWith("reels/")), "poster reported as used by a Reel");
  assert.ok((await findUsage(repo, VIDEO, CMS_MODULES)).length > 0, "video reported as used");

  const current = (await listEntries(repo, REELS_MODULE)).find((e) => e.id === a.id)!;
  await deleteEntry(ctx, REELS_MODULE, a.id, current.version);
  assert.deepEqual((await listEntries(repo, REELS_MODULE)).map((e) => e.id), [b.id], "deleted");
  assert.ok((await findUsage(repo, POSTER, CMS_MODULES)).length > 0, "still used by the other Reel");

  // Section record: one only; deactivating hides the section.
  const s = await createEntry(ctx, REELS_SECTION_MODULE, { draft: { heading: "The Fragrance Edit" } });
  await assert.rejects(() => createEntry(ctx, REELS_SECTION_MODULE, { draft: { heading: "Again" } }));
  const sp = await publishEntry(ctx, REELS_SECTION_MODULE, s.id, s.version);
  await unpublishEntry(ctx, REELS_SECTION_MODULE, s.id, sp.version);
  const sectionAfter = resolvePublished(await listEntries(repo, REELS_SECTION_MODULE), [REELS_SECTION_DEFAULT], new Date());
  const reelsAfter = resolvePublished(await listEntries(repo, REELS_MODULE), [], new Date());
  assert.equal(resolveReelsSection(sectionAfter, reelsAfter, url, NO_PRODUCTS), null, "hidden section stays hidden even with active Reels");

  // Limit.
  for (let i = (await listEntries(repo, REELS_MODULE)).length; i < MAX_REELS; i++) await createEntry(ctx, REELS_MODULE, { draft: reel(`R${i}`) });
  await assert.rejects(() => createEntry(ctx, REELS_MODULE, { draft: reel("One too many") }), (e: unknown) => e instanceof ValidationError, `at most ${MAX_REELS}`);
  console.log("   ✓ create/validate, activate/deactivate, reorder, delete, media protection, section hide, 24-Reel limit");
})();

console.log("--- Instagram Reels tests passed ---");
