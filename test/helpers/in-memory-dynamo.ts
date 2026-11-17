/** In-memory DynamoDB document client fake (shared by tests). Mirrors test/dynamic-product-management.test.ts. */
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

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

export class InMemoryDynamoClient {
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
      // Optimistic concurrency (Repository.replace), as DynamoDB evaluates it.
      if (cond?.includes("attribute_exists(pk) AND #v = :expected")) {
        if (!existing || existing.version !== command.input.ExpressionAttributeValues?.[":expected"]) {
          throw new ConditionalFailure("Version mismatch");
        }
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
      const existingItem = this.tables.get(tName)?.get(keyStr);
      const delCond = command.input.ConditionExpression;
      if (delCond?.includes("attribute_exists(pk)") && !existingItem) throw new ConditionalFailure("Item not found");
      if (delCond?.includes("#v = :expected") && existingItem?.version !== command.input.ExpressionAttributeValues?.[":expected"]) {
        throw new ConditionalFailure("Version mismatch");
      }
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

  /** Test helper: snapshot of every stored item. */
  dump(tableName: string): Record<string, unknown>[] {
    return Array.from(this.tables.get(tableName)?.values() ?? []).map((i) => JSON.parse(JSON.stringify(i)));
  }
}
