import { type NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { getSignedUploadUrl } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const presignInputSchema = z.object({
  filename: z.string().min(1).max(128),
  contentType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  folder: z.enum(["main", "gallery", "notes"]),
  slug: z.string().regex(/^[a-z0-9_-]{1,64}$/, "Invalid product slug"),
});

export const POST = withAdmin(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const input = presignInputSchema.parse(body);

    // Sanitize filename to prevent directory traversal or invalid characters
    const cleanFilename = input.filename
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    const timestamp = Date.now();
    const key = `products/${input.slug}/${input.folder}/${timestamp}-${cleanFilename}`;

    const uploadUrl = await getSignedUploadUrl(key, input.contentType, 600);
    const publicUrl = getAssetUrl(key);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      key,
      publicUrl,
      expiresInSeconds: 600,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "Presign generation failed";
    return NextResponse.json({ error: "presign_failed", message }, { status: 500 });
  }
});
