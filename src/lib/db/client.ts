import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsCredentials } from "../aws/credentials";
import { AuditService } from "./audit";
import { getDbConfig } from "./config";
import { Repository } from "./repository";

let documentClient: DynamoDBDocumentClient | null = null;

/** Server-only DynamoDB document client (null when DYNAMODB_TABLE/region are not configured). */
export function getDocumentClient(): DynamoDBDocumentClient | null {
  const config = getDbConfig();
  if (!config) return null;
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: config.region, credentials: awsCredentials(), maxAttempts: 3 }),
      { marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false } },
    );
  }
  return documentClient;
}

export interface DataServices {
  repo: Repository;
  audit: AuditService;
}

/** Repository + audit services, or null if the database is not configured. */
export function getDataServices(): DataServices | null {
  const config = getDbConfig();
  const client = getDocumentClient();
  if (!config || !client) return null;
  const repo = new Repository(client, config.tableName);
  return { repo, audit: new AuditService(repo) };
}
