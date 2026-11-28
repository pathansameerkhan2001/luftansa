/**
 * next/image loader (next.config.ts → images.loaderFile), used for every
 * <Image> and getImageProps() on the site, in the browser and on the server.
 *
 * Images are no longer sent through Vercel's metered Image Optimization
 * (/_next/image). Once a plan's allowance is used up Vercel refuses those
 * requests (402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED, and a "Page not
 * found" response for same-site /media images), which broke the hero and
 * product images in production. Instead:
 *
 *   - /media/<key> (hero, product, CMS uploads): the site's own media route
 *     resizes it, /media/<key>?w=<width>&q=<quality> (WebP, cached by the CDN);
 *   - images.unsplash.com / images.pexels.com: their own free resizing CDN;
 *   - anything else (cdn.pixabay.com, files in /public, an asset CDN): as is.
 */
import { snapQuality, snapWidth } from "./media/image-variants";

type LoaderProps = { src: string; width: number; quality?: number };

export default function luftansaImageLoader({ src, width, quality }: LoaderProps): string {
  const w = snapWidth(width);
  const q = snapQuality(quality);

  if (src.startsWith("/media/")) {
    const [path] = src.split("?");
    return `${path}?w=${w}&q=${q}`;
  }

  if (/^https?:\/\//i.test(src)) {
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return src;
    }
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", String(w));
      url.searchParams.set("q", String(q));
      url.searchParams.set("auto", "format");
      return url.toString();
    }
    if (url.hostname === "images.pexels.com") {
      url.searchParams.set("w", String(w));
      url.searchParams.set("auto", "compress");
      url.searchParams.set("cs", "tinysrgb");
      url.searchParams.delete("dpr");
      return url.toString();
    }
    return src;
  }

  // Files in /public and imported static images: served as they are. The width
  // is kept in the address so each srcset entry stays distinct (files ignore it).
  return `${src}${src.includes("?") ? "&" : "?"}w=${w}`;
}
