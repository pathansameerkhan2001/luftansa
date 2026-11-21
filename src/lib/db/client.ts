import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsCredentials, oidcRoleCredentials } from "../aws/credentials";
import { AuditService } from "./audit";
import { getDbConfig } from "./config";
import { Repository } from "./repository";
import { resolveDbTarget } from "./target";

let documentClient: DynamoDBDocumentClient | null = null;

/**
 * Server-only DynamoDB document client, or null when no database is available.
 * Locally this only ever connects to a localhost DynamoDB Local endpoint with
 * dummy credentials; a Vercel Preview only to its Preview table through its
 * OIDC role (see ./target.ts). Production is unchanged.
 */
export function getDocumentClient(): DynamoDBDocumentClient | null {
  const config = getDbConfig();
  if (!config) return null;
  const target = resolveDbTarget();
  if (target.kind === "disabled") return null;
  if (!documentClient) {
    const client =
      target.kind === "local"
        ? new DynamoDBClient({ region: config.region, endpoint: target.endpoint, credentials: target.credentials, maxAttempts: 2 })
        : target.kind === "preview"
          ? new DynamoDBClient({ region: config.region, credentials: oidcRoleCredentials(target.roleArn), maxAttempts: 3 })
          : new DynamoDBClient({ region: config.region, credentials: awsCredentials(), maxAttempts: 3 });
    documentClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false },
    });
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
