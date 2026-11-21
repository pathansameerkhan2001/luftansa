/**
 * Phase 3B, Checkpoint B: Announcement Bar module.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { Repository, ConflictError, ValidationError } from "@/lib/db/repository";
import { AuditService } from "@/lib/db/audit";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry, updateSettings } from "@/lib/cms/service";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, cmsFollowUpTag, cmsTag, getCmsModule } from "@/lib/cms/registry";
import { isoToLocalInput, localInputToIso } from "@/lib/cms/fields";
import { CMS_FOLLOW_UP_REVALIDATE_MS, cmsCacheTags, revalidateAfterCmsWrite } from "@/lib/cms/revalidation";
import { HERO_MODULE } from "@/lib/cms/modules/hero";
import {
  ANNOUNCEMENT_FALLBACK,
  ANNOUNCEMENT_MAX_MESSAGES,
  ANNOUNCEMENT_MODULE,
  announcementPayloadSchema,
  isMessageActive,
  resolveAnnouncementView,
  scheduleState,
  type AnnouncementPayload,
  type AnnouncementPayloadInput,
} from "@/lib/cms/modules/announcement-bar";

console.log("--- Testing Phase 3B Checkpoint B: Announcement Bar ---");

const ACTOR = "admin@luftansa.local";
function services(start = "2026-11-19T10:00:00.000Z") {
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, "luftansa-test");
  const now = new Date(start);
  const clock = () => now;
  const audit = new AuditService(repo, clock);
  return { repo, ctx: { repo, audit, actorEmail: ACTOR, now: clock } };
}

const parse = (input: unknown) => announcementPayloadSchema.safeParse(input);
const msg = (id: string, extra: Record<string, unknown> = {}) => ({ id, highlight: `Message ${id}`, ...extra });
const firstIssue = (input: unknown) => {
  const r = parse(input);
  assert.equal(r.success, false, `expected invalid: ${JSON.stringify(input)}`);
  return r.error!.issues[0];
};

/* ------------------------------------------------------------------------- */
console.log("1. Approved fallback replaces the unverified reviews claim...");
{
  assert.ok(parse(ANNOUNCEMENT_FALLBACK).success, "fallback satisfies the schema");
  const [m] = ANNOUNCEMENT_FALLBACK.messages;
  assert.equal(ANNOUNCEMENT_FALLBACK.messages.length, 1);
  assert.equal(`${m.highlight} — ${m.cta?.label}`, "Signature Perfumes from ₹400 — Explore the Collection", "exact approved wording");
  assert.equal(m.cta?.href, "/#personality-collection", "links to the existing collection anchor");
  assert.equal(ANNOUNCEMENT_FALLBACK.display, "ticker", "keeps today's scrolling display");

  // No trace of the old claim or the broken link in the storefront header code.
  const root = path.join(import.meta.dirname ?? __dirname, "..", "src", "components", "header");
  for (const file of ["nav-config.ts", "AnnouncementBar.tsx", "AnnouncementMessage.tsx", "AnnouncementTicker.tsx"]) {
    const src = readFileSync(path.join(root, file), "utf8");
    assert.ok(!/Verified Reviews|See All Reviews|["'`]\/reviews/.test(src), `${file} has no reviews claim or /reviews link`);
    assert.ok(!/\bStar\b/.test(src), `${file} no longer uses a rating star`);
  }
  console.log("   ✓ fallback is Option A; reviews claim, /reviews link and star icon are gone");
}

/* ------------------------------------------------------------------------- */
console.log("2. Message validation (same rules in the editor and on the server)...");
{
  const ok = parse({ messages: [msg("aaaa")] });
  assert.ok(ok.success);
  assert.equal(ok.data!.display, "ticker", "ticker is the default display");
  assert.deepEqual([ok.data!.messages[0].desktop, ok.data!.messages[0].mobile], [true, true], "visible on both devices by default");
  assert.equal(ok.data!.messages[0].cta, undefined);

  assert.ok(parse({ display: "static", messages: [msg("aaaa", { cta: { label: "Shop", href: "https://example.com/x" } })] }).success, "https CTA allowed");
  assert.equal(parse({ messages: [msg("aaaa", { cta: { label: "", href: "" } })] }).data?.messages[0].cta, undefined, "empty button fields mean no button");

  assert.match(firstIssue({ messages: [] }).message, /at least one/);
  assert.match(firstIssue({ messages: [msg("aaaa", { highlight: "   " })] }).message, /Enter the message/);
  assert.match(firstIssue({ messages: [msg("aaaa", { highlight: "x".repeat(91) })] }).message, /90 characters/);
  assert.match(firstIssue({ messages: [msg("aaaa", { cta: { label: "Go", href: "" } })] }).message, /destination/);
  assert.match(firstIssue({ messages: [msg("aaaa", { cta: { label: "", href: "/shop" } })] }).message, /button label/);
  for (const href of ["javascript:alert(1)", "//evil.example", "http://example.com", "data:text/html,x", "/a b"]) {
    assert.equal(parse({ messages: [msg("aaaa", { cta: { label: "Go", href } })] }).success, false, `rejects ${href}`);
  }
  const badSchedule = firstIssue({ messages: [msg("aaaa", { startAt: "2026-12-02T00:00:00.000Z", endAt: "2026-12-01T00:00:00.000Z" })] });
  assert.match(badSchedule.message, /end must be after/);
  assert.deepEqual(badSchedule.path, ["messages", 0, "endAt"]);
  assert.equal(parse({ messages: [msg("aaaa", { startAt: "next week" })] }).success, false, "dates must be ISO instants");
  assert.match(firstIssue({ messages: [msg("aaaa", { desktop: false, mobile: false })] }).message, /desktops, phones or both/);
  assert.match(firstIssue({ messages: [msg("aaaa"), msg("aaaa")] }).message, /unique/);
  assert.equal(parse({ messages: Array.from({ length: ANNOUNCEMENT_MAX_MESSAGES + 1 }, (_, i) => msg(`m${String(i).padStart(3, "0")}`)) }).success, false, "message limit");
  assert.equal(parse({ display: "marquee", messages: [msg("aaaa")] }).success, false, "unknown display mode");
  assert.equal(parse({ messages: [msg("aaaa", { rating: 5 })] }).success, false, "unknown fields rejected");
  assert.equal(parse({ messages: [msg("AB")] }).success, false, "invalid message id");
  console.log("   ✓ text, button, link safety, schedule, devices, limits");
}

/* ------------------------------------------------------------------------- */
console.log("3. Schedule and device resolution...");
{
  const payload: AnnouncementPayload = announcementPayloadSchema.parse({
    display: "ticker",
    messages: [
      msg("always"),
      msg("future", { startAt: "2026-12-01T00:00:00.000Z" }),
      msg("window", { startAt: "2026-11-19T00:00:00.000Z", endAt: "2026-11-20T00:00:00.000Z" }),
      msg("past", { endAt: "2026-11-01T00:00:00.000Z" }),
      msg("desk", { mobile: false }),
      msg("phone", { desktop: false }),
    ],
  } satisfies AnnouncementPayloadInput);
  const at = (iso: string) => new Date(iso);

  assert.equal(scheduleState(payload.messages[0], at("2026-11-19T12:00:00Z")), "always");
  assert.equal(scheduleState(payload.messages[1], at("2026-11-19T12:00:00Z")), "scheduled");
  assert.equal(scheduleState(payload.messages[2], at("2026-11-19T12:00:00Z")), "running");
  assert.equal(scheduleState(payload.messages[3], at("2026-11-19T12:00:00Z")), "ended");
  assert.ok(isMessageActive(payload.messages[2], at("2026-11-19T00:00:00.000Z")), "start is inclusive");
  assert.ok(!isMessageActive(payload.messages[2], at("2026-11-20T00:00:00.000Z")), "end is exclusive");

  let view = resolveAnnouncementView(payload, at("2026-11-19T12:00:00Z"));
  assert.deepEqual(view.desktop.map((m) => m.id), ["always", "window", "desk"], "desktop: running messages in order");
  assert.deepEqual(view.mobile.map((m) => m.id), ["always", "window", "phone"], "mobile: running messages in order");
  assert.ok(!("startAt" in view.desktop[1]), "schedule details are not sent to the page");

  view = resolveAnnouncementView(payload, at("2026-12-05T00:00:00Z"));
  assert.deepEqual(view.desktop.map((m) => m.id), ["always", "future", "desk"], "a scheduled message starts on time");

  view = resolveAnnouncementView(payload, at("2026-11-19T12:00:00Z"), { desktop: true, mobile: false });
  assert.deepEqual(view.mobile, [], "bar hidden on phones (bar visibility)");
  assert.equal(view.desktop.length, 3);

  const onlyFuture = announcementPayloadSchema.parse({ display: "static", messages: [msg("later", { startAt: "2027-01-01T00:00:00.000Z" })] });
  view = resolveAnnouncementView(onlyFuture, at("2026-11-19T12:00:00Z"));
  assert.deepEqual([view.desktop, view.mobile], [[], []], "nothing running: no bar (never an empty black strip)");
  assert.equal(view.display, "static");
  console.log("   ✓ start/end, order, per-message devices, bar visibility");
}

/* ------------------------------------------------------------------------- */
console.log("4. Admin date inputs round-trip...");
{
  const iso = localInputToIso("2026-12-01T09:30");
  assert.ok(iso && iso.endsWith("Z"), "stored as an ISO instant");
  assert.equal(isoToLocalInput(iso), "2026-12-01T09:30", "shown back exactly as typed");
  assert.equal(localInputToIso(""), undefined);
  assert.equal(localInputToIso("not a date"), undefined);
  assert.equal(isoToLocalInput(undefined), "");
  assert.ok(parse({ messages: [msg("aaaa", { startAt: iso })] }).success, "accepted by the schema");
  console.log("   ✓ datetime-local <-> ISO");
}

/* ------------------------------------------------------------------------- */
console.log("5. Registered module and publishing workflow...");
{
  assert.ok(CMS_MODULES.some((m) => m.id === "announcement-bar"), "registered");
  assert.equal(getCmsModule("announcement-bar")?.label, ANNOUNCEMENT_MODULE.label);
  assert.equal(ANNOUNCEMENT_MODULE.kind, "singleton");

  const { repo, ctx } = services();
  const now = new Date("2026-11-19T12:00:00.000Z");
  const live = async () => resolvePublished<AnnouncementPayload>(await listEntries(repo, ANNOUNCEMENT_MODULE), [ANNOUNCEMENT_FALLBACK], now);

  // Nothing saved: the approved default.
  let r = await live();
  assert.equal(r.source, "fallback");
  assert.deepEqual(r.items[0].payload, ANNOUNCEMENT_FALLBACK);

  // Server refuses invalid content.
  await assert.rejects(
    () => createEntry(ctx, ANNOUNCEMENT_MODULE, { draft: { messages: [msg("aaaa", { cta: { label: "x", href: "javascript:alert(1)" } })] } }),
    (e: unknown) => e instanceof ValidationError && e.issues.some((i) => i.path === "draft.messages.0.cta.href"),
  );

  // A draft (several messages) does not change the live bar.
  const draft = { display: "ticker", messages: [msg("aaaa"), msg("bbbb", { cta: { label: "Shop", href: "/#personality-collection" } }), msg("cccc")] };
  const created = await createEntry(ctx, ANNOUNCEMENT_MODULE, { draft });
  assert.equal(created.id, "main");
  r = await live();
  assert.equal(r.source, "fallback", "saving a draft keeps the default bar");
  await assert.rejects(() => createEntry(ctx, ANNOUNCEMENT_MODULE, { draft }), (e: unknown) => e instanceof ConflictError, "one bar only");

  // Publish: the website shows the draft.
  const published = await publishEntry(ctx, ANNOUNCEMENT_MODULE, "main", created.version);
  r = await live();
  assert.equal(r.source, "cms");
  assert.deepEqual((r.items[0].payload as AnnouncementPayload).messages.map((m) => m.id), ["aaaa", "bbbb", "cccc"]);

  // Reorder + delete in the draft: live order unchanged until published again.
  const edited = await saveDraft(ctx, ANNOUNCEMENT_MODULE, "main", { display: "static", messages: [msg("cccc"), msg("aaaa")] }, published.version);
  assert.equal(edited.hasUnpublishedChanges, true);
  r = await live();
  assert.deepEqual((r.items[0].payload as AnnouncementPayload).messages.map((m) => m.id), ["aaaa", "bbbb", "cccc"], "draft reorder/delete is not live yet");

  // A stale version is refused (no silent overwrite).
  await assert.rejects(() => saveDraft(ctx, ANNOUNCEMENT_MODULE, "main", draft, published.version), (e: unknown) => e instanceof ConflictError);
  await assert.rejects(() => publishEntry(ctx, ANNOUNCEMENT_MODULE, "main", published.version), (e: unknown) => e instanceof ConflictError);

  const republished = await publishEntry(ctx, ANNOUNCEMENT_MODULE, "main", edited.version);
  r = await live();
  const livePayload = r.items[0].payload as AnnouncementPayload;
  assert.deepEqual(livePayload.messages.map((m) => m.id), ["cccc", "aaaa"], "new order and deletion are live after publishing");
  assert.equal(livePayload.display, "static");

  // Bar visibility applies immediately.
  const hidden = await updateSettings(ctx, ANNOUNCEMENT_MODULE, "main", { visibility: { desktop: true, mobile: false } }, republished.version);
  r = await live();
  assert.deepEqual(r.items[0].visibility, { desktop: true, mobile: false });
  assert.deepEqual(resolveAnnouncementView(r.items[0].payload as AnnouncementPayload, now, r.items[0].visibility).mobile, []);

  // Deactivate: no bar at all (never the old default).
  await unpublishEntry(ctx, ANNOUNCEMENT_MODULE, "main", hidden.version);
  r = await live();
  assert.equal(r.source, "cms");
  assert.deepEqual(r.items, [], "deactivated bar stays hidden");


  // Database unavailable: the approved default.
  r = resolvePublished<AnnouncementPayload>(null, [ANNOUNCEMENT_FALLBACK], now);
  assert.equal(r.source, "fallback");
  assert.equal(r.items[0].payload.messages[0].highlight, "Signature Perfumes from ₹400");
  console.log("   ✓ draft safety, publish, reorder/delete via publish, version checks, visibility, deactivate, fallback");
}

/* ------------------------------------------------------------------------- */
console.log("6. Storefront revalidation after CMS writes (stale-content fix, Hero + Announcement Bar)...");
{
  for (const moduleId of [HERO_MODULE.id, ANNOUNCEMENT_MODULE.id]) {
    const revalidated: string[] = [];
    const scheduled: (() => Promise<void>)[] = [];
    const slept: number[] = [];
    revalidateAfterCmsWrite(moduleId, {
      revalidateTag: (tag) => revalidated.push(tag),
      after: (task) => scheduled.push(task),
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    assert.deepEqual(revalidated, [cmsTag(moduleId)], `${moduleId}: revalidated immediately`);
    assert.equal(scheduled.length, 1, `${moduleId}: exactly one follow-up scheduled after the response`);
    await scheduled[0]();
    assert.deepEqual(slept, [CMS_FOLLOW_UP_REVALIDATE_MS], `${moduleId}: follow-up waits for in-flight regenerations`);
    assert.deepEqual(revalidated, [cmsTag(moduleId), cmsFollowUpTag(moduleId)], `${moduleId}: follow-up revalidates the second tag`);
    assert.notEqual(cmsFollowUpTag(moduleId), cmsTag(moduleId), "distinct tag (Next.js ignores a repeat of the same tag in one request)");
    assert.deepEqual(cmsCacheTags(moduleId), [cmsTag(moduleId), cmsFollowUpTag(moduleId)], `${moduleId}: cached content carries both tags`);
  }
  assert.ok(CMS_FOLLOW_UP_REVALIDATE_MS >= 5_000, "follow-up comes well after a page render (0.1-0.3 s measured locally)");

  // Failures never break the admin's save.
  const errors: string[] = [];
  assert.doesNotThrow(() =>
    revalidateAfterCmsWrite(ANNOUNCEMENT_MODULE.id, {
      revalidateTag: () => {
        throw new Error("cache unavailable");
      },
      after: () => {
        throw new Error("outside a request");
      },
      logError: (m) => errors.push(m),
    }),
  );
  assert.equal(errors.length, 2, "both failures are logged");
  console.log("   ✓ immediate + follow-up revalidation, distinct tag, both modules, never throws");
}

console.log("--- Announcement Bar tests passed ---");
