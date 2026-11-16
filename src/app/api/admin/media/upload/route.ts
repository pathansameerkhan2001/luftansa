import { type NextRequest, NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { getDataServices } from "@/lib/db/client";
import { registerMedia } from "@/lib/media/library";
import { getMediaStorage } from "@/lib/media/storage";
import { checkUpload, cleanFilename, isLibraryFolder, libraryObjectKey } from "@/lib/media/upload-rules";
import { isAllowedAssetKey } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_FOLDERS = ["main", "gallery", "notes"] as const;

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * POST /api/admin/media/upload (multipart)
 *
 * Product images (existing contract, unchanged):
 *   file, folder = main | gallery | notes, slug
 * Media Library uploads:
 *   file, target = library, folder = general | hero | banners | about | lab | manufacturing | videos
 *   optional width, height, durationSeconds, alt
 *
 * The object is written to the private bucket in production, or to the local
 * media folder in local development (never to production from a laptop).
 * The type is checked against the file's actual bytes. Library uploads are
 * catalogued in the Media Library; product uploads are catalogued too, best
 * effort, without ever failing the product upload.
 */
export const POST = withAdmin(async (request: NextRequest, { session }) => {
  let formData: FormData;
  try {
    // Buffer the (≤ 4 MB) body before parsing. Reading multipart file parts
    // lazily from the request stream failed intermittently behind the Node.js
    // middleware's body cloning ("Response body object should not be disturbed
    // or locked"); parsing from a fully buffered body is deterministic.
    const raw = await request.arrayBuffer();
    formData = await new Response(raw, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data", message: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const folder = formData.get("folder");
  const library = formData.get("target") === "library";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "missing_file", message: "File is required" }, { status: 400 });
  }

  const storage = getMediaStorage();
  if (!storage) {
    return NextResponse.json({ error: "storage_not_configured", message: "Media storage is not configured (set LOCAL_MEDIA_DIR locally)." }, { status: 503 });
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "invalid_form_data", message: "The file could not be read. Please try again." }, { status: 400 });
  }
  const check = checkUpload(file, bytes.subarray(0, 32));
  if (!check.ok) return NextResponse.json({ error: check.error, message: check.message }, { status: check.status });

  const now = new Date();
  let key: string;
  let recordFolder: string;
  if (library) {
    if (!isLibraryFolder(folder)) return NextResponse.json({ error: "invalid_folder", message: "Unknown library folder" }, { status: 400 });
    key = libraryObjectKey(folder, file.name, now);
    recordFolder = folder;
  } else {
    const slug = formData.get("slug");
    if (typeof folder !== "string" || !(PRODUCT_FOLDERS as readonly string[]).includes(folder)) {
      return NextResponse.json({ error: "invalid_folder", message: "Folder must be 'main', 'gallery' or 'notes'" }, { status: 400 });
    }
    if (typeof slug !== "string" || !/^[a-z0-9_-]{1,64}$/.test(slug)) {
      return NextResponse.json({ error: "invalid_slug", message: "Invalid product slug format" }, { status: 400 });
    }
    if (check.kind !== "image") {
      return NextResponse.json({ error: "invalid_content_type", message: "Only JPEG, PNG and WebP images are allowed" }, { status: 400 });
    }
    key = `products/${slug}/${folder}/${now.getTime()}-${cleanFilename(file.name)}`;
    recordFolder = `products/${slug}/${folder}`;
  }

  if (!isAllowedAssetKey(key)) {
    return NextResponse.json({ error: "disallowed_key", message: "Generated key not allowlisted" }, { status: 400 });
  }

  try {
    await storage.write(key, bytes, file.type);
  } catch (e) {
    // Log the error class only; never return raw storage/AWS errors to the browser.
    console.error("[media/upload] storage write failed:", key, e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "s3_upload_failed", message: "The file could not be stored. Please try again." }, { status: 502 });
  }

  let mediaId: string | undefined;
  const data = getDataServices();
  if (data) {
    try {
      const item = await registerMedia(
        { ...data, actorEmail: session.email },
        {
          key,
          kind: check.kind,
          contentType: file.type,
          sizeBytes: file.size,
          originalFilename: file.name,
          folder: recordFolder,
          width: optionalNumber(formData.get("width")),
          height: optionalNumber(formData.get("height")),
          durationSeconds: optionalNumber(formData.get("durationSeconds")),
          alt: typeof formData.get("alt") === "string" ? String(formData.get("alt")).slice(0, 300) : undefined,
        },
      );
      mediaId = item.id;
    } catch (e) {
      if (library) return adminErrorResponse(e, "media.register");
      console.warn("[media/upload] product image stored but not catalogued:", e instanceof Error ? e.name : "unknown");
    }
  } else if (library) {
    return NextResponse.json({ error: "database_not_configured", message: "The database is not available." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, key, publicUrl: getAssetUrl(key), sizeBytes: file.size, kind: check.kind, ...(mediaId ? { mediaId } : {}) });
});
