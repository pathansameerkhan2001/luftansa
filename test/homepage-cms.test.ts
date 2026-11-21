/**
 * Phase 3B, Checkpoint A: fallback fix, shared CMS fields and the Hero module.
 */
import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { Repository, ConflictError, ValidationError } from "@/lib/db/repository";
import { AuditService } from "@/lib/db/audit";
import { createEntry, deleteEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import { hasBeenPublished, resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import type { CmsModuleDefinition } from "@/lib/cms/schemas";
import { isSafeHref, mediaKeySchema, optionalCtaSchema, visibilityClassName, MOBILE_MEDIA_QUERY } from "@/lib/cms/fields";
import { HERO_MODULE, heroMediaKeys, heroPayloadSchema, resolveHeroView, type HeroPayloadInput } from "@/lib/cms/modules/hero";
import { isAllowedAssetKey as sharedIsAllowed } from "@/lib/s3/asset-keys";
import { isAllowedAssetKey as serverIsAllowed } from "@/lib/s3";
import { findUsage, MediaInUseError, registerMedia, requestDeletion } from "@/lib/media/library";
import { z } from "zod";

console.log("--- Testing Phase 3B Checkpoint A: CMS groundwork and Hero Section ---");

const ACTOR = "admin@luftansa.local";
function services(start = "2026-11-17T10:00:00.000Z") {
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, "luftansa-test");
  const now = new Date(start);
  const clock = () => now;
  const audit = new AuditService(repo, clock);
  return { repo, ctx: { repo, audit, actorEmail: ACTOR, now: clock } };
}

const fixtureModule: CmsModuleDefinition = { id: "fixture-section", label: "Fixture", kind: "list", payload: z.object({ text: z.string().min(1) }) };
const fallback = [{ text: "Today's approved content" }];
const now = new Date("2026-11-17T12:00:00.000Z");

/* ------------------------------------------------------------------------- */
console.log("1. Fallback fix: saving a draft never changes the live site...");
{
  const { repo, ctx } = services();
  const draft = await createEntry(ctx, fixtureModule, { id: "one", draft: { text: "Draft only" } });
  let r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.equal(r.source, "fallback", "draft-only module keeps today's content (the Phase 3A gap)");
  assert.deepEqual(r.items.map((i) => i.payload), fallback);

  const saved = await saveDraft(ctx, fixtureModule, "one", { text: "Draft edited" }, draft.version);
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.equal(r.source, "fallback", "re-saving a never-published draft still keeps today's content");

  const live = await publishEntry(ctx, fixtureModule, "one", saved.version);
  assert.ok(hasBeenPublished(live));
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.equal(r.source, "cms");
  assert.deepEqual(r.items.map((i) => i.payload), [{ text: "Draft edited" }], "only Publish changes the site");

  const later = await saveDraft(ctx, fixtureModule, "one", { text: "Newer draft" }, live.version);
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.deepEqual(r.items.map((i) => i.payload), [{ text: "Draft edited" }], "a newer draft never leaks before publishing");

  // A second, draft-only entry next to a published one changes nothing.
  await createEntry(ctx, fixtureModule, { id: "two", draft: { text: "Second draft" } });
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.deepEqual(r.items.map((i) => i.payload), [{ text: "Draft edited" }]);

  const off = await unpublishEntry(ctx, fixtureModule, "one", later.version);
  assert.ok(off.publishedAt && hasBeenPublished(off), "deactivated entries remember they were published");
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.equal(r.source, "cms");
  assert.equal(r.items.length, 0, "deliberately deactivated: hidden, no silent fallback");

  await deleteEntry(ctx, fixtureModule, "one", off.version);
  r = resolvePublished(await listEntries(repo, fixtureModule), fallback, now);
  assert.equal(r.source, "fallback", "once nothing published remains, today's content returns");
  assert.equal(resolvePublished(null, fallback, now).source, "fallback", "database unavailable");
  console.log("   ✓ Fallback rules verified");
}

/* ------------------------------------------------------------------------- */
console.log("2. Shared fields: media keys, links, buttons, visibility...");
{
  for (const k of ["hero/a.jpg", "products/x/main/1.jpg", "secret/a.jpg", "hero/../a.jpg", "hero/", "", "cms/a\\b.jpg"]) {
    assert.equal(sharedIsAllowed(k), serverIsAllowed(k), `server and client agree on "${k}" (one allow-list, re-exported)`);
  }
  const img = mediaKeySchema("image");
  const vid = mediaKeySchema("video");
  assert.ok(img.safeParse("hero/2026-11/1-banner.jpg").success);
  assert.ok(img.safeParse("general/2026-11/1-a.WEBP").success);
  assert.ok(!img.safeParse("hero/2026-11/1-clip.mp4").success, "a video is not an image");
  assert.ok(!img.safeParse("secret/a.jpg").success, "folder outside the allow-list");
  assert.ok(!img.safeParse("hero/../logo/x.jpg").success, "path traversal");
  assert.ok(!img.safeParse("").success);
  assert.ok(vid.safeParse("hero/2026-11/1-clip.mp4").success && vid.safeParse("videos/a.webm").success);
  assert.ok(!vid.safeParse("hero/2026-11/1-banner.jpg").success, "an image is not a video");

  for (const ok of ["/", "/shop", "/#personality-collection", "/products/black-velvet?size=50ml", "https://www.instagram.com/luftansa"]) {
    assert.ok(isSafeHref(ok), `allowed: ${ok}`);
  }
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "//evil.example", "/\\evil.example", "http://example.com", "shop", "https:// x", "", "/ space"]) {
    assert.ok(!isSafeHref(bad), `rejected: ${bad}`);
  }

  assert.equal(optionalCtaSchema.parse({ label: "", href: "  " }), undefined, "an empty button is no button");
  assert.equal(optionalCtaSchema.parse(undefined), undefined);
  assert.deepEqual(optionalCtaSchema.parse({ label: " Explore ", href: "/shop " }), { label: "Explore", href: "/shop" });
  assert.ok(!optionalCtaSchema.safeParse({ label: "Explore", href: "" }).success, "label without destination");
  assert.ok(!optionalCtaSchema.safeParse({ label: "", href: "/shop" }).success, "destination without label");

  assert.equal(visibilityClassName({ desktop: true, mobile: true }), "");
  assert.equal(visibilityClassName({ desktop: true, mobile: false }), "hidden sm:block");
  assert.equal(visibilityClassName({ desktop: false, mobile: true }), "sm:hidden");
  assert.equal(visibilityClassName({ desktop: false, mobile: false }), null);
  assert.equal(MOBILE_MEDIA_QUERY, "(max-width: 639px)", "phones are below Tailwind's sm breakpoint");
  console.log("   ✓ Shared field rules verified");
}

/* ------------------------------------------------------------------------- */
console.log("3. Hero payload validation...");
const minimal: HeroPayloadInput = { desktop: { image: { key: "hero/2026-11/1-desk.jpg", alt: "Perfume bottles on ivory silk" } }, mobile: {} };
{
  const parsed = heroPayloadSchema.parse(minimal);
  assert.deepEqual(parsed.desktop.focal, { x: 50, y: 50 }, "focal point defaults to the centre");
  assert.deepEqual(parsed.mobile.focal, { x: 50, y: 50 });
  assert.equal(parsed.heading, undefined);
  assert.equal(parsed.cta, undefined);

  const full = heroPayloadSchema.parse({
    desktop: { image: { key: "hero/2026-11/1-desk.jpg", alt: " Desk " }, focal: { x: 30, y: 60 }, video: { key: "hero/2026-11/2-desk.mp4" } },
    mobile: { image: { key: "hero/2026-11/3-mob.webp", alt: "Mobile" }, focal: { x: 70, y: 40 }, video: { key: "hero/2026-11/4-mob.webm" } },
    heading: "  A heading  ",
    subtitle: "",
    cta: { label: "Explore the Collection", href: "/#personality-collection" },
  });
  assert.equal(full.desktop.image.alt, "Desk", "text is trimmed");
  assert.equal(full.heading, "A heading");
  assert.equal(full.subtitle, undefined, "empty subtitle is not stored");
  assert.deepEqual(heroMediaKeys(full), ["hero/2026-11/1-desk.jpg", "hero/2026-11/2-desk.mp4", "hero/2026-11/3-mob.webp", "hero/2026-11/4-mob.webm"]);

  const invalid: [string, unknown][] = [
    ["desktop image required", { desktop: {}, mobile: {} }],
    ["alt text required", { desktop: { image: { key: "hero/a.jpg", alt: " " } }, mobile: {} }],
    ["mobile image needs alt text", { ...minimal, mobile: { image: { key: "hero/m.jpg", alt: "" } } }],
    ["video in an image slot", { desktop: { image: { key: "hero/a.mp4", alt: "x" } }, mobile: {} }],
    ["image in a video slot", { ...minimal, mobile: { video: { key: "hero/a.jpg" } } }],
    ["focal point out of range", { ...minimal, desktop: { ...minimal.desktop, focal: { x: 101, y: 50 } } }],
    ["unsafe button link", { ...minimal, cta: { label: "Go", href: "javascript:alert(1)" } }],
    ["half-filled button", { ...minimal, cta: { label: "Go", href: "" } }],
    ["heading too long", { ...minimal, heading: "x".repeat(121) }],
    ["unknown fields rejected", { ...minimal, colour: "red" }],
    ["unknown nested fields rejected", { ...minimal, desktop: { ...minimal.desktop, autoplay: false } }],
  ];
  for (const [label, payload] of invalid) assert.ok(!heroPayloadSchema.safeParse(payload).success, label);
  console.log("   ✓ Hero validation verified");
}

/* ------------------------------------------------------------------------- */
console.log("4. Hero rendering: phones never get the desktop video...");
{
  const url = (k: string) => `/media/${k}`;
  const desktopOnly = resolveHeroView(
    heroPayloadSchema.parse({ desktop: { image: { key: "hero/d.jpg", alt: "Desk" }, focal: { x: 20, y: 80 }, video: { key: "hero/d.mp4" } }, mobile: { focal: { x: 65, y: 35 } } }),
    url,
  );
  assert.equal(desktopOnly.desktop.videoSrc, "/media/hero/d.mp4");
  assert.equal(desktopOnly.mobile.videoSrc, undefined, "no mobile video: phones show the image only");
  assert.equal(desktopOnly.mobile.imageSrc, "/media/hero/d.jpg", "no mobile image: phones use the desktop image");
  assert.equal(desktopOnly.mobile.alt, "Desk");
  assert.equal(desktopOnly.desktop.position, "20% 80%");
  assert.equal(desktopOnly.mobile.position, "65% 35%", "phones keep their own focal point on the desktop image");
  assert.equal(desktopOnly.heading, undefined);
  assert.ok(!("cta" in desktopOnly), "no button unless one is set");

  const both = resolveHeroView(
    heroPayloadSchema.parse({ desktop: { image: { key: "hero/d.jpg", alt: "Desk" } }, mobile: { image: { key: "hero/m.jpg", alt: "Mob" }, video: { key: "hero/m.mp4" } }, heading: "H", cta: { label: "Shop", href: "/shop" } }),
    url,
  );
  assert.equal(both.mobile.imageSrc, "/media/hero/m.jpg");
  assert.equal(both.mobile.alt, "Mob");
  assert.equal(both.mobile.videoSrc, "/media/hero/m.mp4");
  assert.equal(both.desktop.videoSrc, undefined);
  assert.deepEqual(both.cta, { label: "Shop", href: "/shop" });
  console.log("   ✓ Hero rendering rules verified");
}

/* ------------------------------------------------------------------------- */
console.log("5. Hero module: registry, publishing and fallback...");
{
  // (Compared by identity fields: the test loader may hold separate copies of the same module.)
  const registered = getCmsModule("hero");
  assert.deepEqual(registered && { id: registered.id, kind: registered.kind, label: registered.label }, { id: "hero", kind: "singleton", label: "Hero Section" });
  assert.equal(HERO_MODULE.kind, "singleton");
  assert.ok(CMS_MODULES.some((m) => m.id === HERO_MODULE.id));
  assert.equal(getCmsModule("not-a-module"), undefined);

  const { repo, ctx } = services();
  await assert.rejects(() => createEntry(ctx, HERO_MODULE, { draft: { desktop: {}, mobile: {} } }), (e: unknown) => e instanceof ValidationError, "invalid hero is refused by the server");
  const created = await createEntry(ctx, HERO_MODULE, { draft: minimal as Record<string, unknown> });
  assert.equal(created.id, "main");
  await assert.rejects(() => createEntry(ctx, HERO_MODULE, { draft: minimal as Record<string, unknown> }), (e: unknown) => e instanceof ConflictError, "only one hero");

  let r = resolvePublished(await listEntries(repo, HERO_MODULE), [], now);
  assert.equal(r.source, "fallback", "saved hero draft: the website keeps today's hero");

  await assert.rejects(
    () => saveDraft(ctx, HERO_MODULE, "main", { ...minimal, cta: { label: "x", href: "//evil.example" } }, created.version),
    (e: unknown) => e instanceof ValidationError && e.issues.some((i) => i.path === "draft.cta.href"),
    "unsafe link refused with the field path",
  );
  const live = await publishEntry(ctx, HERO_MODULE, "main", created.version);
  await assert.rejects(() => publishEntry(ctx, HERO_MODULE, "main", created.version), (e: unknown) => e instanceof ConflictError, "stale version is refused");
  r = resolvePublished(await listEntries(repo, HERO_MODULE), [], now);
  assert.equal(r.source, "cms");
  assert.equal(r.items.length, 1);
  assert.deepEqual(heroPayloadSchema.parse(r.items[0].payload).desktop.image.key, "hero/2026-11/1-desk.jpg");

  await unpublishEntry(ctx, HERO_MODULE, "main", live.version);
  r = resolvePublished(await listEntries(repo, HERO_MODULE), [], now);
  assert.equal(r.source, "cms");
  assert.equal(r.items.length, 0, "deactivated hero: no hero on the website");
  console.log("   ✓ Hero publishing verified");
}

/* ------------------------------------------------------------------------- */
console.log("6. Media used by the hero cannot be deleted...");
{
  const { repo, ctx } = services();
  const image = await registerMedia(ctx, { key: "hero/2026-11/1-desk.jpg", kind: "image", contentType: "image/jpeg", sizeBytes: 10, originalFilename: "desk.jpg", folder: "hero" });
  const video = await registerMedia(ctx, { key: "hero/2026-11/2-desk.mp4", kind: "video", contentType: "video/mp4", sizeBytes: 10, originalFilename: "desk.mp4", folder: "hero" });
  const spare = await registerMedia(ctx, { key: "hero/2026-11/3-spare.jpg", kind: "image", contentType: "image/jpeg", sizeBytes: 10, originalFilename: "spare.jpg", folder: "hero" });
  await createEntry(ctx, HERO_MODULE, { draft: { ...minimal, desktop: { ...minimal.desktop, video: { key: video.key } } } as Record<string, unknown> });

  const usage = await findUsage(repo, image.key, CMS_MODULES);
  assert.deepEqual(usage.map((u) => [u.type, u.id, u.field]), [["content", "hero/main", "Draft content"]], "draft references count as usage");
  await assert.rejects(() => requestDeletion(ctx, image.id, image.version, CMS_MODULES), (e: unknown) => e instanceof MediaInUseError);
  await assert.rejects(() => requestDeletion(ctx, video.id, video.version, CMS_MODULES), (e: unknown) => e instanceof MediaInUseError);
  const pending = await requestDeletion(ctx, spare.id, spare.version, CMS_MODULES);
  assert.equal(pending.status, "PENDING_DELETION", "unused files can still be deleted (two-step)");
  console.log("   ✓ Usage protection verified");
}

console.log("✓ Phase 3B Checkpoint A tests passed");
