import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { isLocalUrl, LocalSafetyError, runtimeMode } from "@/lib/runtime/mode";
import { resolveDbTarget } from "@/lib/db/target";
import { getDataServices } from "@/lib/db/client";
import { getS3Client } from "@/lib/s3/client";
import { getAssetUrl } from "@/lib/assets";
import { assertAuthEndpointsForRuntime, AuthConfigError } from "@/lib/auth/config";
import { parseRange } from "@/lib/media/range";
import { serveMedia } from "@/lib/media/serve";
import { getMediaStorage, LocalMediaStorage, type MediaStorage } from "@/lib/media/storage";
import { checkUpload, cleanFilename, libraryObjectKey, sniffMatchesType } from "@/lib/media/upload-rules";
import { Repository, ConflictError, ValidationError } from "@/lib/db/repository";
import { AuditService } from "@/lib/db/audit";
import { auditEntrySchema, productItemSchema } from "@/lib/db/schemas";
import { keys } from "@/lib/db/keys";
import {
  createEntry, deleteEntry, listEntries, publishEntry, reorderEntries, saveDraft, unpublishEntry, updateSettings,
} from "@/lib/cms/service";
import { resolvePublished, selectPublished } from "@/lib/cms/published";
import { getCmsModule } from "@/lib/cms/registry";
import type { CmsModuleDefinition } from "@/lib/cms/schemas";
import {
  cancelDeletion, confirmDeletion, findUsage, listMedia, listUncataloguedProductImages, MediaInUseError, registerMedia, requestDeletion, updateMediaMeta,
} from "@/lib/media/library";
import { applyCatalogueImport, planCatalogueImport, resolveImportMode, UnauthorizedActorError } from "@/lib/catalogue/import-catalogue";

console.log("--- Testing Phase 3A: production safety, media and CMS foundation ---");

const TABLE = "luftansa-test";
const ACTOR = "admin@luftansa.local";

function fixtureServices(start = "2026-11-16T10:00:00.000Z") {
  const client = new InMemoryDynamoClient();
  const repo = new Repository(client as unknown as DynamoDBDocumentClient, TABLE);
  let now = new Date(start);
  const clock = () => now;
  const audit = new AuditService(repo, clock);
  return { client, repo, audit, clock, setNow: (iso: string) => (now = new Date(iso)), ctx: { repo, audit, actorEmail: ACTOR, now: clock } };
}

async function expectRejects(fn: () => Promise<unknown>, type: new (...a: never[]) => Error, label: string) {
  await assert.rejects(fn, (e: unknown) => e instanceof type, label);
}

/* ------------------------------------------------------------------------- */
console.log("1. Runtime mode: production only on Vercel production builds...");
{
  assert.equal(runtimeMode({ VERCEL: "1", NODE_ENV: "production" }), "production");
  assert.equal(runtimeMode({ NODE_ENV: "production" }), "local", "next build/start on a laptop is local");
  assert.equal(runtimeMode({ VERCEL: "1", NODE_ENV: "development" }), "local", "vercel dev is local");
  assert.equal(runtimeMode({}), "local");
  assert.equal(runtimeMode(process.env), "local", "this test process is local");
  assert.ok(isLocalUrl("http://127.0.0.1:8000") && isLocalUrl("http://localhost:4010"));
  assert.ok(!isLocalUrl("https://dynamodb.ap-south-2.amazonaws.com") && !isLocalUrl("http://localhost.evil.com") && !isLocalUrl(undefined));
  console.log("   ✓ Runtime mode verified");
}

console.log("2. DynamoDB: local runtime can never reach production...");
{
  const prodKeys = { AWS_ACCESS_KEY_ID: "AKIAEXAMPLEEXAMPLE", AWS_SECRET_ACCESS_KEY: "secret-example" };
  assert.equal(resolveDbTarget({ ...prodKeys }).kind, "disabled", "no endpoint: database disabled (fallback catalogue)");
  const local = resolveDbTarget({ ...prodKeys, DYNAMODB_ENDPOINT: "http://127.0.0.1:8000" });
  assert.equal(local.kind, "local");
  if (local.kind === "local") {
    assert.deepEqual(local.credentials, { accessKeyId: "local", secretAccessKey: "local" }, "dummy credentials, never the env AWS keys");
  }
  assert.throws(() => resolveDbTarget({ DYNAMODB_ENDPOINT: "https://dynamodb.ap-south-2.amazonaws.com" }), LocalSafetyError);
  assert.equal(resolveDbTarget({ VERCEL: "1", NODE_ENV: "production", DYNAMODB_ENDPOINT: "http://127.0.0.1:8000" }).kind, "production");
  const saved = process.env.DYNAMODB_ENDPOINT;
  delete process.env.DYNAMODB_ENDPOINT;
  assert.equal(getDataServices(), null, "app data services are unavailable locally without DynamoDB Local");
  if (saved !== undefined) process.env.DYNAMODB_ENDPOINT = saved;
  console.log("   ✓ DynamoDB production-write guard verified");
}

console.log("3. S3 and CDN: unusable outside production...");
{
  assert.throws(() => getS3Client(), LocalSafetyError, "S3 client refuses to exist locally");
  const savedCdn = process.env.ASSET_CDN_URL;
  process.env.ASSET_CDN_URL = "https://cdn.example.com";
  assert.equal(getAssetUrl("products/a.jpg"), "/media/products/a.jpg", "CDN ignored locally");
  if (savedCdn === undefined) delete process.env.ASSET_CDN_URL;
  else process.env.ASSET_CDN_URL = savedCdn;
  const savedDir = process.env.LOCAL_MEDIA_DIR;
  delete process.env.LOCAL_MEDIA_DIR;
  assert.equal(getMediaStorage(), null, "no local media folder: no storage (never S3)");
  if (savedDir !== undefined) process.env.LOCAL_MEDIA_DIR = savedDir;
  console.log("   ✓ S3 guard verified");
}

console.log("4. Mock admin sign-in can never be activated in production...");
{
  const local = { domain: "http://localhost:4010", issuer: "http://localhost:4010", redirectUri: "http://localhost:3000/api/auth/callback", logoutRedirectUri: "http://localhost:3000/admin/login" };
  assert.doesNotThrow(() => assertAuthEndpointsForRuntime(local, "local"));
  assert.throws(() => assertAuthEndpointsForRuntime(local, "production"), AuthConfigError);
  const prod = {
    domain: "https://luftansa.auth.ap-south-2.amazoncognito.com",
    issuer: "https://cognito-idp.ap-south-2.amazonaws.com/ap-south-2_Example1",
    redirectUri: "https://luftansa.vercel.app/api/auth/callback",
    logoutRedirectUri: "https://luftansa.vercel.app/admin/login",
  };
  assert.doesNotThrow(() => assertAuthEndpointsForRuntime(prod, "production"), "real Cognito configuration is unaffected");
  assert.throws(() => assertAuthEndpointsForRuntime({ ...prod, issuer: "https://evil.example.com" }, "production"), AuthConfigError);
  assert.throws(() => assertAuthEndpointsForRuntime({ ...prod, issuer: "http://localhost:4010" }, "production"), AuthConfigError);
  assert.throws(() => assertAuthEndpointsForRuntime({ ...prod, domain: "http://localhost:4010" }, "production"), AuthConfigError);
  console.log("   ✓ Auth production guard verified");
}

console.log("5. HTTP Range parsing (Safari video)...");
{
  assert.deepEqual(parseRange(null, 100), { kind: "none" });
  assert.deepEqual(parseRange("bytes=0-1", 100), { kind: "range", range: { start: 0, end: 1 } }, "Safari probe");
  assert.deepEqual(parseRange("bytes=10-", 100), { kind: "range", range: { start: 10, end: 99 } });
  assert.deepEqual(parseRange("bytes=-10", 100), { kind: "range", range: { start: 90, end: 99 } });
  assert.deepEqual(parseRange("bytes=-500", 100), { kind: "range", range: { start: 0, end: 99 } });
  assert.deepEqual(parseRange("bytes=50-5000", 100), { kind: "range", range: { start: 50, end: 99 } });
  assert.deepEqual(parseRange("bytes=100-", 100), { kind: "unsatisfiable" });
  assert.deepEqual(parseRange("bytes=-0", 100), { kind: "unsatisfiable" });
  assert.deepEqual(parseRange("bytes=0-1,5-9", 100), { kind: "none" }, "multi-range served whole");
  assert.deepEqual(parseRange("items=0-1", 100), { kind: "none" });
  assert.deepEqual(parseRange("bytes=9-3", 100), { kind: "none" });
  assert.deepEqual(parseRange("bytes=abc", 100), { kind: "none" });
  console.log("   ✓ Range parsing verified");
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "luftansa-media-"));
try {
  console.log("6. /media serving: 200, 206, 416, 304, HEAD, 404...");
  {
    const storage = new LocalMediaStorage(tmp);
    const body = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
    await mkdir(path.join(tmp, "videos", "2026-11"), { recursive: true });
    await writeFile(path.join(tmp, "videos", "2026-11", "clip.mp4"), body);
    const url = "http://localhost/media/videos/2026-11/clip.mp4";
    const key = "videos/2026-11/clip.mp4";
    const get = (headers: Record<string, string> = {}, method = "GET") => serveMedia(new Request(url, { method, headers }), key, storage);

    const full = await get();
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(full.headers.get("content-type"), "video/mp4");
    assert.equal((await full.arrayBuffer()).byteLength, 1000);

    const probe = await get({ Range: "bytes=0-1" });
    assert.equal(probe.status, 206, "Safari's bytes=0-1 probe gets 206");
    assert.equal(probe.headers.get("content-range"), "bytes 0-1/1000");
    assert.equal(probe.headers.get("content-length"), "2");
    assert.deepEqual([...new Uint8Array(await probe.arrayBuffer())], [0, 1]);

    const mid = await get({ Range: "bytes=500-509" });
    assert.equal(mid.status, 206);
    assert.deepEqual([...new Uint8Array(await mid.arrayBuffer())], [...body.slice(500, 510)]);

    const tail = await get({ Range: "bytes=-4" });
    assert.equal(tail.headers.get("content-range"), "bytes 996-999/1000");
    assert.equal((await tail.arrayBuffer()).byteLength, 4);

    // Long ranges are served in capped, exactly-sized slices (Safari-friendly; serverless-safe).
    const capped = await serveMedia(new Request(url, { headers: { Range: "bytes=0-" } }), key, storage, { maxRangeBytes: 300 });
    assert.equal(capped.status, 206);
    assert.equal(capped.headers.get("content-range"), "bytes 0-299/1000");
    assert.equal(capped.headers.get("content-length"), "300");
    assert.deepEqual([...new Uint8Array(await capped.arrayBuffer())], [...body.slice(0, 300)]);
    const pieces: number[] = [];
    for (let start = 0; start < 1000; ) {
      const r = await serveMedia(new Request(url, { headers: { Range: `bytes=${start}-` } }), key, storage, { maxRangeBytes: 300 });
      const chunk = new Uint8Array(await r.arrayBuffer());
      pieces.push(...chunk);
      start += chunk.length;
    }
    assert.deepEqual(pieces, [...body], "sequential capped ranges reassemble the exact file");

    const bad = await get({ Range: "bytes=5000-" });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers.get("content-range"), "bytes */1000");

    const etag = full.headers.get("etag")!;
    assert.ok(etag);
    assert.equal((await get({ "If-None-Match": etag })).status, 304);
    assert.equal((await get({ Range: "bytes=0-1", "If-Range": '"stale"' })).status, 200, "stale If-Range serves the full object");

    const head = await get({}, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "1000");
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal((await get({ Range: "bytes=0-9" }, "HEAD")).status, 206);

    assert.equal((await serveMedia(new Request(url), "videos/2026-11/missing.mp4", storage)).status, 404);
    assert.equal((await serveMedia(new Request(url), "secrets/.env", storage)).status, 404, "non allow-listed folder");
    assert.equal((await serveMedia(new Request(url), "videos/../../etc/passwd", storage)).status, 404, "traversal");
    assert.equal((await serveMedia(new Request(url), key, null)).status, 404, "no storage configured");
    assert.equal((await serveMedia(new Request(url, { method: "POST" }), key, storage)).status, 405);
    console.log("   ✓ /media Range support verified");
  }

  console.log("7. Local media storage: confined to its folder, never overwrites...");
  {
    const local = new LocalMediaStorage(tmp);
    const storage: MediaStorage = local; // exercised through the shared interface
    assert.throws(() => local.resolve("general/../../outside.jpg"));
    assert.throws(() => local.resolve("not-allowed/x.jpg"));
    const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    await storage.write("general/2026-11/a.jpg", jpg, "image/jpeg");
    assert.deepEqual([...(await readFile(path.join(tmp, "general", "2026-11", "a.jpg")))], [...jpg]);
    await assert.rejects(() => storage.write("general/2026-11/a.jpg", jpg, "image/jpeg"), "existing objects are never overwritten");
    assert.equal(storage.kind, "local");
    console.log("   ✓ Local storage verified");
  }

  console.log("8. Upload validation: type, size and real file contents...");
  {
    const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const mp4 = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBP");
    assert.ok(sniffMatchesType(jpg, "image/jpeg") && sniffMatchesType(png, "image/png") && sniffMatchesType(webp, "image/webp"));
    assert.ok(sniffMatchesType(mp4, "video/mp4") && sniffMatchesType(webm, "video/webm"));
    assert.ok(!sniffMatchesType(png, "image/jpeg"), "renamed file rejected");
    assert.deepEqual(checkUpload({ type: "image/jpeg", size: 1000 }, jpg), { ok: true, kind: "image" });
    assert.deepEqual(checkUpload({ type: "video/mp4", size: 1000 }, mp4), { ok: true, kind: "video" });
    assert.equal((checkUpload({ type: "image/gif", size: 10 }, jpg) as { error: string }).error, "invalid_content_type");
    assert.equal((checkUpload({ type: "image/svg+xml", size: 10 }, jpg) as { error: string }).error, "invalid_content_type", "SVG (script-capable) rejected");
    assert.equal((checkUpload({ type: "image/jpeg", size: 5 * 1024 * 1024 }, jpg) as { status: number }).status, 413);
    assert.equal((checkUpload({ type: "image/jpeg", size: 0 }, jpg) as { error: string }).error, "empty_file");
    assert.equal((checkUpload({ type: "image/jpeg", size: 100 }, png) as { error: string }).error, "content_mismatch");
    assert.equal(cleanFilename("../../My Photo (1).JPG"), "my-photo-1-.jpg");
    assert.equal(libraryObjectKey("lab", "Lab Shot.png", new Date("2026-11-16T00:00:00Z")), "lab/2026-11/1794787200000-lab-shot.png");
    console.log("   ✓ Upload validation verified");
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ CMS --- */
const fixtureModule: CmsModuleDefinition = {
  id: "fixture-banner",
  label: "Fixture banner",
  kind: "list",
  payload: z.object({ text: z.string().min(1).max(80), href: z.string().startsWith("/").optional(), image: z.string().optional() }),
};
const fixtureSingleton: CmsModuleDefinition = { id: "fixture-hero", label: "Fixture hero", kind: "singleton", payload: z.object({ title: z.string().min(1) }) };

console.log("9. CMS: drafts, publishing, versions and audit...");
{
  const { repo, ctx, client } = fixtureServices();
  const a = await createEntry(ctx, fixtureModule, { draft: { text: "First" } });
  assert.equal(a.status, "DRAFT");
  assert.equal(a.published, undefined);
  assert.equal(a.pk, "CONTENT#fixture-banner");
  assert.ok(a.sk.startsWith("ENTRY#"));
  await expectRejects(() => createEntry(ctx, fixtureModule, { draft: { text: "" } }), ValidationError, "payload validated");

  const pub = await publishEntry(ctx, fixtureModule, a.id, a.version);
  assert.equal(pub.status, "PUBLISHED");
  assert.deepEqual(pub.published, { text: "First" });
  assert.equal(pub.hasUnpublishedChanges, false);

  const edited = await saveDraft(ctx, fixtureModule, a.id, { text: "Second" }, pub.version);
  assert.deepEqual(edited.published, { text: "First" }, "saving a draft never changes the live content");
  assert.equal(edited.hasUnpublishedChanges, true);
  await expectRejects(() => saveDraft(ctx, fixtureModule, a.id, { text: "Stale" }, pub.version), ConflictError, "stale version rejected");

  const republished = await publishEntry(ctx, fixtureModule, a.id, edited.version);
  assert.deepEqual(republished.published, { text: "Second" });
  const un = await unpublishEntry(ctx, fixtureModule, a.id, republished.version);
  assert.equal(un.status, "UNPUBLISHED");
  assert.equal(un.published, undefined);
  assert.deepEqual(un.draft, { text: "Second" }, "draft kept after unpublishing");

  const audits = client.dump(TABLE).filter((i) => String(i.pk).startsWith("AUDIT#")).map((i) => auditEntrySchema.parse(i));
  assert.deepEqual(audits.map((x) => x.action).sort(), ["cms.create", "cms.publish", "cms.publish", "cms.save_draft", "cms.unpublish"].sort());
  assert.ok(audits.every((x) => x.actorEmail === ACTOR && x.targetId === `fixture-banner/${a.id}`));

  const s = await createEntry(ctx, fixtureSingleton, { draft: { title: "Hero" } });
  assert.equal(s.id, "main");
  await expectRejects(() => createEntry(ctx, fixtureSingleton, { draft: { title: "Again" } }), ConflictError, "singleton is unique");
  assert.equal((await repo.get(keys.contentEntry("fixture-hero", "main"), (await import("@/lib/cms/schemas")).contentEntrySchema))?.id, "main");
  console.log("   ✓ Draft/publish workflow verified");
}

console.log("10. CMS: ordering, settings, schedule, delete...");
{
  const { ctx } = fixtureServices();
  const e1 = await createEntry(ctx, fixtureModule, { id: "one", draft: { text: "One" } });
  const e2 = await createEntry(ctx, fixtureModule, { id: "two", draft: { text: "Two" } });
  const e3 = await createEntry(ctx, fixtureModule, { id: "three", draft: { text: "Three" } });
  assert.deepEqual((await listEntries(ctx.repo, fixtureModule)).map((e) => e.id), ["one", "two", "three"]);
  await reorderEntries(ctx, fixtureModule, [{ id: "three", version: e3.version }, { id: "one", version: e1.version }, { id: "two", version: e2.version }]);
  assert.deepEqual((await listEntries(ctx.repo, fixtureModule)).map((e) => e.id), ["three", "one", "two"]);
  await expectRejects(() => reorderEntries(ctx, fixtureModule, [{ id: "one", version: 1 }]), ValidationError, "order must list every entry");
  await expectRejects(
    () => reorderEntries(ctx, fixtureModule, [{ id: "three", version: 1 }, { id: "one", version: 2 }, { id: "two", version: 2 }]),
    ConflictError,
    "reorder is atomic and version-checked",
  );
  assert.deepEqual((await listEntries(ctx.repo, fixtureModule)).map((e) => e.id), ["three", "one", "two"], "failed reorder changed nothing");

  const current = (await listEntries(ctx.repo, fixtureModule)).find((e) => e.id === "two")!;
  const withSchedule = await updateSettings(ctx, fixtureModule, "two", { visibility: { desktop: true, mobile: false }, schedule: { startAt: "2026-12-01T00:00:00.000Z", endAt: "2026-12-31T00:00:00.000Z" } }, current.version);
  assert.deepEqual(withSchedule.visibility, { desktop: true, mobile: false });
  await expectRejects(
    () => updateSettings(ctx, fixtureModule, "two", { schedule: { startAt: "2026-12-31T00:00:00.000Z", endAt: "2026-12-01T00:00:00.000Z" } }, withSchedule.version),
    ValidationError,
    "end must be after start",
  );
  const cleared = await updateSettings(ctx, fixtureModule, "two", { schedule: null }, withSchedule.version);
  assert.equal(cleared.schedule, undefined);

  await expectRejects(() => deleteEntry(ctx, fixtureModule, "one", 99), ConflictError, "delete is version-checked");
  const one = (await listEntries(ctx.repo, fixtureModule)).find((e) => e.id === "one")!;
  await deleteEntry(ctx, fixtureModule, "one", one.version);
  assert.deepEqual((await listEntries(ctx.repo, fixtureModule)).map((e) => e.id), ["three", "two"]);
  console.log("   ✓ Ordering/settings/delete verified");
}

console.log("11. Storefront content: fallbacks and scheduling...");
{
  const { ctx } = fixtureServices();
  const fallback = [{ text: "Approved default" }];
  const now = new Date("2026-11-16T12:00:00.000Z");
  assert.deepEqual(resolvePublished(null, fallback, now).source, "fallback", "database unavailable: today's content");
  assert.deepEqual(resolvePublished([], fallback, now).items.map((i) => i.payload), fallback, "never configured: today's content");

  const live = await createEntry(ctx, fixtureModule, { id: "live", draft: { text: "Live" } });
  await publishEntry(ctx, fixtureModule, "live", live.version);
  const draftOnly = await createEntry(ctx, fixtureModule, { id: "draftonly", draft: { text: "Draft only" } });
  const future = await createEntry(ctx, fixtureModule, { id: "future", draft: { text: "Future" }, schedule: { startAt: "2026-12-01T00:00:00.000Z" } });
  await publishEntry(ctx, fixtureModule, "future", future.version);
  const expired = await createEntry(ctx, fixtureModule, { id: "expired", draft: { text: "Expired" }, schedule: { endAt: "2026-11-01T00:00:00.000Z" } });
  await publishEntry(ctx, fixtureModule, "expired", expired.version);
  void draftOnly;

  const entries = await listEntries(ctx.repo, fixtureModule);
  const result = resolvePublished<{ text: string }>(entries, fallback, now);
  assert.equal(result.source, "cms");
  assert.deepEqual(result.items.map((i) => i.payload.text), ["Live"], "only published, in-schedule entries; drafts never leak");
  assert.deepEqual(selectPublished<{ text: string }>(entries, new Date("2026-12-05T00:00:00.000Z")).map((i) => i.payload.text), ["Live", "Future"]);

  const liveEntry = entries.find((e) => e.id === "live")!;
  await unpublishEntry(ctx, fixtureModule, "live", liveEntry.version);
  const none = resolvePublished(await listEntries(ctx.repo, fixtureModule), fallback, now);
  assert.equal(none.source, "cms");
  assert.equal(none.items.length, 0, "deliberately unpublished: nothing shown (no silent fallback)");
  assert.equal(getCmsModule("fixture-banner"), undefined, "no modules are registered in Phase 3A");
  console.log("   ✓ Fallback rules verified");
}

/* ---------------------------------------------------------------- Media --- */
console.log("12. Media library: records, usage and two-step deletion...");
{
  const { repo, ctx, client } = fixtureServices();
  // Sanitized fixtures: the legacy catalogue in code (no production data).
  const plan = await planCatalogueImport(repo, "2026-11-16T00:00:00.000Z");
  await applyCatalogueImport(repo, ctx.audit, ACTOR, plan);

  const tmp2 = await mkdtemp(path.join(os.tmpdir(), "luftansa-lib-"));
  try {
    const storage: MediaStorage = new LocalMediaStorage(tmp2);
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9]);
    await storage.write("general/2026-11/one.jpg", bytes, "image/jpeg");
    await storage.write("products/black-velvet/main/2.jpg", bytes, "image/jpeg");

    const one = await registerMedia(ctx, { key: "general/2026-11/one.jpg", kind: "image", contentType: "image/jpeg", sizeBytes: 5, originalFilename: "one.jpg", folder: "general", width: 800, height: 600 });
    const prod = await registerMedia(ctx, { key: "products/black-velvet/main/2.jpg", kind: "image", contentType: "image/jpeg", sizeBytes: 5, originalFilename: "2.jpg", folder: "products/black-velvet/main" });
    assert.equal(one.GSI1PK, "MEDIA");
    assert.equal((await listMedia(repo)).length, 2);

    const withAlt = await updateMediaMeta(ctx, one.id, { alt: "Lab bench", description: "Fixture" }, one.version);
    assert.equal(withAlt.alt, "Lab bench");
    await expectRejects(() => updateMediaMeta(ctx, one.id, { alt: "x" }, one.version), ConflictError, "meta edit is version-checked");

    // Reference the product image from a product record (as the product editor does).
    const bv = (await repo.get(keys.product("black-velvet"), productItemSchema))!;
    await repo.replace({ ...bv, mainImageKey: "products/black-velvet/main/2.jpg" }, productItemSchema, bv.version);
    const usage = await findUsage(repo, prod.key, []);
    assert.deepEqual(usage.map((u) => [u.type, u.id, u.field]), [["product", "black-velvet", "Main image"]]);
    await expectRejects(() => requestDeletion(ctx, prod.id, prod.version, []), MediaInUseError, "in-use asset cannot be deleted");

    // CMS references count as usage too.
    const contentEntry = await createEntry(ctx, fixtureModule, { draft: { text: "Uses image", image: one.key } });
    assert.equal((await findUsage(repo, one.key, [fixtureModule]))[0].type, "content");
    await expectRejects(() => requestDeletion(ctx, one.id, withAlt.version, [fixtureModule]), MediaInUseError, "used by draft content");
    await deleteEntry(ctx, fixtureModule, contentEntry.id, contentEntry.version);

    const pending = await requestDeletion(ctx, one.id, withAlt.version, [fixtureModule]);
    assert.equal(pending.status, "PENDING_DELETION");
    assert.ok(await storage.head(one.key), "requesting deletion deletes nothing");
    const restored = await cancelDeletion(ctx, one.id, pending.version);
    assert.equal(restored.status, "ACTIVE");
    await expectRejects(() => confirmDeletion(ctx, storage, one.id, restored.version, []), ValidationError, "confirm requires a pending request");

    const pending2 = await requestDeletion(ctx, one.id, restored.version, []);
    await confirmDeletion(ctx, storage, one.id, pending2.version, []);
    assert.equal(await storage.head(one.key), null, "object removed only after explicit confirmation");
    assert.equal((await listMedia(repo)).length, 1);
    assert.ok(await storage.head(prod.key), "other assets untouched");

    const audit = client.dump(TABLE).filter((i) => String(i.pk).startsWith("AUDIT#")).map((i) => String(i.action));
    for (const a of ["media.upload", "media.update", "media.deletion_requested", "media.deletion_cancelled", "media.deleted"]) assert.ok(audit.includes(a), a);

    // Product images without a library record are still listed (nothing in use is invisible).
    const rizz = (await repo.get(keys.product("daily-rizz"), productItemSchema))!;
    await repo.replace({ ...rizz, mainImageKey: "products/daily-rizz/main/old.jpg" }, productItemSchema, rizz.version);
    const unc = await listUncataloguedProductImages(repo, await listMedia(repo));
    assert.deepEqual(unc.map((u) => u.key), ["products/daily-rizz/main/old.jpg"], "external (Unsplash) note URLs are not listed as bucket objects");
  } finally {
    await rm(tmp2, { recursive: true, force: true });
  }
  console.log("   ✓ Media library verified");
}

console.log("13. Catalogue import CLI: production writes need --apply AND --confirm-production-write...");
{
  const allow = "owner@luftansa.example, second@luftansa.example";
  const isUnauthorized = (e: unknown) => e instanceof UnauthorizedActorError;
  assert.deepEqual(resolveImportMode([], allow), { mode: "dry-run" }, "default is a read-only dry run");
  assert.deepEqual(resolveImportMode(["--actor", "owner@luftansa.example"], allow), { mode: "dry-run" });
  assert.throws(() => resolveImportMode(["--apply", "--actor", "owner@luftansa.example"], allow), isUnauthorized, "--apply alone is refused");
  assert.throws(() => resolveImportMode(["--confirm-production-write"], allow), isUnauthorized, "confirmation without --apply is refused");
  assert.deepEqual(
    resolveImportMode(["--apply", "--confirm-production-write", "--actor", " Owner@Luftansa.example "], allow),
    { mode: "apply", actor: "owner@luftansa.example" },
    "both flags + allow-listed actor (normalised) may write",
  );
  // The existing allow-list validation is retained:
  assert.throws(() => resolveImportMode(["--apply", "--confirm-production-write", "--actor", "intruder@example.com"], allow), isUnauthorized, "actor not on allow-list");
  assert.throws(() => resolveImportMode(["--apply", "--confirm-production-write"], allow), isUnauthorized, "actor required");
  assert.throws(() => resolveImportMode(["--apply", "--confirm-production-write", "--actor", "--other"], allow), isUnauthorized, "flag is not an actor");
  assert.throws(() => resolveImportMode(["--apply", "--confirm-production-write", "--actor", "owner@luftansa.example"], undefined), isUnauthorized, "allow-list required");
  assert.throws(() => resolveImportMode(["--apply", "--confirm-production-write", "--actor", "owner@luftansa.example"], "not-an-email"), isUnauthorized);
  console.log("   ✓ Import CLI write confirmation verified");
}

console.log("\n🎉 PHASE 3A CMS FOUNDATION TESTS PASSED SUCCESSFULLY!");
