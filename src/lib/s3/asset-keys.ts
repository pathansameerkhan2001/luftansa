/**
 * Object-key rules shared by the server and the admin client (no I/O, no
 * secrets, so it is safe to import from client components and CMS schemas).
 */

/**
 * Top-level folders in the bucket that the site is allowed to serve.
 * Anything outside these prefixes is never exposed, even through the media route.
 */
export const S3_ASSET_FOLDERS = [
  "logo/",
  "hero/",
  "products/",
  "categories/",
  "banners/",
  "about/",
  "general/",
  "reels/thumbnails/",
  "reels/videos/",
  // CMS media (Phase 3)
  "videos/",
  "lab/",
  "manufacturing/",
  "cms/",
] as const;

export type S3AssetFolder = (typeof S3_ASSET_FOLDERS)[number];

/**
 * Validates an object key: must sit inside an allowlisted folder and must not
 * contain traversal segments, backslashes, or point at a "folder" placeholder.
 */
export function isAllowedAssetKey(key: string): boolean {
  if (!key || key.length > 512 || key.endsWith("/") || key.includes("\\")) return false;
  if (key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return false;
  return S3_ASSET_FOLDERS.some((folder) => key.startsWith(folder));
}
