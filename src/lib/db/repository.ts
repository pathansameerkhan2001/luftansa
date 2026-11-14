/**
 * Generic DynamoDB repository (server-only use).
 * - Validates every item with Zod before writes and after reads.
 * - create(): conditional put, never overwrites an existing item.
 * - replace(): optimistic concurrency on `version`.
 * - remove(): optional version check.
 * - query(): partition query with optional sort-key prefix and opaque cursor.
 * The DynamoDB document client is injected (real client in production, an
 * in-memory fake in tests), so this module performs no I/O by itself.
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import type { ItemKey } from "./keys";
import type { BaseItem } from "./schemas";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}
export class ValidationError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super("Validation failed");
  }
}

type Sender = Pick<DynamoDBDocumentClient, "send">;

function toValidationError(error: z.ZodError): ValidationError {
  return new ValidationError(error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
}

function isConditionalFailure(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "ConditionalCheckFailedException";
}

function isTransactionConditionalFailure(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  return (e as { name?: string }).name === "TransactionCanceledException";
}

export interface TransactPutOperation<T extends BaseItem = BaseItem> {
  type: "put";
  item: T;
  schema: z.ZodType<T>;
  condition?: "not_exists" | "exists_version";
  expectedVersion?: number;
}

export interface TransactDeleteOperation {
  type: "delete";
  key: ItemKey;
  condition?: "exists" | "exists_version";
  expectedVersion?: number;
}

export type TransactOperation = TransactPutOperation<BaseItem> | TransactDeleteOperation;

const CURSOR = /^[A-Za-z0-9_-]{1,2048}$/;

export function encodeCursor(key: Record<string, unknown> | undefined): string | undefined {
  return key ? Buffer.from(JSON.stringify(key)).toString("base64url") : undefined;
}

export function decodeCursor(cursor: string | undefined, expectedPk?: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  if (!CURSOR.test(cursor)) throw new ValidationError([{ path: "cursor", message: "Invalid cursor" }]);
  try {
    const key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    // When expectedPk is specified, ensure partition matches.
    if (expectedPk && (key.pk !== expectedPk || typeof key.sk !== "string")) throw new Error("mismatch");
    return key;
  } catch {
    throw new ValidationError([{ path: "cursor", message: "Invalid cursor" }]);
  }
}

export class Repository {
  constructor(
    private readonly client: Sender,
    private readonly tableName: string,
  ) {}

  async get<S extends z.ZodType<BaseItem>>(key: ItemKey, schema: S): Promise<z.infer<S> | null> {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }));
    if (!Item) return null;
    const parsed = schema.safeParse(Item);
    if (!parsed.success) throw toValidationError(parsed.error);
    return parsed.data;
  }

  /** Creates a new item; fails with ConflictError if the key already exists. */
  async create<S extends z.ZodType<BaseItem>>(item: z.input<S>, schema: S): Promise<z.infer<S>> {
    const parsed = schema.safeParse(item);
    if (!parsed.success) throw toValidationError(parsed.error);
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: parsed.data as Record<string, unknown>,
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
    } catch (e) {
      if (isConditionalFailure(e)) throw new ConflictError("Item already exists");
      throw e;
    }
    return parsed.data;
  }

  /**
   * Replaces an item if its stored version still equals `expectedVersion`
   * (optimistic concurrency). The new version is expectedVersion + 1.
   */
  async replace<S extends z.ZodType<BaseItem>>(item: z.input<S>, schema: S, expectedVersion: number): Promise<z.infer<S>> {
    const parsed = schema.safeParse({ ...(item as object), version: expectedVersion + 1, updatedAt: new Date().toISOString() });
    if (!parsed.success) throw toValidationError(parsed.error);
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: parsed.data as Record<string, unknown>,
          ConditionExpression: "attribute_exists(pk) AND #v = :expected",
          ExpressionAttributeNames: { "#v": "version" },
          ExpressionAttributeValues: { ":expected": expectedVersion },
        }),
      );
    } catch (e) {
      if (isConditionalFailure(e)) throw new ConflictError("Item was changed by someone else or no longer exists");
      throw e;
    }
    return parsed.data;
  }

  async remove(key: ItemKey, expectedVersion?: number): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: key,
          ...(expectedVersion === undefined
            ? { ConditionExpression: "attribute_exists(pk)" }
            : {
                ConditionExpression: "attribute_exists(pk) AND #v = :expected",
                ExpressionAttributeNames: { "#v": "version" },
                ExpressionAttributeValues: { ":expected": expectedVersion },
              }),
        }),
      );
    } catch (e) {
      if (isConditionalFailure(e)) throw expectedVersion === undefined ? new NotFoundError("Item not found") : new ConflictError("Version mismatch");
      throw e;
    }
  }

  async query<S extends z.ZodType<BaseItem>>(
    pk: string,
    schema: S,
    options: { skPrefix?: string; limit?: number; cursor?: string; newestFirst?: boolean } = {},
  ): Promise<{ items: z.infer<S>[]; cursor?: string }> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: options.skPrefix ? "pk = :pk AND begins_with(sk, :prefix)" : "pk = :pk",
        ExpressionAttributeValues: options.skPrefix ? { ":pk": pk, ":prefix": options.skPrefix } : { ":pk": pk },
        Limit: limit,
        ScanIndexForward: !options.newestFirst,
        ExclusiveStartKey: decodeCursor(options.cursor, pk),
      }),
    );
    const items = (res.Items ?? []).map((raw) => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw toValidationError(parsed.error);
      return parsed.data;
    });
    return { items, cursor: encodeCursor(res.LastEvaluatedKey) };
  }

  /**
   * Performs an indexed query against a Global Secondary Index (e.g. GSI1 or GSI2).
   * Strictly uses QueryCommand with IndexName to avoid table scans.
   */
  async queryIndex<S extends z.ZodType<BaseItem>>(
    indexName: "GSI1" | "GSI2",
    partitionKeyName: "GSI1PK" | "GSI2PK",
    partitionKeyValue: string,
    schema: S,
    options: {
      sortKeyName?: "GSI1SK" | "GSI2SK";
      sortKeyPrefix?: string;
      limit?: number;
      cursor?: string;
      scanIndexForward?: boolean;
    } = {},
  ): Promise<{ items: z.infer<S>[]; cursor?: string }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const keyCond =
      options.sortKeyName && options.sortKeyPrefix
        ? `${partitionKeyName} = :pk AND begins_with(${options.sortKeyName}, :prefix)`
        : `${partitionKeyName} = :pk`;
    const exprValues: Record<string, unknown> = { ":pk": partitionKeyValue };
    if (options.sortKeyName && options.sortKeyPrefix) {
      exprValues[":prefix"] = options.sortKeyPrefix;
    }

    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCond,
        ExpressionAttributeValues: exprValues,
        Limit: limit,
        ScanIndexForward: options.scanIndexForward ?? true,
        ExclusiveStartKey: decodeCursor(options.cursor),
      }),
    );

    const items = (res.Items ?? []).map((raw) => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw toValidationError(parsed.error);
      return parsed.data;
    });
    return { items, cursor: encodeCursor(res.LastEvaluatedKey) };
  }

  /**
   * Executes atomic writes across up to 100 items using DynamoDB TransactWriteItems.
   * Ensures all items succeed or all fail together (ACID).
   */
  async transactWrite(operations: TransactOperation[]): Promise<void> {
    if (operations.length === 0) return;
    if (operations.length > 100) {
      throw new ValidationError([{ path: "operations", message: "Transaction limit exceeded (max 100 items)" }]);
    }

    const transactItems = operations.map((op) => {
      if (op.type === "put") {
        const parsed = op.schema.safeParse(op.item);
        if (!parsed.success) throw toValidationError(parsed.error);

        let ConditionExpression: string | undefined;
        let ExpressionAttributeNames: Record<string, string> | undefined;
        let ExpressionAttributeValues: Record<string, unknown> | undefined;

        if (op.condition === "not_exists") {
          ConditionExpression = "attribute_not_exists(pk)";
        } else if (op.condition === "exists_version") {
          ConditionExpression = "attribute_exists(pk) AND #v = :expected";
          ExpressionAttributeNames = { "#v": "version" };
          ExpressionAttributeValues = { ":expected": op.expectedVersion };
        }

        return {
          Put: {
            TableName: this.tableName,
            Item: parsed.data as Record<string, unknown>,
            ConditionExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
          },
        };
      }

      if (op.type === "delete") {
        let ConditionExpression: string | undefined;
        let ExpressionAttributeNames: Record<string, string> | undefined;
        let ExpressionAttributeValues: Record<string, unknown> | undefined;

        if (op.condition === "exists") {
          ConditionExpression = "attribute_exists(pk)";
        } else if (op.condition === "exists_version") {
          ConditionExpression = "attribute_exists(pk) AND #v = :expected";
          ExpressionAttributeNames = { "#v": "version" };
          ExpressionAttributeValues = { ":expected": op.expectedVersion };
        }

        return {
          Delete: {
            TableName: this.tableName,
            Key: op.key,
            ConditionExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
          },
        };
      }

      throw new Error(`Unknown transaction operation`);
    });

    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (e) {
      if (isTransactionConditionalFailure(e)) {
        throw new ConflictError("Transaction cancelled due to conditional check failure (conflict or missing item)");
      }
      throw e;
    }
  }
}
