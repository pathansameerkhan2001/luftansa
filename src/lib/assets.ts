import "server-only";

import { deploymentEnv } from "@/lib/runtime/preview-isolation";

/**
 * Asset URL resolution (server only).
 *
 * - If ASSET_CDN_URL is set (e.g. a CloudFront distribution using Origin Access
 *   Control in front of the private bucket), assets resolve to that CDN.
 * - Otherwise they resolve to the same-origin `/media/<key>` route, which reads
 *   the private object from S3 with server-side credentials.
 *
 * Either way, the S3 bucket itself stays private.
 */
export const MEDIA_ROUTE_PREFIX = "/media";

export function getAssetUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, "");
  const encoded = cleanKey.split("/").map(encodeURIComponent).join("/");
  // A CDN is only used in production. Locally every asset comes from /media
  // (the local media folder); on a Vercel Preview from /media too (its own
  // Preview bucket), never from the production CDN.
  const cdn = deploymentEnv() === "production" ? process.env.ASSET_CDN_URL?.trim().replace(/\/+$/, "") : undefined;
  return cdn ? `${cdn}/${encoded}` : `${MEDIA_ROUTE_PREFIX}/${encoded}`;
}

/** Brand assets with their intrinsic dimensions (prevents layout shift). */
export const BRAND_ASSETS = {
  logo: {
    key: "logo/logo.jpeg",
    width: 1183,
    height: 1600,
    alt: "Luftansa Fragrance Craft Hub",
  },
} as const;
