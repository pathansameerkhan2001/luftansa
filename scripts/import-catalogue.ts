/**
 * Legacy catalogue import (DynamoDB).
 *
 *   npm run catalogue:import                         # dry run (default): reads only, prints the plan
 *   npm run catalogue:import -- --apply --confirm-production-write --actor <admin-email>
 *                                                    # writes to PRODUCTION; actor must be in ADMIN_EMAILS
 *
 * This is the only tool that intentionally targets the production table from
 * a computer, so writing requires both --apply and --confirm-production-write
 * (plus the allow-listed actor), all checked before any AWS client exists.
 *
 * Dry run is enforced at the client level: every command other than GetItem
 * and Query is rejected before it reaches AWS.
 * --apply creates ONLY products that are missing from DynamoDB (see
 * src/lib/catalogue/import-catalogue.ts for the guarantees).
 */
import fs from "node:fs";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuditService } from "../src/lib/db/audit";
import { Repository } from "../src/lib/db/repository";
import {
  applyCatalogueImport,
  planCatalogueImport,
  resolveImportMode,
  type ImportPlan,
} from "../src/lib/catalogue/import-catalogue";

function loadEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Sender = Pick<DynamoDBDocumentClient, "send">;

/** Rejects every command that could write. Used for dry runs. */
function readOnly(client: DynamoDBDocumentClient): Sender {
  return {
    send: ((command: unknown) => {
      if (command instanceof GetCommand || command instanceof QueryCommand) {
        return client.send(command as never);
      }
      const name = (command as { constructor?: { name?: string } })?.constructor?.name ?? "unknown";
      return Promise.reject(new Error(`Dry run: blocked non-read command ${name}`));
    }) as Sender["send"],
  };
}

function printPlan(plan: ImportPlan, table: string, region: string) {
  console.log(`\nTable: ${table} (${region})`);
  console.log(`Product type "perfume-spray" name: ${plan.productTypeName ?? "(not found)"}`);
  console.log(`\nProducts currently in DynamoDB (${plan.existingProducts.length}):`);
  for (const p of plan.existingProducts) console.log(`  - ${p.id}  "${p.name}"  ${p.status}`);

  console.log("\nLegacy storefront catalogue vs DynamoDB:");
  for (const item of plan.items) {
    const tag = item.action === "create" ? "CREATE" : item.action === "skip_exists" ? "SKIP  " : "SKIP? ";
    console.log(`  ${tag} ${item.slug.padEnd(18)} "${item.name}"${item.reason ? `  (${item.reason})` : ""}`);
  }

  const creates = plan.items.filter((i) => i.action === "create");
  console.log(`\nSummary: ${creates.length} to create, ${plan.items.length - creates.length} skipped.`);
  if (plan.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of plan.warnings) console.log(`  ! ${w}`);
  }

  for (const item of creates) {
    const { product, variants } = item.entry;
    console.log(`\n--- ${product.id}: items that would be written ---`);
    console.log(JSON.stringify(product, null, 2));
    for (const v of variants) console.log(JSON.stringify(v));
    console.log("+ 1 audit entry (action product.import)");
  }
}

async function main() {
  loadEnvLocal();
  // Writing requires --apply AND --confirm-production-write AND an allow-listed
  // --actor (same source and normalisation as the admin login). Checked before
  // any AWS client exists.
  const decision = resolveImportMode(process.argv.slice(2), process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim());
  const apply = decision.mode === "apply";
  const authorizedActor = decision.mode === "apply" ? decision.actor : undefined;

  // This tool deliberately targets the production table (the app's local
  // default table name does not apply here).
  const config = {
    tableName: process.env.DYNAMODB_TABLE?.trim() || "luftansa-store",
    region: (process.env.DYNAMODB_REGION ?? process.env.AWS_REGION ?? "ap-south-2").trim(),
  };

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false },
  });
  const sender: Sender = apply ? doc : readOnly(doc);
  const repo = new Repository(sender, config.tableName);

  console.log(apply ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (read-only; no writes are possible)");
  const plan = await planCatalogueImport(repo);
  printPlan(plan, config.tableName, config.region);

  if (!apply) {
    console.log("\nDry run complete. Nothing was written.");
    return;
  }

  const result = await applyCatalogueImport(repo, new AuditService(repo), authorizedActor!, plan);
  console.log(`\nCreated (${result.created.length}): ${result.created.join(", ") || "none"}`);
  for (const s of result.skipped) console.log(`Skipped ${s.slug}: ${s.reason}`);

  // Verify by re-reading.
  const verify = await planCatalogueImport(new Repository(readOnly(doc), config.tableName));
  const stillMissing = verify.items.filter((i) => i.action === "create").map((i) => i.slug);
  console.log(stillMissing.length === 0 ? "Verification: every legacy product now exists in DynamoDB." : `Verification: still missing: ${stillMissing.join(", ")}`);
}

main().catch((e) => {
  console.error(`\nImport failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
