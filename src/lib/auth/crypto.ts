/**
 * Crypto helpers (Web Crypto: works in Node route handlers and Edge middleware).
 * Auth cookies are sealed as compact JWE (dir + A256GCM) with a key derived
 * from AUTH_SECRET, so cookie contents are both confidential and tamper-proof.
 */
import { base64url, EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<Uint8Array>>();

function encryptionKey(secret: string): Promise<Uint8Array> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle
      .digest("SHA-256", encoder.encode(`luftansa-auth-cookie:${secret}`))
      .then((buf) => new Uint8Array(buf));
    keyCache.set(secret, key);
  }
  return key;
}

/** Cryptographically random URL-safe string (`bytes` of entropy). */
export function randomToken(bytes = 32): string {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** PKCE S256 challenge for a code verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64url.encode(new Uint8Array(digest));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function seal(payload: JWTPayload, secret: string, ttlSeconds: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(await encryptionKey(secret));
}

/** Returns the payload, or null if the value is missing, tampered with or expired. */
export async function unseal<T extends JWTPayload>(value: string | undefined, secret: string): Promise<T | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, await encryptionKey(secret));
    return payload as T;
  } catch {
    return null;
  }
}
