import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { runtimeMode } from "@/lib/runtime/mode";
import { getS3Client, getS3Config, isAllowedAssetKey } from "@/lib/s3";
import type { ByteRange } from "./range";

/**
 * Media storage behind /media/<key> and the admin upload/delete APIs.
 *
 * - production (Vercel): the private S3 bucket.
 * - local: a folder on disk (LOCAL_MEDIA_DIR). Local uploads can never reach
 *   the production bucket: the S3 client refuses to exist outside production
 *   (src/lib/s3/client.ts), and this module never selects it locally.
 */
export interface StoredObjectInfo {
  size: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
}

export interface ReadResult extends StoredObjectInfo {
  body: ReadableStream<Uint8Array>;
}

export interface MediaStorage {
  readonly kind: "s3" | "local";
  head(key: string): Promise<StoredObjectInfo | null>;
  /** Reads the whole object, or the inclusive byte range when given. */
  read(key: string, range?: ByteRange): Promise<ReadResult | null>;
  write(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** Permanently deletes the object. Only the explicit Media Library deletion workflow calls this. */
  remove(key: string): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export function contentTypeForKey(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

function assertKey(key: string) {
  if (!isAllowedAssetKey(key)) throw new Error("Asset key not allowed");
}

/* ------------------------------------------------------------------ local --- */

export class LocalMediaStorage implements MediaStorage {
  readonly kind = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Resolves a key inside the root; anything escaping it is rejected. */
  resolve(key: string): string {
    assertKey(key);
    const full = path.resolve(this.root, ...key.split("/"));
    if (!full.startsWith(this.root + path.sep)) throw new Error("Asset key escapes the media root");
    return full;
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const s = await stat(this.resolve(key));
      if (!s.isFile()) return null;
      return { size: s.size, contentType: contentTypeForKey(key), etag: `"${s.size.toString(16)}-${Math.floor(s.mtimeMs).toString(16)}"`, lastModified: s.mtime };
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange): Promise<ReadResult | null> {
    const info = await this.head(key);
    if (!info) return null;
    const stream = createReadStream(this.resolve(key), range ? { start: range.start, end: range.end } : undefined);
    return { ...info, body: Readable.toWeb(stream) as ReadableStream<Uint8Array> };
  }

  // The content type is derived from the extension on read, so it is not stored locally.
  async write(key: string, data: Uint8Array): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" }); // never overwrite an existing object
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/* --------------------------------------------------------------------- s3 --- */

function s3Status(e: unknown): number | undefined {
  return e instanceof S3ServiceException ? e.$metadata.httpStatusCode : undefined;
}

class S3MediaStorage implements MediaStorage {
  readonly kind = "s3" as const;

  async head(key: string): Promise<StoredObjectInfo | null> {
    assertKey(key);
    try {
      const r = await getS3Client().send(new HeadObjectCommand({ Bucket: getS3Config().bucket, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? contentTypeForKey(key), etag: r.ETag, lastModified: r.LastModified };
    } catch (e) {
      const status = s3Status(e);
      if (status === 404 || status === 403) return null;
      throw e;
    }
  }

  async read(key: string, range?: ByteRange): Promise<ReadResult | null> {
    assertKey(key);
    try {
      const r = await getS3Client().send(
        new GetObjectCommand({ Bucket: getS3Config().bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
      );
      if (!r.Body) return null;
      const total = r.ContentRange ? Number(r.ContentRange.split("/")[1]) : (r.ContentLength ?? 0);
      return {
        size: Number.isFinite(total) ? total : (r.ContentLength ?? 0),
        contentType: r.ContentType ?? contentTypeForKey(key),
        etag: r.ETag,
        lastModified: r.LastModified,
        body: r.Body.transformToWebStream(),
      };
    } catch (e) {
      const status = s3Status(e);
      if (status === 404 || status === 403) return null;
      throw e;
    }
  }

  async write(key: string, data: Uint8Array, contentType: string): Promise<void> {
    assertKey(key);
    await getS3Client().send(
      new PutObjectCommand({ Bucket: getS3Config().bucket, Key: key, Body: data, ContentType: contentType, IfNoneMatch: "*" }),
    );
  }

  async remove(key: string): Promise<void> {
    assertKey(key);
    await getS3Client().send(new DeleteObjectCommand({ Bucket: getS3Config().bucket, Key: key }));
  }
}

/* --------------------------------------------------------------- selector --- */

let cached: MediaStorage | null | undefined;

/** The media storage for this runtime, or null when none is configured locally. */
export function getMediaStorage(): MediaStorage | null {
  if (cached !== undefined) return cached;
  if (runtimeMode() === "production") {
    cached = new S3MediaStorage();
  } else {
    const dir = process.env.LOCAL_MEDIA_DIR?.trim();
    cached = dir ? new LocalMediaStorage(dir) : null;
  }
  return cached;
}
