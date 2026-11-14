import assert from "node:assert/strict";
import { ENTITY, keys, assertId, InvalidKeyError } from "../src/lib/db/keys";
import {
  productVariantItemSchema,
  productCreateInputSchema,
  STANDARD_PRICES_INR,
} from "../src/lib/db/schemas";
import { Repository, ConflictError } from "../src/lib/db/repository";
import { AuditService } from "../src/lib/db/audit";
import {
  createProduct,
  getProductWithVariants,
  listProducts,
  updateProduct,
  deleteProduct,
} from "../src/lib/db/products-service";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

console.log("--- Starting Phase 2 Product Management Foundation Tests ---");

// 1. Key Builder Tests
console.log("1. Testing Key Builders...");
{
  const pKey = keys.product("black-velvet");
  assert.equal(pKey.pk, "PRODUCT#black-velvet");
  assert.equal(pKey.sk, "META");

  const vKey30 = keys.variant("black-velvet", 30);
  assert.equal(vKey30.pk, "PRODUCT#black-velvet");
  assert.equal(vKey30.sk, "VARIANT#00030");

  const vKey50 = keys.variant("black-velvet", 50);
  assert.equal(vKey50.sk, "VARIANT#00050");

  const vKey100 = keys.variant("black-velvet", 100);
  assert.equal(vKey100.sk, "VARIANT#00100");

  const gsi1 = keys.productGsi1("ACTIVE", "black-velvet");
  assert.equal(gsi1.GSI1PK, "PRODUCTS");
  assert.equal(gsi1.GSI1SK, "STATUS#ACTIVE#SLUG#black-velvet");

  const gsi2 = keys.productGsi2("Perfume", "black-velvet");
  assert.equal(gsi2.GSI2PK, "CATEGORY#Perfume");
  assert.equal(gsi2.GSI2SK, "SLUG#black-velvet");

  assert.throws(() => assertId("bad#id"), InvalidKeyError);
  assert.throws(() => keys.variant("black-velvet", 0), InvalidKeyError);
  assert.throws(() => keys.variant("black-velvet", -50), InvalidKeyError);
}
console.log("   ✓ Key builders verified");

// 2. Standard Pricing & Schema Validation Tests
console.log("2. Testing Schemas & Confirmed Standard Pricing...");
{
  assert.equal(STANDARD_PRICES_INR[30], 400, "30 ml spray must be ₹400");
  assert.equal(STANDARD_PRICES_INR[50], 630, "50 ml spray must be ₹630");
  assert.equal(STANDARD_PRICES_INR[100], 1000, "100 ml spray must be ₹1,000");

  const validProductInput = {
    id: "daily-rizz",
    name: "Daily Rizz",
    description: "Invigorating fresh fragrance",
    category: "Perfume",
    status: "ACTIVE" as const,
    sizes: [30, 50, 100] as const,
  };
  const parsedCreate = productCreateInputSchema.parse(validProductInput);
  assert.equal(parsedCreate.id, "daily-rizz");
  assert.deepEqual(parsedCreate.sizes, [30, 50, 100]);

  // Invalid sizes must be rejected
  assert.throws(() => {
    productCreateInputSchema.parse({
      ...validProductInput,
      sizes: [20, 50], // 20 is not a confirmed size
    });
  });

  // Invalid negative stock must be rejected
  assert.throws(() => {
    productVariantItemSchema.parse({
      pk: "PRODUCT#daily-rizz",
      sk: "VARIANT#00030",
      entityType: ENTITY.variant,
      productId: "daily-rizz",
      sizeMl: 30,
      priceInr: 400,
      stockQuantity: -5,
      sku: "LUF-DAILY-RIZZ-30ML",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
  });
}
console.log("   ✓ Schemas & pricing verified");

class ConditionalFailure extends Error {
  name = "ConditionalCheckFailedException";
}

class TransactionCanceledFailure extends Error {
  name = "TransactionCanceledException";
}

interface TransactItemInput {
  Put?: {
    TableName: string;
    Item: Record<string, unknown>;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, unknown>;
  };
  Delete?: {
    TableName: string;
    Key: Record<string, unknown>;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, unknown>;
  };
}

interface CommandWithInput {
  input: {
    TableName?: string;
    Key?: Record<string, unknown>;
    Item?: Record<string, unknown>;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, unknown>;
    IndexName?: string;
    TransactItems?: TransactItemInput[];
  };
}

// 3. In-Memory DynamoDB Fake for Unit Testing
class InMemoryDynamoClient {
  private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();

  async send(command: CommandWithInput): Promise<Record<string, unknown>> {
    if (command instanceof TransactWriteCommand) {
      const items = command.input.TransactItems || [];

      // Pass 1: condition checks (atomic: if any fails, nothing is applied)
      for (const tItem of items) {
        if (tItem.Put) {
          const tName = tItem.Put.TableName;
          const tTable = this.tables.get(tName);
          const item = tItem.Put.Item;
          const keyStr = `${item.pk}##${item.sk}`;
          const existing = tTable?.get(keyStr);
          const cond = tItem.Put.ConditionExpression;

          if (cond === "attribute_not_exists(pk)" && existing) {
            throw new TransactionCanceledFailure("Transaction cancelled: item already exists");
          }
          if (cond && cond.includes("#v = :expected")) {
            const expected = tItem.Put.ExpressionAttributeValues?.[":expected"];
            if (!existing || existing.version !== expected) {
              throw new TransactionCanceledFailure("Transaction cancelled: version mismatch");
            }
          }
        }
        if (tItem.Delete) {
          const tName = tItem.Delete.TableName;
          const tTable = this.tables.get(tName);
          const keyStr = `${tItem.Delete.Key.pk}##${tItem.Delete.Key.sk}`;
          const existing = tTable?.get(keyStr);
          const cond = tItem.Delete.ConditionExpression;

          if (cond && cond.includes("attribute_exists(pk)") && !existing) {
            throw new TransactionCanceledFailure("Transaction cancelled: missing item");
          }
          if (cond && cond.includes("#v = :expected")) {
            const expected = tItem.Delete.ExpressionAttributeValues?.[":expected"];
            if (!existing || existing.version !== expected) {
              throw new TransactionCanceledFailure("Transaction cancelled: version mismatch");
            }
          }
        }
      }

      // Pass 2: apply mutations
      for (const tItem of items) {
        if (tItem.Put) {
          const tName = tItem.Put.TableName;
          if (!this.tables.has(tName)) this.tables.set(tName, new Map());
          const tTable = this.tables.get(tName)!;
          const item = tItem.Put.Item;
          tTable.set(`${item.pk}##${item.sk}`, structuredClone(item));
        }
        if (tItem.Delete) {
          const tName = tItem.Delete.TableName;
          if (!this.tables.has(tName)) this.tables.set(tName, new Map());
          const tTable = this.tables.get(tName)!;
          tTable.delete(`${tItem.Delete.Key.pk}##${tItem.Delete.Key.sk}`);
        }
      }
      return {};
    }

    const tableName = command.input.TableName!;
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
    const table = this.tables.get(tableName)!;

    if (command instanceof GetCommand) {
      const keyStr = `${command.input.Key?.pk}##${command.input.Key?.sk}`;
      const item = table.get(keyStr);
      return { Item: item ? structuredClone(item) : undefined };
    }

    if (command instanceof PutCommand) {
      const item = command.input.Item!;
      const keyStr = `${item.pk}##${item.sk}`;
      const existing = table.get(keyStr);
      const cond = command.input.ConditionExpression;

      if (cond === "attribute_not_exists(pk)" && existing) {
        throw new ConditionalFailure("Conditional check failed");
      }

      if (cond && cond.includes("#v = :expected")) {
        const expectedVersion = command.input.ExpressionAttributeValues?.[":expected"];
        if (!existing || existing.version !== expectedVersion) {
          throw new ConditionalFailure("Version mismatch");
        }
      }

      table.set(keyStr, structuredClone(item));
      return {};
    }

    if (command instanceof DeleteCommand) {
      const keyStr = `${command.input.Key?.pk}##${command.input.Key?.sk}`;
      const existing = table.get(keyStr);
      const cond = command.input.ConditionExpression;

      if (cond && cond.includes("attribute_exists(pk)") && !existing) {
        throw new ConditionalFailure("Conditional check failed");
      }

      if (cond && cond.includes("#v = :expected")) {
        const expectedVersion = command.input.ExpressionAttributeValues?.[":expected"];
        if (!existing || existing.version !== expectedVersion) {
          throw new ConditionalFailure("Version mismatch");
        }
      }

      table.delete(keyStr);
      return {};
    }

    if (command instanceof QueryCommand) {
      const indexName = command.input.IndexName;
      const values = command.input.ExpressionAttributeValues ?? {};
      const items: Record<string, unknown>[] = [];

      for (const item of table.values()) {
        if (indexName === "GSI1") {
          if (item.GSI1PK && (item.GSI1PK === values[":gsi1pk"] || item.GSI1PK === values[":pk"])) {
            if (values[":prefix"] && typeof item.GSI1SK === "string") {
              if (item.GSI1SK.startsWith(values[":prefix"] as string)) {
                items.push(structuredClone(item));
              }
            } else {
              items.push(structuredClone(item));
            }
          }
        } else {
          // Primary table query
          if (item.pk === values[":pk"]) {
            if (values[":prefix"] && typeof item.sk === "string") {
              if (item.sk.startsWith(values[":prefix"] as string)) {
                items.push(structuredClone(item));
              }
            } else {
              items.push(structuredClone(item));
            }
          }
        }
      }

      return { Items: items };
    }

    throw new Error(`Unsupported command in test fake: ${command.constructor.name}`);
  }
}

// 4. End-to-End Service Operation Tests
console.log("3. Testing Product Service operations (Create, List, Get, Update, Delete)...");
async function runServiceTests() {
  const fakeClient = new InMemoryDynamoClient();
  const repo = new Repository(fakeClient, "luftansa-store");
  const audit = new AuditService(repo);
  const adminEmail = "admin@luftansa.in";

  // Test Create
  const created = await createProduct(repo, audit, adminEmail, {
    id: "oud-forest",
    name: "Oud Forest",
    description: "Deep woody and earthy aroma",
    category: "Perfume",
    status: "ACTIVE",
    sizes: [30, 50, 100],
    variants: [
      { sizeMl: 30, stockQuantity: 25 },
      { sizeMl: 50, stockQuantity: 40 },
      { sizeMl: 100, stockQuantity: 15 },
    ],
  });

  assert.equal(created.product.id, "oud-forest");
  assert.equal(created.product.version, 1);
  assert.equal(created.variants.length, 3);
  assert.equal(created.variants[0].sizeMl, 30);
  assert.equal(created.variants[0].priceInr, 400);
  assert.equal(created.variants[0].stockQuantity, 25);
  assert.equal(created.variants[1].sizeMl, 50);
  assert.equal(created.variants[1].priceInr, 630);
  assert.equal(created.variants[2].sizeMl, 100);
  assert.equal(created.variants[2].priceInr, 1000);
  console.log("   ✓ Product creation with standard prices and variants verified");

  // Duplicate create must fail
  await assert.rejects(
    async () => {
      await createProduct(repo, audit, adminEmail, {
        id: "oud-forest",
        name: "Oud Forest Duplicate",
        sizes: [30, 50, 100],
      });
    },
    ConflictError,
    "Creating duplicate product must throw ConflictError",
  );
  console.log("   ✓ Duplicate product prevention verified");

  // Test List (GSI1 zero-scan query)
  const listResult = await listProducts(repo);
  assert.equal(listResult.items.length, 1);
  assert.equal(listResult.items[0].id, "oud-forest");
  console.log("   ✓ GSI1 zero-scan list verified");

  // Test Get With Variants
  const fetched = await getProductWithVariants(repo, "oud-forest");
  assert.ok(fetched);
  assert.equal(fetched.product.id, "oud-forest");
  assert.equal(fetched.variants.length, 3);
  console.log("   ✓ Get product with variants verified");

  // Test Optimistic Update
  const updated = await updateProduct(repo, audit, adminEmail, "oud-forest", {
    version: 1, // Correct current version
    name: "Oud Forest Royale",
    variants: [
      { sizeMl: 30, stockQuantity: 30 },
      { sizeMl: 50, stockQuantity: 45 },
      { sizeMl: 100, stockQuantity: 20 },
    ],
  });
  assert.equal(updated.product.name, "Oud Forest Royale");
  assert.equal(updated.product.version, 2, "Version must be incremented to 2");
  console.log("   ✓ Optimistic concurrency update verified");

  // Stale version update must fail
  await assert.rejects(
    async () => {
      await updateProduct(repo, audit, adminEmail, "oud-forest", {
        version: 1, // Stale version (currently at 2)
        name: "Stale Update",
      });
    },
    ConflictError,
    "Updating with stale version must throw ConflictError",
  );
  console.log("   ✓ Version mismatch conflict protection verified");

  // Test Delete with version check
  await deleteProduct(repo, audit, adminEmail, "oud-forest", 2);
  const afterDelete = await getProductWithVariants(repo, "oud-forest");
  assert.equal(afterDelete, null);
  console.log("   ✓ Product and variants deletion with version check verified");

  console.log("\n🎉 ALL PHASE 2 UNIT TESTS PASSED SUCCESSFULLY!");
}

runServiceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
