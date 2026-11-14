import "server-only";

import { cookies } from "next/headers";
import { getAuthConfig } from "./config";
import { cookieNames } from "./cookies";
import { readSession, type AdminSession } from "./session";

/**
 * Server Component / Server Action check (defence in depth behind the
 * middleware). Read-only: refreshing happens in middleware.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  let config;
  try {
    config = getAuthConfig();
  } catch {
    return null;
  }
  const jar = await cookies();
  return readSession(config, jar.get(cookieNames(config).session)?.value);
}
