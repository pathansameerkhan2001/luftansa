/**
 * Creates the local table in DynamoDB Local and seeds sanitized fixtures.
 *
 *   npm run local:setup
 *
 * - Refuses to run unless DYNAMODB_ENDPOINT is a localhost URL (dummy credentials).
 * - Seeds the standard product types and the legacy catalogue that already
 *   lives in the code (8 fragrances, confirmed prices). No production data,
 *   secrets or customer information is read or copied.
 * - Idempotent: existing items are never overwritten.
 */
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mkdirSync } from "node:fs";
import { AuditService } from "@/lib/db/audit";
import { Repository } from "@/lib/db/repository";
import { resolveDbTarget } from "@/lib/db/target";
import { seedInitialProductTypes } from "@/lib/db/product-types-service";
import { applyCatalogueImport, planCatalogueImport } from "@/lib/catalogue/import-catalogue";

const SEED_ACTOR = "admin@luftansa.local";

export async function setupLocal(): Promise<void> {
  const target = resolveDbTarget();
  if (target.kind !== "local") throw new Error("local:setup only runs against DynamoDB Local (set DYNAMODB_ENDPOINT to localhost).");
  const table = process.env.DYNAMODB_TABLE ?? "luftansa-local";
  const region = process.env.DYNAMODB_REGION ?? "ap-south-2";
  const raw = new DynamoDBClient({ region, endpoint: target.endpoint, credentials: target.credentials });

  try {
    await raw.send(new DescribeTableCommand({ TableName: table }));
    console.log(`[local:setup] Table ${table} exists.`);
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException) && (e as Error).name !== "ResourceNotFoundException") throw e;
    console.log(`[local:setup] Creating table ${table} (pk/sk + GSI1 + GSI2, same key design as production)…`);
    await raw.send(
      new CreateTableCommand({
        TableName: table,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: ["pk", "sk", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK"].map((n) => ({ AttributeName: n, AttributeType: "S" })),
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          { IndexName: "GSI1", KeySchema: [{ AttributeName: "GSI1PK", KeyType: "HASH" }, { AttributeName: "GSI1SK", KeyType: "RANGE" }], Projection: { ProjectionType: "ALL" } },
          { IndexName: "GSI2", KeySchema: [{ AttributeName: "GSI2PK", KeyType: "HASH" }, { AttributeName: "GSI2SK", KeyType: "RANGE" }], Projection: { ProjectionType: "ALL" } },
        ],
      }),
    );
  }

  const doc = DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });
  const repo = new Repository(doc, table);
  const audit = new AuditService(repo);
  const types = await seedInitialProductTypes(repo);
  console.log(`[local:setup] Product types: seeded ${types.seeded.length}, existing ${types.existing.length}.`);
  const plan = await planCatalogueImport(repo);
  const result = await applyCatalogueImport(repo, audit, SEED_ACTOR, plan);
  console.log(`[local:setup] Fixture products: created ${result.created.length}, skipped ${result.skipped.length}.`);

  const mediaDir = process.env.LOCAL_MEDIA_DIR;
  if (mediaDir) {
    mkdirSync(mediaDir, { recursive: true });
    console.log(`[local:setup] Local media folder: ${mediaDir}`);
  }
}
