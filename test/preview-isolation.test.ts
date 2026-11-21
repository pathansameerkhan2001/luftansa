import assert from "node:assert/strict";
import {
  deploymentEnv, PRODUCTION_DYNAMODB_TABLES, PRODUCTION_S3_BUCKETS, PreviewIsolationError, previewDatabaseProblems, previewStorageProblems,
} from "@/lib/runtime/preview-isolation";
import { getDbConfig } from "@/lib/db/config";
import { resolveDbTarget } from "@/lib/db/target";
import { resolveS3Config } from "@/lib/s3/config";
import { s3ClientCredentials } from "@/lib/s3/client";
import { selectMediaStorage } from "@/lib/media/storage";
import { getAssetUrl } from "@/lib/assets";
import { getSystemStatus } from "@/lib/admin/system-status";

console.log("--- Testing Preview isolation (Vercel Preview never touches production AWS) ---");

// Example values only. The "production keys" are fake and exist to prove they are never used on Preview.
const VERCEL_PROD = { VERCEL: "1", NODE_ENV: "production", VERCEL_ENV: "production" };
const VERCEL_PREVIEW = { VERCEL: "1", NODE_ENV: "production", VERCEL_ENV: "preview" };
const PROD_KEYS = { AWS_ACCESS_KEY_ID: "test-not-a-real-access-key-id", AWS_SECRET_ACCESS_KEY: "test-not-a-real-secret-value" };
const ROLE = "arn:aws:iam::000000000000:role/luftansa-vercel-preview";
const GOOD_PREVIEW = {
  ...VERCEL_PREVIEW, AWS_REGION: "ap-south-2", DYNAMODB_TABLE: "luftansa-store-preview", AWS_S3_BUCKET: "luftansa-store-preview-assets", AWS_ROLE_ARN: ROLE,
};

/** Runs fn with console.error silenced (the isolation warnings are expected here). */
function quiet<T>(fn: () => T): T {
  const orig = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = orig; }
}

/** Runs fn with process.env temporarily replaced by the given keys (restored afterwards). */
function withEnv<T>(env: Record<string, string>, fn: () => T): T {
  const keys = ["VERCEL", "NODE_ENV", "VERCEL_ENV", "AWS_REGION", "DYNAMODB_TABLE", "AWS_S3_BUCKET", "AWS_ROLE_ARN", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "ASSET_CDN_URL"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const penv = process.env as Record<string, string | undefined>;
  for (const k of keys) delete penv[k];
  Object.assign(penv, env);
  try { return quiet(fn); } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete penv[k];
      else penv[k] = saved[k];
    }
  }
}

console.log("1. Deployment environment detection...");
{
  assert.equal(deploymentEnv(VERCEL_PROD), "production");
  assert.equal(deploymentEnv(VERCEL_PREVIEW), "preview");
  assert.equal(deploymentEnv({ VERCEL: "1", NODE_ENV: "production" }), "preview", "missing VERCEL_ENV on Vercel fails closed as Preview");
  assert.equal(deploymentEnv({ VERCEL: "1", NODE_ENV: "production", VERCEL_ENV: "development" }), "preview");
  assert.equal(deploymentEnv({ VERCEL: "1", NODE_ENV: "development", VERCEL_ENV: "development" }), "local", "vercel dev stays local");
  assert.equal(deploymentEnv({ NODE_ENV: "production", VERCEL_ENV: "production" }), "local", "VERCEL_ENV alone never means production");
  assert.equal(deploymentEnv({}), "local");
  console.log("   ✓ production only with VERCEL_ENV=production; anything else on Vercel is Preview");
}

console.log("2. Preview rules: explicit Preview resources and OIDC role only...");
{
  assert.deepEqual(previewDatabaseProblems(GOOD_PREVIEW), []);
  assert.deepEqual(previewStorageProblems(GOOD_PREVIEW), []);
  assert.match(previewDatabaseProblems({ ...GOOD_PREVIEW, DYNAMODB_TABLE: undefined } as never).join(), /DYNAMODB_TABLE is not set/);
  assert.match(previewDatabaseProblems({ ...GOOD_PREVIEW, DYNAMODB_TABLE: "  " }).join(), /DYNAMODB_TABLE is not set/);
  for (const t of [...PRODUCTION_DYNAMODB_TABLES, "LUFTANSA-STORE"]) {
    assert.match(previewDatabaseProblems({ ...GOOD_PREVIEW, DYNAMODB_TABLE: t }).join(), /production resource/, `table ${t} refused`);
  }
  assert.match(previewDatabaseProblems({ ...GOOD_PREVIEW, DYNAMODB_TABLE: "luftansa-store-backup" }).join(), /must contain "preview"/);
  for (const b of [...PRODUCTION_S3_BUCKETS, "Luftansa-Store-Assets"]) {
    assert.match(previewStorageProblems({ ...GOOD_PREVIEW, AWS_S3_BUCKET: b }).join(), /production resource/, `bucket ${b} refused`);
  }
  assert.match(previewStorageProblems({ ...GOOD_PREVIEW, AWS_S3_BUCKET: "" }).join(), /AWS_S3_BUCKET is not set/);
  const noRole = { ...GOOD_PREVIEW, ...PROD_KEYS, AWS_ROLE_ARN: "" };
  assert.match(previewDatabaseProblems(noRole).join(), /AWS_ROLE_ARN is not set/, "access keys never replace the Preview role");
  assert.match(previewStorageProblems(noRole).join(), /AWS_ROLE_ARN is not set/);
  // Problems name variables, never values.
  const all = [...previewDatabaseProblems({ ...VERCEL_PREVIEW, ...PROD_KEYS, DYNAMODB_TABLE: "luftansa-store" }), ...previewStorageProblems({ ...PROD_KEYS, AWS_S3_BUCKET: "luftansa-store-assets" })].join(" ");
  for (const secret of [PROD_KEYS.AWS_ACCESS_KEY_ID, PROD_KEYS.AWS_SECRET_ACCESS_KEY, "luftansa-store-assets"]) assert.ok(!all.includes(secret), "no values in messages");
  console.log("   ✓ missing, production and non-Preview names refused; role required; no values in messages");
}

console.log("3. DynamoDB: Preview fails closed, Production unchanged...");
{
  assert.equal(quiet(() => getDbConfig({ ...VERCEL_PREVIEW, AWS_ROLE_ARN: ROLE })), null, "Preview without DYNAMODB_TABLE: no fallback to luftansa-store");
  assert.equal(quiet(() => getDbConfig({ ...GOOD_PREVIEW, DYNAMODB_TABLE: "luftansa-store" })), null, "Preview with the production table: not configured");
  assert.equal(quiet(() => getDbConfig({ ...GOOD_PREVIEW, AWS_ROLE_ARN: undefined } as never)), null, "Preview without role: not configured");
  assert.deepEqual(getDbConfig(GOOD_PREVIEW), { tableName: "luftansa-store-preview", region: "ap-south-2" });

  assert.deepEqual(getDbConfig(VERCEL_PROD), { tableName: "luftansa-store", region: "ap-south-2" }, "Production default table unchanged");
  assert.equal(getDbConfig({ ...VERCEL_PROD, DYNAMODB_TABLE: "luftansa-store", DYNAMODB_REGION: "ap-south-2" })?.tableName, "luftansa-store");
  assert.equal(getDbConfig({})?.tableName, "luftansa-local", "local default unchanged");

  const t = resolveDbTarget({ ...GOOD_PREVIEW, ...PROD_KEYS });
  assert.deepEqual(t, { kind: "preview", roleArn: ROLE }, "Preview connects with its role (keys present but unused)");
  const off = resolveDbTarget({ ...VERCEL_PREVIEW, ...PROD_KEYS, DYNAMODB_TABLE: "luftansa-store" });
  assert.equal(off.kind, "disabled");
  if (off.kind === "disabled") assert.ok(!off.reason.includes(PROD_KEYS.AWS_SECRET_ACCESS_KEY));
  assert.equal(resolveDbTarget({ ...VERCEL_PREVIEW, DYNAMODB_ENDPOINT: "http://127.0.0.1:8000" }).kind, "disabled", "a local endpoint does not help a misconfigured Preview");
  assert.deepEqual(resolveDbTarget({ ...VERCEL_PROD, ...PROD_KEYS }), { kind: "production" }, "Production target unchanged");
  console.log("   ✓ no production fallback, no production table, role-only credentials; Production unchanged");
}

console.log("4. S3: Preview uses only its bucket and role, never access keys...");
{
  const cfg = resolveS3Config({ ...GOOD_PREVIEW, ...PROD_KEYS });
  assert.equal(cfg.bucket, "luftansa-store-preview-assets");
  assert.deepEqual(cfg.credentials, { kind: "oidc-role", roleArn: ROLE }, "static production keys are ignored on Preview");
  assert.equal(typeof s3ClientCredentials(cfg.credentials), "function", "SDK gets the OIDC credential provider");

  assert.throws(() => resolveS3Config({ ...GOOD_PREVIEW, AWS_S3_BUCKET: "luftansa-store-assets" }), PreviewIsolationError, "production bucket refused");
  assert.throws(() => resolveS3Config({ ...GOOD_PREVIEW, AWS_S3_BUCKET: undefined } as never), PreviewIsolationError, "no bucket fallback");
  assert.throws(() => resolveS3Config({ ...GOOD_PREVIEW, ...PROD_KEYS, AWS_ROLE_ARN: "" }), PreviewIsolationError, "keys without role refused");

  const prodStatic = resolveS3Config({ ...VERCEL_PROD, ...PROD_KEYS, AWS_REGION: "ap-south-2", AWS_S3_BUCKET: "luftansa-store-assets" });
  assert.deepEqual(prodStatic.credentials, { kind: "static", ...{ accessKeyId: PROD_KEYS.AWS_ACCESS_KEY_ID, secretAccessKey: PROD_KEYS.AWS_SECRET_ACCESS_KEY } }, "Production keeps its keys");
  assert.deepEqual(s3ClientCredentials(prodStatic.credentials), { accessKeyId: PROD_KEYS.AWS_ACCESS_KEY_ID, secretAccessKey: PROD_KEYS.AWS_SECRET_ACCESS_KEY });
  const prodChain = resolveS3Config({ ...VERCEL_PROD, AWS_REGION: "ap-south-2", AWS_S3_BUCKET: "luftansa-store-assets" });
  assert.deepEqual(prodChain.credentials, { kind: "default-chain" });
  assert.equal(s3ClientCredentials(prodChain.credentials), undefined, "Production default chain unchanged");
  assert.throws(() => resolveS3Config({ ...VERCEL_PROD }), /S3 is not configured/);
  console.log("   ✓ Preview bucket + role only; Production credentials unchanged");
}

console.log("5. Media storage and CDN: Preview fails closed...");
{
  assert.equal(quiet(() => selectMediaStorage({ ...VERCEL_PREVIEW, ...PROD_KEYS, AWS_S3_BUCKET: "luftansa-store-assets", AWS_ROLE_ARN: ROLE })).kind, "none", "uploads/deletes refused");
  assert.equal(quiet(() => selectMediaStorage({ ...VERCEL_PREVIEW, AWS_S3_BUCKET: "luftansa-store-preview-assets" })).kind, "none", "no role: no storage");
  assert.equal(selectMediaStorage(GOOD_PREVIEW).kind, "s3");
  assert.equal(selectMediaStorage(VERCEL_PROD).kind, "s3", "Production storage unchanged");
  assert.deepEqual(selectMediaStorage({ LOCAL_MEDIA_DIR: "/tmp/m" }), { kind: "local", dir: "/tmp/m" });
  assert.equal(selectMediaStorage({}).kind, "none");

  const cdn = "https://dexample.cloudfront.net";
  assert.equal(withEnv({ ...GOOD_PREVIEW, ASSET_CDN_URL: cdn }, () => getAssetUrl("hero/a.jpg")), "/media/hero/a.jpg", "Preview never uses the production CDN");
  assert.equal(withEnv({ ...VERCEL_PROD, ASSET_CDN_URL: cdn }, () => getAssetUrl("hero/a.jpg")), `${cdn}/hero/a.jpg`, "Production CDN unchanged");
  console.log("   ✓ storage disabled when not isolated; CDN production-only");
}

console.log("6. System status reports isolation without secrets...");
{
  const bad = withEnv({ ...VERCEL_PREVIEW, ...PROD_KEYS, AWS_REGION: "ap-south-2", AWS_S3_BUCKET: "luftansa-store-assets" }, () => getSystemStatus());
  assert.equal(bad.deployment, "preview");
  assert.equal(bad.database.configured, false);
  assert.equal(bad.storage.configured, false);
  assert.equal(bad.credentials.usesLongLivedKeys, false, "Preview never uses the keys");
  assert.ok(bad.isolationProblems.length >= 3);
  const text = JSON.stringify(bad.isolationProblems);
  assert.ok(!text.includes(PROD_KEYS.AWS_ACCESS_KEY_ID) && !text.includes(PROD_KEYS.AWS_SECRET_ACCESS_KEY));

  const good = withEnv(GOOD_PREVIEW, () => getSystemStatus());
  assert.deepEqual(good.isolationProblems, []);
  assert.equal(good.database.table, "luftansa-store-preview");
  assert.equal(good.storage.configured, true);

  const prod = withEnv({ ...VERCEL_PROD, ...PROD_KEYS, AWS_REGION: "ap-south-2", AWS_S3_BUCKET: "luftansa-store-assets" }, () => getSystemStatus());
  assert.equal(prod.deployment, "production");
  assert.deepEqual(prod.isolationProblems, []);
  assert.equal(prod.database.table, "luftansa-store");
  assert.equal(prod.credentials.usesLongLivedKeys, true, "Production status unchanged");
  console.log("   ✓ Preview problems listed by variable name only; Production status unchanged");
}

console.log("--- Preview isolation tests passed ---");
