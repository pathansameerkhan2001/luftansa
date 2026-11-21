import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { hasAnySection, OUR_STORY_DEFAULT, OUR_STORY_MODULE, ourStoryPayloadSchema, resolveOurStory, splitLines, toOurStoryView, type OurStoryPayload } from "@/lib/cms/modules/our-story";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import { AuditService } from "@/lib/db/audit";
import { ConflictError, Repository, ValidationError } from "@/lib/db/repository";
import { findUsage } from "@/lib/media/library";
import { ABOUT_ROUTE } from "@/lib/routes";

console.log("--- Testing Our Story CMS ---");

const D = OUR_STORY_DEFAULT;
const url = (k: string) => `/media/${k}`;
const IMG = "about/2026-11/story-hero.jpg";
const clone = (): OurStoryPayload => JSON.parse(JSON.stringify(D));
const valid = (p: unknown) => ourStoryPayloadSchema.safeParse(p).success;

console.log("1. Defaults: three sections, no images, no figures or claims...");
{
  assert.ok(valid(D));
  const v = toOurStoryView(D, url);
  assert.deepEqual(v.hero?.lines, ["Built with love,", "patience,", "honesty &", "real feedback"]);
  assert.equal(v.why?.title, "Why We Started");
  assert.equal(v.why?.heading, "Before building anything, we studied two things.");
  assert.deepEqual(v.why?.blocks.map((b) => [b.number, b.heading]), [[1, "The Perfume Makers"], [2, "The Consumers"]]);
  assert.equal(v.why?.attribution, undefined, "no invented founder name");
  assert.deepEqual(v.journey?.steps.map((s) => s.title), ["Research & Development", "Consumer Survey", "Formulation & Prototyping", "Comparison & Testing", "Final Product"]);
  assert.ok(v.journey?.steps.every((s, i) => s.number === i + 1 && !s.period && !s.caption && !s.image));
  assert.ok(!v.hero?.image && !v.why?.image, "no placeholder images");
  const all = JSON.stringify(D);
  assert.ok(!/\d/.test(all), "no numbers, dates or statistics in the default copy");
  assert.ok(!/IFRA|certif|laborator|lab-|lab test|tested/i.test(all), "no certification or laboratory claims");
  assert.equal(ABOUT_ROUTE, "/our-story");
  console.log("   ✓ hero lines, two blocks, five steps, numbered automatically; no images, numbers or claims");
}

console.log("2. Validation...");
{
  const bad: [string, (p: OurStoryPayload) => void][] = [
    ["empty headline", (p) => void (p.hero.headline = " \n ")],
    ["too many headline lines", (p) => void (p.hero.headline = "a\nb\nc\nd\ne\nf\ng")],
    ["headline line too long", (p) => void (p.hero.headline = "x".repeat(41))],
    ["empty section title", (p) => void (p.why.title = "")],
    ["no blocks", (p) => void (p.why.blocks = [])],
    ["too many blocks", (p) => void (p.why.blocks = Array(5).fill(D.why.blocks[0]))],
    ["block without description or points", (p) => void (p.why.blocks[0] = { heading: "X", points: "" })],
    ["too many points", (p) => void (p.why.blocks[0].points = Array(9).fill("point").join("\n"))],
    ["no steps", (p) => void (p.journey.steps = [])],
    ["too many steps", (p) => void (p.journey.steps = Array(9).fill(D.journey.steps[0]))],
    ["step without title", (p) => void (p.journey.steps[0].title = "")],
    ["step without description", (p) => void (p.journey.steps[0].description = "")],
    ["image without alt text", (p) => void (p.hero.image = { key: IMG, alt: "", focal: { x: 50, y: 50 } })],
    ["video as an image", (p) => void (p.why.image = { key: "videos/2026-11/a.mp4", alt: "x", focal: { x: 50, y: 50 } })],
    ["image outside allowed folders", (p) => void (p.journey.steps[0].image = { key: "secrets/a.jpg", alt: "x", focal: { x: 50, y: 50 } })],
    ["unknown field (no markup)", (p) => void ((p.hero as Record<string, unknown>).html = "<b>")],
  ];
  for (const [label, mutate] of bad) {
    const p = clone();
    mutate(p);
    assert.ok(!valid(p), label);
  }
  const p = clone();
  p.why.blocks[0] = { heading: "Only points", points: "One\n\nTwo" };
  p.why.attribution = "  ";
  p.journey.steps[0].period = "";
  const parsed = ourStoryPayloadSchema.parse(p);
  assert.equal(parsed.why.attribution, undefined, "empty attribution = none");
  assert.equal(parsed.journey.steps[0].period, undefined);
  assert.deepEqual(splitLines(parsed.why.blocks[0].points), ["One", "Two"], "blank lines ignored");
  console.log("   ✓ required text, line and length limits, 1-4 blocks, 1-8 steps, image rules, no extra fields");
}

console.log("3. Rendering: images, numbering, sections on/off...");
{
  const p = clone();
  p.hero.image = { key: IMG, alt: "Perfumer's desk", focal: { x: 30, y: 60 } };
  p.journey.steps = [D.journey.steps[2], { ...D.journey.steps[0], period: "Spring", caption: "Where it began", image: { key: "about/2026-11/step.jpg", alt: "Notes", focal: { x: 50, y: 50 } } }];
  p.why.attribution = "The Luftansa team";
  const v = toOurStoryView(ourStoryPayloadSchema.parse(p), url);
  assert.deepEqual(v.hero?.image, { src: `/media/${IMG}`, alt: "Perfumer's desk", position: "30% 60%" });
  assert.deepEqual(v.journey?.steps.map((s) => [s.number, s.title, s.period, s.caption]), [[1, "Formulation & Prototyping", undefined, undefined], [2, "Research & Development", "Spring", "Where it began"]], "renumbered after reordering");
  assert.equal(v.why?.attribution, "The Luftansa team");
  p.hero.enabled = false;
  p.journey.enabled = false;
  const partial = toOurStoryView(ourStoryPayloadSchema.parse(p), url);
  assert.deepEqual([!!partial.hero, !!partial.why, !!partial.journey], [false, true, false]);
  p.why.enabled = false;
  assert.equal(hasAnySection(toOurStoryView(ourStoryPayloadSchema.parse(p), url)), false, "everything off");
  assert.equal(resolveOurStory({ source: "fallback", items: [{ payload: D }] }, url)?.why?.title, "Why We Started", "never published / database unavailable → default");
  assert.equal(resolveOurStory({ source: "cms", items: [] }, url), null, "deactivated → page hidden");
  assert.equal(resolveOurStory({ source: "cms", items: [{ payload: { hero: {} } }] }, url)?.why?.title, "Why We Started", "invalid stored content → default");
  console.log("   ✓ image URL and focal point, automatic renumbering, optional fields, sections on/off, default/deactivated/invalid");
}

console.log("4. CMS workflow and media protection...");
await (async () => {
  assert.ok(CMS_MODULES.some((m) => m.id === "our-story"), "registered");
  assert.equal(getCmsModule("our-story")?.kind, "singleton");
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  const shown = async () => resolveOurStory(resolvePublished(await listEntries(repo, OUR_STORY_MODULE), [D], new Date()), url);

  assert.equal((await shown())?.journey?.steps.length, 5, "nothing saved: default");
  const p = clone();
  p.journey.heading = "Draft heading";
  p.journey.steps[0].image = { key: IMG, alt: "Research", focal: { x: 50, y: 50 } };
  const draft = await createEntry(ctx, OUR_STORY_MODULE, { draft: p });
  assert.equal((await shown())?.journey?.heading, D.journey.heading, "a draft never changes the website");
  await assert.rejects(() => createEntry(ctx, OUR_STORY_MODULE, { draft: D }), (e: unknown) => e instanceof ConflictError, "one record only");
  await assert.rejects(() => saveDraft(ctx, OUR_STORY_MODULE, draft.id, { ...p, journey: { ...p.journey, steps: [] } }, draft.version), (e: unknown) => e instanceof ValidationError, "server validates");
  assert.ok((await findUsage(repo, IMG, CMS_MODULES)).some((u) => u.id === "our-story/main"), "draft image protected in the Media Library");
  const pub = await publishEntry(ctx, OUR_STORY_MODULE, draft.id, draft.version);
  const live = (await shown())!;
  assert.deepEqual([live.journey?.heading, live.journey?.steps[0].image?.src], ["Draft heading", `/media/${IMG}`]);
  await unpublishEntry(ctx, OUR_STORY_MODULE, pub.id, pub.version);
  assert.equal(await shown(), null, "deactivated");
  console.log("   ✓ default until published, drafts private, one record, validation, media protection, publish, deactivate");
})();

console.log("--- Our Story tests passed ---");
