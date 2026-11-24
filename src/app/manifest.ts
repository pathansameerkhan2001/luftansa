import type { MetadataRoute } from "next";
import { STORE_NAME } from "@/data/store";

/** Web app manifest: name, brand colours and the hummingbird icons (Add to Home Screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: STORE_NAME,
    short_name: "Luftansa",
    description: "Luxury fragrances crafted by Luftansa Fragrance Craft Hub.",
    start_url: "/",
    display: "browser",
    background_color: "#fffdf8",
    theme_color: "#fffdf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
