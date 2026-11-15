import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { isAllowedAssetKey } from "../src/lib/s3";
import { Repository } from "../src/lib/db/repository";
import { AuditService } from "../src/lib/db/audit";
import {
  createProduct,
  getProductWithVariants,
  updateProduct,
} from "../src/lib/db/products-service";

console.log("--- Starting Complete Upload & Image Persistence Workflow Tests ---");

// Test 1: S3 Allowed Key Validation for Main, Gallery & Notes
console.log("1. Testing S3 Asset Key Allowlist...");
{
  assert.equal(isAllowedAssetKey("products/oud-forest/main/1731652000-bottle.webp"), true);
  assert.equal(isAllowedAssetKey("products/oud-forest/gallery/1731652000-packaging.webp"), true);
  assert.equal(isAllowedAssetKey("products/oud-forest/notes/1731652000-bergamot.webp"), true);
  assert.equal(isAllowedAssetKey("products/../evil.exe"), false);
  assert.equal(isAllowedAssetKey("secret/passwords.txt"), false);
  console.log("   ✓ Allowed asset key validation verified for main, gallery and note folders");
}

interface FakeItem {
  pk: string;
  sk: string;
  version?: number;
  [key: string]: unknown;
}

interface FakeCommand {
  constructor: { name: string };
  input: {
    Key?: { pk: string; sk: string };
    Item?: FakeItem;
    ExpressionAttributeValues?: Record<string, unknown>;
    TransactItems?: { Put?: { Item: FakeItem } }[];
  };
}

// Test 2: In-Memory DB Mock to Verify Full Persistence Lifecycle
console.log("2. Testing S3 Key Persistence to DynamoDB and Reopening...");
{
  const store = new Map<string, FakeItem>();

  const fakeClient = {
    async send(command: FakeCommand) {
      const name = command.constructor.name;
      if (name === "GetCommand") {
        const item = store.get(`${command.input.Key?.pk}::${command.input.Key?.sk}`);
        return { Item: item ? JSON.parse(JSON.stringify(item)) : undefined };
      }
      if (name === "PutCommand" && command.input.Item) {
        store.set(`${command.input.Item.pk}::${command.input.Item.sk}`, JSON.parse(JSON.stringify(command.input.Item)));
        return {};
      }
      if (name === "QueryCommand") {
        const values = command.input.ExpressionAttributeValues || {};
        const items: FakeItem[] = [];
        for (const v of store.values()) {
          if (v.pk === values[":pk"]) {
            if (values[":prefix"] && typeof v.sk === "string") {
              if (v.sk.startsWith(values[":prefix"] as string)) {
                items.push(JSON.parse(JSON.stringify(v)));
              }
            } else {
              items.push(JSON.parse(JSON.stringify(v)));
            }
          }
        }
        return { Items: items };
      }
      if (name === "TransactWriteCommand" && command.input.TransactItems) {
        for (const it of command.input.TransactItems) {
          if (it.Put) {
            store.set(`${it.Put.Item.pk}::${it.Put.Item.sk}`, JSON.parse(JSON.stringify(it.Put.Item)));
          }
        }
        return {};
      }
      return {};
    },
  };

  const repo = new Repository(fakeClient as unknown as DynamoDBDocumentClient, "luftansa-store");
  const audit = new AuditService(repo);
  const adminEmail = "admin@luftansa.in";

  // Step A: Create Product with uploaded Main, Gallery, and Fragrance-Note Images
  const initial = await createProduct(repo, audit, adminEmail, {
    id: "royal-amber",
    name: "Royal Amber",
    description: "Opulent amber fragrance",
    category: "Perfume",
    status: "ACTIVE",
    sizes: [30, 50, 100],
    mainImageKey: "products/royal-amber/main/1001-hero.webp",
    mainImageAlt: "Royal Amber bottle",
    galleryImageKeys: [
      "products/royal-amber/gallery/1002-angle.webp",
      "products/royal-amber/gallery/1003-box.webp",
    ],
    keywords: ["amber", "warm", "oriental"],
    notes: {
      top: [
        { id: "note-top-1", name: "Saffron", imageKey: "products/royal-amber/notes/1004-saffron.webp", description: "Golden spice" },
      ],
      heart: [
        { id: "note-heart-1", name: "Amber Resin", imageKey: "products/royal-amber/notes/1005-amber.webp", description: "Warm heart" },
      ],
      base: [
        { id: "note-base-1", name: "Bourbon Vanilla", imageKey: "products/royal-amber/notes/1006-vanilla.webp", description: "Creamy Madagascar vanilla" },
      ],
    },
    variants: [
      { sizeMl: 30, stockQuantity: 20 },
      { sizeMl: 50, stockQuantity: 30 },
      { sizeMl: 100, stockQuantity: 10 },
    ],
  });

  assert.equal(initial.product.mainImageKey, "products/royal-amber/main/1001-hero.webp");
  assert.equal(initial.product.galleryImageKeys?.length, 2);
  assert.equal(initial.product.notes?.top[0]?.imageKey, "products/royal-amber/notes/1004-saffron.webp");
  assert.equal(initial.product.notes?.heart[0]?.imageKey, "products/royal-amber/notes/1005-amber.webp");
  assert.equal(initial.product.notes?.base[0]?.imageKey, "products/royal-amber/notes/1006-vanilla.webp");
  console.log("   ✓ Step A: Product successfully created with main, gallery, and independent note images");

  // Step B: Reopen product from DB (simulating Edit Fragrance modal load)
  const reopened = await getProductWithVariants(repo, "royal-amber");
  assert.ok(reopened);
  assert.equal(reopened.product.mainImageKey, "products/royal-amber/main/1001-hero.webp");
  assert.equal(reopened.product.galleryImageKeys?.[0], "products/royal-amber/gallery/1002-angle.webp");
  assert.equal(reopened.product.galleryImageKeys?.[1], "products/royal-amber/gallery/1003-box.webp");
  assert.equal(reopened.product.notes?.top[0]?.imageKey, "products/royal-amber/notes/1004-saffron.webp");
  assert.equal(reopened.product.notes?.heart[0]?.imageKey, "products/royal-amber/notes/1005-amber.webp");
  assert.equal(reopened.product.notes?.base[0]?.imageKey, "products/royal-amber/notes/1006-vanilla.webp");
  console.log("   ✓ Step B: Reopening Edit Fragrance accurately loads all saved image keys and note structures");

  // Step C: Edit unrelated field (description & stock) - verify images are NOT lost
  const updated = await updateProduct(repo, audit, adminEmail, "royal-amber", {
    version: reopened.product.version,
    description: "Updated description without modifying images",
    mainImageKey: reopened.product.mainImageKey,
    galleryImageKeys: reopened.product.galleryImageKeys,
    notes: reopened.product.notes,
    variants: [
      { sizeMl: 30, stockQuantity: 50 }, // updated stock
    ],
  });

  assert.equal(updated.product.description, "Updated description without modifying images");
  assert.equal(updated.product.mainImageKey, "products/royal-amber/main/1001-hero.webp");
  assert.equal(updated.product.galleryImageKeys?.length, 2);
  assert.equal(updated.product.notes?.top[0]?.imageKey, "products/royal-amber/notes/1004-saffron.webp");
  assert.equal(updated.product.notes?.heart[0]?.imageKey, "products/royal-amber/notes/1005-amber.webp");
  assert.equal(updated.product.notes?.base[0]?.imageKey, "products/royal-amber/notes/1006-vanilla.webp");
  console.log("   ✓ Step C: Editing other fields preserves all image keys and note structures without loss");
}

console.log("\n🎉 ALL UPLOAD & PERSISTENCE WORKFLOW TESTS PASSED!");
