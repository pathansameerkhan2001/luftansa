import "server-only";

import { awsCredentialsProvider } from "@vercel/functions/oidc";

/**
 * AWS credentials for server-side SDK clients. Never imported by client code.
 *
 * - On Vercel with AWS_ROLE_ARN set: short-lived credentials via Vercel OIDC
 *   (AssumeRoleWithWebIdentity). No long-lived keys required.
 * - Otherwise: `undefined`, so the AWS SDK default chain is used (existing
 *   AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars, or a local CLI profile).
 *
 * Phase 1 only prepares this. Existing keys keep working until the OIDC role
 * is created and approved (see docs/aws-oidc-setup.md).
 */
export type AwsCredentialMode = "vercel-oidc" | "default-chain";

export function awsCredentialMode(): AwsCredentialMode {
  return process.env.AWS_ROLE_ARN?.trim() ? "vercel-oidc" : "default-chain";
}

export function awsCredentials() {
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  if (!roleArn) return undefined;
  return awsCredentialsProvider({ roleArn, roleSessionName: "luftansa-app" });
}

/**
 * Credentials from one specific OIDC role, never the default chain (used by
 * Vercel Preview, which must not pick up long-lived keys from the environment).
 */
export function oidcRoleCredentials(roleArn: string) {
  return awsCredentialsProvider({ roleArn, roleSessionName: "luftansa-preview" });
}
