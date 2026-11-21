import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// Loaded through the "@" alias so it shares one AWS SDK instance with the services under test.
import { InMemoryDynamoClient } from "@/../test/helpers/in-memory-dynamo";
import { resolvePublished } from "@/lib/cms/published";
import { CMS_MODULES, getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries, publishEntry, saveDraft, unpublishEntry } from "@/lib/cms/service";
import { TRUST_TAG_IDS, TRUST_TAGS_DEFAULT, TRUST_TAGS_MODULE, resolveTrustTags, toTrustTagsView, trustTagsPayloadSchema } from "@/lib/cms/modules/trust-tags";
import { AuditService } from "@/lib/db/audit";
import { ConflictError, Repository, ValidationError } from "@/lib/db/repository";

console.log("--- Testing Product Trust Tags ---");

const D = TRUST_TAGS_DEFAULT;
const withTags = (tags: unknown) => ({ tags });

console.log("1. Defaults: the five tags, all on, in the reference order...");
{
  assert.ok(trustTagsPayloadSchema.safeParse(D).success);
  assert.deepEqual(toTrustTagsView(D).map((t) => t.label), ["Lab Tested Longevity", "1200+ People Surveyed", "Made in India", "100% Vegan & Cruelty-free", "IFRA Safe Formula"]);
  assert.deepEqual(D.tags.map((t) => t.id), [...TRUST_TAG_IDS]);
  console.log("   ✓ five default tags enabled");
}

console.log("2. Validation...");
{
  const bad: [string, unknown][] = [
    ["empty label", withTags(D.tags.map((t, i) => (i === 0 ? { ...t, label: "  " } : t)))],
    ["long label", withTags(D.tags.map((t, i) => (i === 0 ? { ...t, label: "x".repeat(41) } : t)))],
    ["missing tag", withTags(D.tags.slice(1))],
    ["duplicate tag", withTags([...D.tags.slice(0, 4), D.tags[0]])],
    ["unknown tag id (no free-form icons)", withTags(D.tags.map((t, i) => (i === 0 ? { ...t, id: "free-shipping" } : t)))],
    ["unknown field (no markup)", withTags(D.tags.map((t, i) => (i === 0 ? { ...t, html: "<b>x</b>" } : t)))],
    ["unknown top-level field", { ...D, css: "x" }],
  ];
  for (const [label, p] of bad) assert.ok(!trustTagsPayloadSchema.safeParse(p).success, label);
  console.log("   ✓ labels required and short, every tag once, fixed set of tags, no extra fields");
}

console.log("3. Order, on/off, labels...");
{
  const reordered = trustTagsPayloadSchema.parse(withTags([D.tags[4], D.tags[0], { ...D.tags[1], enabled: false }, { ...D.tags[2], label: "Crafted in India" }, D.tags[3]]));
  assert.deepEqual(toTrustTagsView(reordered).map((t) => t.label), ["IFRA Safe Formula", "Lab Tested Longevity", "Crafted in India", "100% Vegan & Cruelty-free"]);
  assert.deepEqual(resolveTrustTags({ source: "fallback", items: [{ payload: D }] }).length, 5, "never published / database unavailable → defaults");
  assert.deepEqual(resolveTrustTags({ source: "cms", items: [] }), [], "deactivated → none");
  assert.equal(resolveTrustTags({ source: "cms", items: [{ payload: { tags: [] } }] }).length, 5, "invalid stored settings → defaults");
  console.log("   ✓ custom order, disabled tag hidden, edited label, default/deactivated/invalid");
}

console.log("4. CMS workflow...");
await (async () => {
  assert.ok(CMS_MODULES.some((m) => m.id === "trust-tags"), "registered");
  assert.equal(getCmsModule("trust-tags")?.kind, "singleton");
  const repo = new Repository(new InMemoryDynamoClient() as unknown as DynamoDBDocumentClient, "luftansa-test");
  const ctx = { repo, audit: new AuditService(repo), actorEmail: "admin@luftansa.local" };
  const shown = async () => resolveTrustTags(resolvePublished(await listEntries(repo, TRUST_TAGS_MODULE), [D], new Date())).map((t) => t.label);

  assert.equal((await shown()).length, 5, "nothing saved: defaults");
  const off = withTags(D.tags.map((t) => (t.id === "people-surveyed" ? { ...t, enabled: false } : t)));
  const draft = await createEntry(ctx, TRUST_TAGS_MODULE, { draft: off });
  assert.equal((await shown()).length, 5, "a draft never changes product pages");
  await assert.rejects(() => createEntry(ctx, TRUST_TAGS_MODULE, { draft: D }), (e: unknown) => e instanceof ConflictError, "one record only");
  await assert.rejects(() => saveDraft(ctx, TRUST_TAGS_MODULE, draft.id, withTags(D.tags.slice(1)), draft.version), (e: unknown) => e instanceof ValidationError, "server validates");
  const pub = await publishEntry(ctx, TRUST_TAGS_MODULE, draft.id, draft.version);
  assert.ok(!(await shown()).includes("1200+ People Surveyed"), "published: tag hidden");
  await unpublishEntry(ctx, TRUST_TAGS_MODULE, pub.id, pub.version);
  assert.deepEqual(await shown(), [], "deactivated: no tags");
  console.log("   ✓ defaults until published, drafts private, one record, validation, publish, deactivate");
})();

console.log("--- Product Trust Tags tests passed ---");
