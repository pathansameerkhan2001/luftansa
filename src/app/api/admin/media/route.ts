import { NextResponse } from "next/server";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { getDataServices } from "@/lib/db/client";
import { listMedia, listUncataloguedProductImages } from "@/lib/media/library";
import { getMediaStorage } from "@/lib/media/storage";
import { LIBRARY_FOLDERS, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/media/upload-rules";
import { runtimeMode } from "@/lib/runtime/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/media
 * Catalogued assets (newest first) plus product images that are referenced by
 * products but not yet catalogued, so nothing in use is invisible.
 */
export const GET = withAdmin(async () => {
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const items = await listMedia(data.repo);
    const uncatalogued = await listUncataloguedProductImages(data.repo, items);
    return NextResponse.json({
      ok: true,
      items: items.map((m) => ({ ...m, url: getAssetUrl(m.key) })),
      uncatalogued: uncatalogued.map((u) => ({ ...u, url: getAssetUrl(u.key) })),
      environment: {
        mode: runtimeMode(),
        storage: getMediaStorage()?.kind ?? "none",
        limits: { imageBytes: MAX_IMAGE_BYTES, videoBytes: MAX_VIDEO_BYTES },
        folders: LIBRARY_FOLDERS,
      },
    });
  } catch (e) {
    return adminErrorResponse(e, "media.list");
  }
});
