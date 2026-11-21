import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { BRAND_STORY_DEFAULT, BRAND_STORY_MODULE, brandStoryPayloadSchema, resolveBrandStory, toBrandStoryView } from "@/lib/cms/modules/brand-story";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import { AuditService } from "@/lib/db/audit";
import { ConflictError, Repository, ValidationError } from "@/lib/db/repository";
import { findUsage } from "@/lib/media/library";

console.log("--- Testing Brand Story CMS ---");

const IMG = "about/2026-11/luftansa-story.jpg";
const url = (k: string) => `/media/${k}`;
const story = (patch: Record<string, unknown> = {}) => ({ ...BRAND_STORY_DEFAULT, ...patch });

console.log("1. Defaults keep today's section...");
{
  assert.ok(brandStoryPayloadSchema.safeParse(BRAND_STORY_DEFAULT).success);
  const v = toBrandStoryView(BRAND_STORY_DEFAULT, url);
  assert.deepEqual([v.eyebrow, v.heading, v.cta?.label, v.cta?.href, v.image, v.imagePosition, v.background], ["Our Brand", "The Luftansa Story", "Discover Our Story", undefined, undefined, "left", "ivory"]);
  assert.match(v.paragraphs[0], /^At Luftansa Fragrance Craft Hub, we believe every fragrance tells a story\./);
  console.log("   ✓ eyebrow, heading, description, button (no link yet), image frame, layout");
}

console.log("2. Validation...");
{
  const bad: [string, Record<string, unknown>][] = [
    ["empty heading", { heading: "  " }],
    ["empty description", { description: "" }],
    ["empty eyebrow", { eyebrow: "" }],
    ["long heading", { heading: "x".repeat(81) }],
    ["button label required", { cta: { show: true, label: "" } }],
    ["unsafe link", { cta: { show: true, label: "Go", href: "javascript:alert(1)" } }],
    ["protocol-relative link", { cta: { show: true, label: "Go", href: "//evil.example.com" } }],
    ["http link", { cta: { show: true, label: "Go", href: "http://example.com" } }],
    ["image alt required", { image: { key: IMG, alt: "" } }],
    ["image must be an image", { image: { key: "videos/2026-11/a.mp4", alt: "x" } }],
    ["image in an allowed folder", { image: { key: "secrets/a.jpg", alt: "x" } }],
    ["bad focal point", { image: { key: IMG, alt: "x", focal: { x: 150, y: 50 } } }],
    ["bad background", { layout: { imagePosition: "left", background: "neon" } }],
    ["unknown field", { rating: 5 }],
  ];
  for (const [label, patch] of bad) assert.ok(!brandStoryPayloadSchema.safeParse(story(patch)).success, label);
  const ok = brandStoryPayloadSchema.parse(story({ cta: { show: true, label: "Read more", href: "" } }));
  assert.equal(ok.cta.href, undefined, "empty destination = label without a link");
  assert.ok(brandStoryPayloadSchema.safeParse(story({ cta: { show: true, label: "Our story", href: "/#brand-story-heading" } })).success);
  assert.ok(brandStoryPayloadSchema.safeParse(story({ cta: { show: true, label: "Instagram", href: "https://www.instagram.com/luftansa/" } })).success);
  const withImage = brandStoryPayloadSchema.parse(story({ image: { key: IMG, alt: "Perfumer at work" } }));
  assert.deepEqual(withImage.image?.focal, { x: 50, y: 50 }, "focal point defaults to centre");
  console.log("   ✓ required text, lengths, safe links only, image rules, layout values, no unknown fields");
}

console.log("3. What the section shows...");
{
  const p = brandStoryPayloadSchema.parse(
    story({
      heading: "Crafted in India",
      description: "First paragraph\ncontinues here.\n\nSecond paragraph.",
      cta: { show: true, label: "Explore", href: "/perfumes" },
      image: { key: IMG, alt: "Perfumer at work", focal: { x: 30, y: 70 } },
      layout: { imagePosition: "right", background: "cream" },
    }),
  );
  const v = toBrandStoryView(p, url);
  assert.deepEqual(v.paragraphs, ["First paragraph continues here.", "Second paragraph."], "blank lines make paragraphs");
  assert.deepEqual(v.cta, { label: "Explore", href: "/perfumes" });
  assert.deepEqual(v.image, { src: `/media/${IMG}`, alt: "Perfumer at work", position: "30% 70%" });
  assert.deepEqual([v.imagePosition, v.background], ["right", "cream"]);
  assert.equal(toBrandStoryView({ ...p, cta: { ...p.cta, show: false } }, url).cta, undefined, "button hidden");

  const fallback = { source: "fallback" as const, items: [{ payload: BRAND_STORY_DEFAULT }] };
  assert.equal(resolveBrandStory(fallback, url)?.heading, "The Luftansa Story", "never published / database unavailable → default");
  assert.equal(resolveBrandStory({ source: "cms", items: [] }, url), null, "deactivated → section removed");
  assert.equal(resolveBrandStory({ source: "cms", items: [{ payload: p }] }, url)?.heading, "Crafted in India", "published content");
  assert.equal(resolveBrandStory({ source: "cms", items: [{ payload: { heading: "" } }] }, url)?.heading, "The Luftansa Story", "invalid stored content → default, never a broken section");
  console.log("   ✓ paragraphs, button, image focal point, layout; default, published, deactivated, invalid");
}

console.log("4. CMS workflow...");
await (async () => {
  assert.ok(CMS_MODULES.some((m) => m.id === "brand-story"), "registered");
  assert.equal(getCmsModule("brand-story")?.kind, "singleton");
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  const shown = async () => resolveBrandStory(resolvePublished(await listEntries(repo, BRAND_STORY_MODULE), [BRAND_STORY_DEFAULT], new Date()), url);

  assert.equal((await shown())?.heading, "The Luftansa Story", "nothing saved: default");
  const draft = await createEntry(ctx, BRAND_STORY_MODULE, { draft: story({ heading: "Draft heading" }) });
  assert.equal((await shown())?.heading, "The Luftansa Story", "a draft never changes the website");
  await assert.rejects(() => createEntry(ctx, BRAND_STORY_MODULE, { draft: story() }), (e: unknown) => e instanceof ConflictError, "one record only");
  await assert.rejects(() => saveDraft(ctx, BRAND_STORY_MODULE, draft.id, story({ heading: "" }), draft.version), (e: unknown) => e instanceof ValidationError, "server validates");

  const edited = await saveDraft(ctx, BRAND_STORY_MODULE, draft.id, story({ heading: "Our Craft", description: "New story.", cta: { show: true, label: "Shop now", href: "/perfumes" }, image: { key: IMG, alt: "Bottle" }, layout: { imagePosition: "right", background: "white" } }), draft.version);
  const pub = await publishEntry(ctx, BRAND_STORY_MODULE, edited.id, edited.version);
  const live = (await shown())!;
  assert.deepEqual([live.heading, live.paragraphs[0], live.cta?.label, live.cta?.href, live.image?.src, live.imagePosition, live.background], ["Our Craft", "New story.", "Shop now", "/perfumes", `/media/${IMG}`, "right", "white"]);

  assert.ok((await findUsage(repo, IMG, CMS_MODULES)).some((u) => u.id === "brand-story/main"), "image protected in the Media Library");

  await unpublishEntry(ctx, BRAND_STORY_MODULE, pub.id, pub.version);
  assert.equal(await shown(), null, "deactivated: removed from the homepage");
  console.log("   ✓ default until published, drafts private, one record, validation, publish, media protection, deactivate");
})();

console.log("--- Brand Story tests passed ---");
