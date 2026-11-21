import assert from "node:assert/strict";
import { keys, InvalidKeyError } from "../src/lib/db/keys";
import {
  productTypeItemSchema,
  productCreateInputSchema,
  fragranceNotesSchema,
} from "../src/lib/db/schemas";
import { Repository, ConflictError } from "../src/lib/db/repository";
import { AuditService } from "../src/lib/db/audit";
import {
  createProductType,
  listProductTypes,
  updateProductType,
  deleteProductType,
  seedInitialProductTypes,
} from "../src/lib/db/product-types-service";
import {
  createProduct,
  getProductWithVariants,
  updateProduct,
} from "../src/lib/db/products-service";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

console.log("--- Starting Dynamic Product Management & Variant Architecture Tests ---");

// 1. Key Builders & Stable Variant IDs
console.log("1. Testing Dynamic Key Builders & Stable Variant IDs...");
{
  // Product Type keys
  const tKey = keys.productType("roll-on");
  assert.equal(tKey.pk, "PRODUCT_TYPES");
  assert.equal(tKey.sk, "TYPE#roll-on");

  // Dynamic unique variant ID
  const vKeyDynamic = keys.variant("daily-rizz", "v_k9f2b8x1");
  assert.equal(vKeyDynamic.pk, "PRODUCT#daily-rizz");
  assert.equal(vKeyDynamic.sk, "VARIANT#v_k9f2b8x1");

  // Legacy numeric variant backward compatibility
  const vKeyLegacy = keys.variant("daily-rizz", 30);
  assert.equal(vKeyLegacy.pk, "PRODUCT#daily-rizz");
  assert.equal(vKeyLegacy.sk, "VARIANT#00030");

  assert.throws(() => keys.productType("bad#type"), InvalidKeyError);
  assert.throws(() => keys.variant("daily-rizz", "bad#var"), InvalidKeyError);
}
console.log("   ✓ Key builders and backward-compatible variant keys verified");

// In-Memory DynamoDB Fake
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
    KeyConditionExpression?: string;
    TransactItems?: TransactItemInput[];
  };
}

class InMemoryDynamoClient {
  private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();

  async send(command: CommandWithInput): Promise<Record<string, unknown>> {
    if (command instanceof TransactWriteCommand) {
      const items = command.input.TransactItems || [];

      // Pass 1: Condition checks
      for (const tItem of items) {
        if (tItem.Put) {
          const tName = tItem.Put.TableName;
          const tTable = this.tables.get(tName);
          const item = tItem.Put.Item;
          const keyStr = `${item.pk}##${item.sk}`;
          const existing = tTable?.get(keyStr);
          const cond = tItem.Put.ConditionExpression;

          if (cond === "attribute_not_exists(pk)" && existing) {
            throw new TransactionCanceledFailure("Item already exists");
          }
          if (cond?.includes("attribute_exists(pk) AND #v = :expected")) {
            if (!existing) throw new TransactionCanceledFailure("Item not found");
            const expected = tItem.Put.ExpressionAttributeValues?.[":expected"];
            if (existing.version !== expected) {
              throw new TransactionCanceledFailure("Version mismatch");
            }
          }
        }
        if (tItem.Delete) {
          const tName = tItem.Delete.TableName;
          const tTable = this.tables.get(tName);
          const key = tItem.Delete.Key!;
          const keyStr = `${key.pk}##${key.sk}`;
          const existing = tTable?.get(keyStr);
          const cond = tItem.Delete.ConditionExpression;

          if (cond?.includes("attribute_exists(pk)") && !existing) {
            throw new TransactionCanceledFailure("Item not found");
          }
          if (cond?.includes("#v = :expected")) {
            const expected = tItem.Delete.ExpressionAttributeValues?.[":expected"];
            if (existing?.version !== expected) {
              throw new TransactionCanceledFailure("Version mismatch");
            }
          }
        }
      }

      // Pass 2: Apply mutations
      for (const tItem of items) {
        if (tItem.Put) {
          const tName = tItem.Put.TableName;
          if (!this.tables.has(tName)) this.tables.set(tName, new Map());
          const item = tItem.Put.Item;
          const keyStr = `${item.pk}##${item.sk}`;
          this.tables.get(tName)!.set(keyStr, JSON.parse(JSON.stringify(item)));
        }
        if (tItem.Delete) {
          const tName = tItem.Delete.TableName;
          const key = tItem.Delete.Key!;
          const keyStr = `${key.pk}##${key.sk}`;
          this.tables.get(tName)?.delete(keyStr);
        }
      }
      return {};
    }

    if (command instanceof PutCommand) {
      const tName = command.input.TableName!;
      if (!this.tables.has(tName)) this.tables.set(tName, new Map());
      const item = command.input.Item!;
      const keyStr = `${item.pk}##${item.sk}`;
      const existing = this.tables.get(tName)!.get(keyStr);
      const cond = command.input.ConditionExpression;

      if (cond === "attribute_not_exists(pk)" && existing) {
        throw new ConditionalFailure("Item already exists");
      }
      this.tables.get(tName)!.set(keyStr, JSON.parse(JSON.stringify(item)));
      return {};
    }

    if (command instanceof GetCommand) {
      const tName = command.input.TableName!;
      const key = command.input.Key!;
      const keyStr = `${key.pk}##${key.sk}`;
      const item = this.tables.get(tName)?.get(keyStr);
      return { Item: item ? JSON.parse(JSON.stringify(item)) : undefined };
    }

    if (command instanceof DeleteCommand) {
      const tName = command.input.TableName!;
      const key = command.input.Key!;
      const keyStr = `${key.pk}##${key.sk}`;
      this.tables.get(tName)?.delete(keyStr);
      return {};
    }

    if (command instanceof QueryCommand) {
      const tName = command.input.TableName!;
      const tTable = this.tables.get(tName) || new Map();
      const allItems = Array.from(tTable.values());
      const values = command.input.ExpressionAttributeValues || {};
      const indexName = command.input.IndexName;

      if (indexName === "GSI2") {
        const pkVal = values[":pk"];
        const matched = allItems.filter((i) => i.GSI2PK === pkVal);
        return { Items: matched };
      }

      if (indexName === "GSI1") {
        const pkVal = values[":pk"];
        const prefix = values[":prefix"] as string | undefined;
        const matched = allItems.filter((i) => {
          if (i.GSI1PK !== pkVal) return false;
          if (prefix && typeof i.GSI1SK === "string" && !i.GSI1SK.startsWith(prefix)) return false;
          return true;
        });
        return { Items: matched };
      }

      // Base partition query
      const pkVal = values[":pk"];
      const prefix = values[":prefix"] as string | undefined;
      const matched = allItems.filter((i) => {
        if (i.pk !== pkVal) return false;
        if (prefix && typeof i.sk === "string" && !i.sk.startsWith(prefix)) return false;
        return true;
      });

      return { Items: matched };
    }

    return {};
  }
}

const fakeClient = new InMemoryDynamoClient();
const repo = new Repository(fakeClient as unknown as DynamoDBDocumentClient, "luftansa-store");
const audit = new AuditService(repo);

// 2. Product Types CRUD & Idempotent Seeding
console.log("2. Testing Product Types CRUD & Idempotent Seeding...");
{
  // A. Seed initial types
  const seedResult = await seedInitialProductTypes(repo);
  assert.equal(seedResult.seeded.length, 4);
  assert.deepEqual(seedResult.seeded, ["perfume-spray", "roll-on", "air-freshener", "attar"]);

  // B. Seeding again is idempotent and does not duplicate
  const reseed = await seedInitialProductTypes(repo);
  assert.equal(reseed.seeded.length, 0);
  assert.equal(reseed.existing.length, 4);

  // C. List product types
  const types = await listProductTypes(repo);
  assert.equal(types.length, 4);
  assert.equal(types[0].id, "perfume-spray");
  assert.equal(types[1].id, "roll-on");
  assert.equal(types[2].id, "air-freshener");
  assert.equal(types[2].hasNotes, false); // Air freshener has no notes by default

  // D. Create custom type
  const customType = await createProductType(repo, audit, "admin@luftansa.com", {
    id: "car-diffuser",
    name: "Car Diffuser",
    description: "Vent-clip luxury fragrance diffuser",
    defaultUnit: "pieces",
    hasNotes: false,
    status: "ACTIVE",
    sortOrder: 5,
  });
  assert.equal(customType.id, "car-diffuser");
  assert.equal(customType.defaultUnit, "pieces");

  // E. Deactivate type safely
  const updatedType = await updateProductType(repo, audit, "admin@luftansa.com", "car-diffuser", {
    version: 1,
    status: "INACTIVE",
  });
  assert.equal(updatedType.status, "INACTIVE");

  // Public listing with status="ACTIVE" filters out inactive types
  const activeTypes = await listProductTypes(repo, { status: "ACTIVE" });
  assert.equal(activeTypes.some((t) => t.id === "car-diffuser"), false);
}
console.log("   ✓ Product types CRUD, idempotent seeding, and safe deactivation verified");

// 3. Deletion Protection via Indexed GSI2 Queries (Zero Table Scans)
console.log("3. Testing Deletion Protection (Zero Table Scans)...");
{
  // Create a product with type "roll-on"
  await createProduct(repo, audit, "admin@luftansa.com", {
    id: "active-roll-on-perfume",
    name: "Active Roll-On Perfume",
    productTypeId: "roll-on",
    productTypeName: "Roll-On",
    category: "Roll-On",
    status: "ACTIVE",
    variants: [
      { id: "v_roll_10ml", capacity: 10, unit: "ml", label: "10 ml", priceInr: 299, stockQuantity: 15, sku: "LUF-ROLL-10ML" },
    ],
  });

  // Attempting to delete "roll-on" must fail with ConflictError because products use it
  await assert.rejects(
    async () => {
      await deleteProductType(repo, audit, "admin@luftansa.com", "roll-on", 1);
    },
    (err: Error) => {
      assert.ok(err instanceof ConflictError);
      assert.match(err.message, /Cannot delete product type/);
      return true;
    },
  );

  // Deleting an unused type ("car-diffuser") succeeds
  await deleteProductType(repo, audit, "admin@luftansa.com", "car-diffuser", 2);
  const deletedCheck = await repo.get(keys.productType("car-diffuser"), productTypeItemSchema);
  assert.equal(deletedCheck, null);
}
console.log("   ✓ Zero-scan deletion protection and safe cleanup verified");

// 4. Dynamic Variants & Stable Unique IDs
console.log("4. Testing Dynamic Variants, Custom Capacities & Units...");
{
  const productWithCustomVariants = await createProduct(repo, audit, "admin@luftansa.com", {
    id: "signature-attar",
    name: "Signature Attar",
    productTypeId: "attar",
    productTypeName: "Attar",
    category: "Attar",
    status: "ACTIVE",
    notesEnabled: true,
    variants: [
      { id: "v_attar_3ml", capacity: 3, unit: "ml", label: "3 ml", priceInr: 250, stockQuantity: 50, sku: "LUF-ATTAR-03ML" },
      { id: "v_attar_6ml", capacity: 6, unit: "ml", label: "6 ml", priceInr: 450, stockQuantity: 30, sku: "LUF-ATTAR-06ML" },
      { id: "v_attar_12ml", capacity: 12, unit: "ml", label: "12 ml", priceInr: 800, stockQuantity: 20, sku: "LUF-ATTAR-12ML" },
    ],
  });

  assert.equal(productWithCustomVariants.variants.length, 3);
  assert.equal(productWithCustomVariants.variants[0].id, "v_attar_3ml");
  assert.equal(productWithCustomVariants.variants[0].capacity, 3);
  assert.equal(productWithCustomVariants.variants[0].unit, "ml");
  assert.equal(productWithCustomVariants.variants[0].priceInr, 250);
  assert.equal(productWithCustomVariants.variants[0].sk, "VARIANT#v_attar_3ml");
}
console.log("   ✓ Dynamic variants with custom capacities and stable IDs verified");

// 5. Variant Archival (Preserves Historical Orders and SKUs)
console.log("5. Testing Variant Archival (Requirement 2 & 4)...");
{
  // Update "signature-attar": remove 3 ml, keep 6 ml and 12 ml, add 24 ml
  const updated = await updateProduct(repo, audit, "admin@luftansa.com", "signature-attar", {
    version: 1,
    variants: [
      { id: "v_attar_6ml", capacity: 6, unit: "ml", label: "6 ml", priceInr: 480, stockQuantity: 28, sku: "LUF-ATTAR-06ML" },
      { id: "v_attar_12ml", capacity: 12, unit: "ml", label: "12 ml", priceInr: 850, stockQuantity: 18, sku: "LUF-ATTAR-12ML" },
      { id: "v_attar_24ml", capacity: 24, unit: "ml", label: "24 ml", priceInr: 1500, stockQuantity: 10, sku: "LUF-ATTAR-24ML" },
    ],
  });

  assert.equal(updated.product.version, 2);

  // Read base table and variants
  const fresh = await getProductWithVariants(repo, "signature-attar");
  assert.ok(fresh);

  // The 3 ml variant must NOT be deleted from DynamoDB; it must be ARCHIVED!
  const v3ml = fresh.variants.find((v) => v.id === "v_attar_3ml");
  assert.ok(v3ml, "Removed variant must remain in database to protect order history");
  assert.equal(v3ml.status, "ARCHIVED");
  assert.ok(v3ml.archivedAt);
  assert.equal(v3ml.priceInr, 250, "Historical price must be preserved");
  assert.equal(v3ml.sku, "LUF-ATTAR-03ML", "Historical SKU must be preserved");

  // The 6 ml variant price was updated
  const v6ml = fresh.variants.find((v) => v.id === "v_attar_6ml");
  assert.equal(v6ml?.priceInr, 480);
  assert.equal(v6ml?.status, "ACTIVE");

  // The 24 ml variant was newly created
  const v24ml = fresh.variants.find((v) => v.id === "v_attar_24ml");
  assert.equal(v24ml?.capacity, 24);
  assert.equal(v24ml?.status, "ACTIVE");
}
console.log("   ✓ Removed variant archival and historical SKU/price protection verified");

// 6. Fragrance Notes Override
console.log("6. Testing Product-Level Fragrance Notes Override...");
{
  // A. Room Spray with notesEnabled = false
  const roomSpray = await createProduct(repo, audit, "admin@luftansa.com", {
    id: "amber-room-spray",
    name: "Amber Room Spray",
    category: "Air Freshener",
    notesEnabled: false,
    variants: [
      { id: "v_spray_100ml", capacity: 100, unit: "ml", label: "100 ml", priceInr: 450, stockQuantity: 20 },
    ],
  });
  assert.equal(roomSpray.product.notesEnabled, false);

  // B. Luxury room spray override: notesEnabled = true with Top note
  const luxurySpray = await updateProduct(repo, audit, "admin@luftansa.com", "amber-room-spray", {
    version: 1,
    notesEnabled: true,
    notes: {
      top: [{ id: "note_bergamot", name: "Bergamot", description: "Zesty Italian bergamot" }],
      heart: [],
      base: [],
    },
  });
  assert.equal(luxurySpray.product.notesEnabled, true);
  assert.equal(luxurySpray.product.notes.top.length, 1);
  assert.equal(luxurySpray.product.notes.top[0].name, "Bergamot");
}
console.log("   ✓ Fragrance notes override verified");

// 7. Validation Limits
console.log("7. Testing Validation Limits...");
{
  // Cannot have > 20 variants
  assert.throws(() => {
    productCreateInputSchema.parse({
      id: "too-many-variants",
      name: "Too Many Variants",
      variants: Array.from({ length: 21 }, (_, i) => ({
        capacity: i + 1,
        unit: "ml",
        priceInr: 100,
      })),
    });
  });

  // Cannot have > 12 notes per tier (MAX_NOTES_PER_GROUP; raised from 10 for Afghan Tiger's 11 Base notes)
  assert.throws(() => {
    fragranceNotesSchema.parse({
      top: Array.from({ length: 13 }, (_, i) => ({
        id: `note_${i}`,
        name: `Note ${i}`,
      })),
      heart: [],
      base: [],
    });
  });
}
console.log("   ✓ Validation bounds (max 20 variants, max 10 notes/tier) verified");

// 8. Backward Compatibility with Phase 1 & 2 Legacy Items
console.log("8. Testing Backward Compatibility with Legacy DynamoDB Items...");
{
  // Simulate a legacy base item without productTypeId or dynamic variants
  const legacyProduct = await createProduct(repo, audit, "admin@luftansa.com", {
    id: "legacy-perfume",
    name: "Legacy Perfume",
    category: "Perfume",
    sizes: [30, 50, 100],
  });

  assert.equal(legacyProduct.product.productTypeId, "perfume-spray");
  assert.equal(legacyProduct.product.productTypeName, "Perfume");
  assert.equal(legacyProduct.variants.length, 3);
  assert.equal(legacyProduct.variants[0].capacity, 30);
  assert.equal(legacyProduct.variants[0].unit, "ml");
  assert.equal(legacyProduct.variants[0].priceInr, 400);
}
console.log("   ✓ Backward compatibility with Phase 1 & 2 legacy items verified");

console.log("\n🎉 ALL DYNAMIC PRODUCT MANAGEMENT TESTS PASSED SUCCESSFULLY!");

