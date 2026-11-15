import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { getS3Client, getS3Config, isAllowedAssetKey } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "invalid_content_type", message: "Only JPEG, PNG and WebP images are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large", message: "File size exceeds 10 MB limit" }, { status: 400 });
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
    const message = e instanceof Error ? e.message : "S3 upload failed";
    console.error("[media/upload] S3 upload error:", message);
    return NextResponse.json({ error: "s3_upload_failed", message }, { status: 500 });
  }
});
