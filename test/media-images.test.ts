import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import loader from "@/lib/image-loader";
import { IMAGE_QUALITIES, IMAGE_WIDTHS, parseVariantRequest, snapQuality, snapWidth } from "@/lib/media/image-variants";
import { resizeToWebp, serveMediaVariant } from "@/lib/media/resize";
import { LocalMediaStorage } from "@/lib/media/storage";

const read = (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

console.log("--- Testing media images (own resizing instead of Vercel Image Optimization) ---");

console.log("1. next/image loader...");
{
  const key = "/media/hero/2026-11/1795417307987-luftansa-luxury-perfume-collection-1-.png";
  assert.equal(loader({ src: key, width: 1080, quality: 80 }), `${key}?w=1080&q=80`, "uploaded media: own resizing route, same key");
  assert.equal(loader({ src: key, width: 1000 }), `${key}?w=1080&q=75`, "width snapped up, default quality");
  assert.equal(loader({ src: "/media/products/a%20b/main/x.png", width: 96, quality: 50 }), "/media/products/a%20b/main/x.png?w=96&q=50", "encoded keys kept");
  const u = new URL(loader({ src: "https://images.unsplash.com/photo-1?w=320&q=75&fm=jpg&fit=crop", width: 256, quality: 75 }));
  assert.equal(u.hostname, "images.unsplash.com");
  assert.deepEqual([u.searchParams.get("w"), u.searchParams.get("fit"), u.searchParams.get("auto")], ["256", "crop", "format"], "Unsplash resizes itself");
  const p = new URL(loader({ src: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", width: 128 }));
  assert.deepEqual([p.searchParams.get("w"), p.searchParams.get("dpr")], ["128", null], "Pexels resizes itself");
  const px = "https://cdn.pixabay.com/photo/2019/07/19/03/44/bergamot-4347906_640.jpg";
  assert.equal(loader({ src: px, width: 96 }), px, "other hosts: unchanged");
  assert.equal(loader({ src: "/images/x.jpg", width: 640 }), "/images/x.jpg?w=640", "public files: unchanged path");
  for (const src of [key, "https://images.unsplash.com/photo-1?w=1", "/images/x.jpg"]) assert.ok(!loader({ src, width: 640 }).includes("/_next/image"), "never Vercel Image Optimization");
  // Every address the loader can produce for /media is accepted by the route.
  for (const w of [1, 15, 16, 17, 500, 3840, 5000]) for (const q of [undefined, 1, 50, 55, 75, 80, 100]) {
    const out = new URL(loader({ src: "/media/logo/logo.jpeg", width: w, quality: q }), "https://x.test");
    assert.equal(parseVariantRequest(out.searchParams).kind, "variant", `w=${w} q=${q} accepted by the route`);
  }
  const config = await read("next.config.ts");
  assert.match(config, /loader: "custom"/);
  assert.match(config, /loaderFile: "\.\/src\/lib\/image-loader\.ts"/);
  console.log("   ✓ /media via own resizing; Unsplash/Pexels via their CDN; others unchanged; never /_next/image");
}

console.log("2. Allowed sizes...");
{
  assert.equal(snapWidth(1), 16);
  assert.equal(snapWidth(3840), 3840);
  assert.equal(snapWidth(9999), 3840);
  assert.equal(snapQuality(77), 75);
  assert.equal(snapQuality(undefined), 75);
  const p = (s: string) => parseVariantRequest(new URLSearchParams(s));
  assert.deepEqual(p(""), { kind: "original" }, "no w: the stored file");
  assert.deepEqual(p("w=640&q=80"), { kind: "variant", width: 640, quality: 80 });
  assert.deepEqual(p("w=640"), { kind: "variant", width: 640, quality: 75 });
  for (const bad of ["w=641", "w=640&q=81", "q=75", "w=abc", "w=-16", "w=1e3"]) assert.equal(p(bad).kind, "invalid", `${bad} rejected`);
  assert.equal(IMAGE_WIDTHS.length * IMAGE_QUALITIES.length, 144, "bounded number of variants per image");
  console.log("   ✓ widths and qualities bounded; unknown sizes rejected");
}

console.log("3. Resizing and serving...");
{
  const png = await sharp({ create: { width: 1254, height: 1254, channels: 3, background: { r: 200, g: 160, b: 90 } } }).png().toBuffer();
  const small = await resizeToWebp(png, 256, 75);
  const meta = await sharp(small).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 256, 256], "resized to the requested width, WebP, aspect kept");
  const big = await sharp(await resizeToWebp(png, 3840, 80)).metadata();
  assert.equal(big.width, 1254, "never enlarged");

  const root = await mkdtemp(path.join(tmpdir(), "luftansa-media-"));
  try {
    const storage = new LocalMediaStorage(root);
    const put = async (key: string, data: Uint8Array) => {
      await mkdir(path.dirname(path.join(root, key)), { recursive: true });
      await writeFile(path.join(root, key), data);
    };
    const key = "products/ambery-nights/main/1795762928650-luftansa_ambery_nights_1254x1254.png";
    await put(key, png);
    await put("reels/videos/clip.mp4", new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]));
    await put("products/broken/main/broken.png", new TextEncoder().encode("not an image"));
    const get = (k: string, v = { width: 640, quality: 75 }, init?: RequestInit) => serveMediaVariant(new Request(`https://x.test/media/${k}`, init), k, storage, v);

    const r = await get(key);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/webp");
    assert.match(r.headers.get("cache-control") ?? "", /s-maxage=86400/, "CDN-cacheable");
    const body = new Uint8Array(await r.arrayBuffer());
    assert.equal(Number(r.headers.get("content-length")), body.byteLength);
    assert.ok(body.byteLength < png.byteLength, "smaller than the stored file");
    assert.equal((await sharp(body).metadata()).width, 640);
    const etag = r.headers.get("etag")!;
    assert.ok(etag, "ETag");
    assert.equal((await get(key, undefined, { headers: { "if-none-match": etag } })).status, 304, "conditional request");
    const head = await get(key, undefined, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0, "HEAD has no body");

    assert.equal((await get("products/missing/main/x.png")).status, 404, "missing file: 404");
    assert.equal((await get("../secret.png")).status, 404, "keys outside the media folders refused");
    assert.equal((await serveMediaVariant(new Request("https://x.test/"), key, null, { width: 640, quality: 75 })).status, 404, "no storage: 404");
    const video = await get("reels/videos/clip.mp4");
    assert.deepEqual([video.status, video.headers.get("content-type")], [200, "video/mp4"], "videos served as stored");
    const broken = await get("products/broken/main/broken.png");
    assert.deepEqual([broken.status, broken.headers.get("content-type")], [200, "image/png"], "unreadable image: stored file, never an error");
    assert.equal((await storage.head(key))!.size, png.byteLength, "stored file unchanged");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  const route = await read("src/app/media/[...key]/route.ts");
  assert.match(route, /status: 400/, "unsupported sizes: 400");
  console.log("   ✓ WebP at the requested width, no enlargement, cacheable, 304/HEAD, 404s, videos and unreadable files as stored");
}

console.log("--- Media image tests passed ---");
