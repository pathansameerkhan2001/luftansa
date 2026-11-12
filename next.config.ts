import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

// Optional CloudFront (or other CDN) origin for S3 assets. Server-side only.
const cdnPatterns: RemotePattern[] = [];
if (process.env.ASSET_CDN_URL) {
  const { protocol, hostname } = new URL(process.env.ASSET_CDN_URL);
  cdnPatterns.push({ protocol: protocol.replace(":", "") as "http" | "https", hostname });
}

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: cdnPatterns,
    // Cache optimized variants for a day; source objects rarely change.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
