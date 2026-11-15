import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { getS3Client, getS3Config, isAllowedAssetKey } from "@/lib/s3";
import { formatMegabytes, isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/media/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/media/upload
 *
 * Secure server-side media upload proxy to private AWS S3 bucket.
 * Prevents browser-to-S3 CORS preflight blocks by streaming the binary
 * via the same-origin Next.js API handler to private S3.
 */
export const POST = withAdmin(async (request: NextRequest) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data", message: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const folder = formData.get("folder");
  const slug = formData.get("slug");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "missing_file", message: "File is required" }, { status: 400 });
  }

  if (typeof folder !== "string" || !["main", "gallery", "notes"].includes(folder)) {
    return NextResponse.json({ error: "invalid_folder", message: "Folder must be 'main', 'gallery' or 'notes'" }, { status: 400 });
  }

  if (typeof slug !== "string" || !/^[a-z0-9_-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "invalid_slug", message: "Invalid product slug format" }, { status: 400 });
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "invalid_content_type", message: "Only JPEG, PNG and WebP images are allowed" }, { status: 400 });
  }

  // The admin compresses images in the browser to fit this limit before upload.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `Image is ${formatMegabytes(file.size)}; the upload limit is ${formatMegabytes(MAX_UPLOAD_BYTES)}.`,
      },
      { status: 413 },
    );
  }

  // Clean filename to prevent path traversal
  const cleanFilename = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const timestamp = Date.now();
  const key = `products/${slug}/${folder}/${timestamp}-${cleanFilename}`;

  if (!isAllowedAssetKey(key)) {
    return NextResponse.json({ error: "disallowed_key", message: "Generated key not allowlisted" }, { status: 400 });
  }

  try {
    const { bucket } = getS3Config();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }),
    );

    const publicUrl = getAssetUrl(key);

    return NextResponse.json({
      ok: true,
      key,
      publicUrl,
      sizeBytes: file.size,
    });
  } catch (e) {
    // Log details server-side only; never return raw AWS error text to the browser.
    console.error("[media/upload] S3 upload error:", key, e instanceof Error ? e.name : "unknown");
    return NextResponse.json(
      { error: "s3_upload_failed", message: "The image could not be stored. Please try again." },
      { status: 502 },
    );
  }
});
