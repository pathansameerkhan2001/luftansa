import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

// Optional CloudFront (or other CDN) origin for S3 assets. Server-side only.
const cdnPatterns: RemotePattern[] = [
  // Interim hero photography (Unsplash License) until Luftansa photos are in S3.
  { protocol: "https", hostname: "images.unsplash.com" },
  // Fragrance-note ingredient photography (Pexels / Pixabay licences), src/data/fragrance-profiles.ts.
  { protocol: "https", hostname: "images.pexels.com", pathname: "/photos/**" },
  { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/photo/**" },
];
if (process.env.ASSET_CDN_URL) {
  const { protocol, hostname } = new URL(process.env.ASSET_CDN_URL);
  cdnPatterns.push({ protocol: protocol.replace(":", "") as "http" | "https", hostname });
}

const nextConfig: NextConfig = {
  images: {
    // Every image goes through src/lib/image-loader.ts (our own /media resizing
    // and the photo CDNs' resizing) instead of Vercel's metered optimizer.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    formats: ["image/avif", "image/webp"],
    remotePatterns: cdnPatterns,
    // Cache optimized variants for a day; source objects rarely change.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
