import { type NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { getAssetUrl } from "@/lib/assets";
import { CMS_MODULES } from "@/lib/cms/registry";
import { getDataServices } from "@/lib/db/client";
import { findUsage, getMedia, updateMediaMeta } from "@/lib/media/library";
import { mediaMetaInputSchema } from "@/lib/media/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

/** GET /api/admin/media/:id: the asset with its current usage. */
export const GET = withAdmin<Params>(async (_request, { params }) => {
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const item = await getMedia(data.repo, (await params).id);
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const usage = await findUsage(data.repo, item.key, CMS_MODULES);
    return NextResponse.json({ ok: true, item: { ...item, url: getAssetUrl(item.key) }, usage });
  } catch (e) {
    return adminErrorResponse(e, "media.get");
  }
});

/** PATCH /api/admin/media/:id { version, alt?, description? } */
export const PATCH = withAdmin<Params>(async (request: NextRequest, { params, session }) => {
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const body = mediaMetaInputSchema.parse(await request.json().catch(() => null));
    const item = await updateMediaMeta({ ...data, actorEmail: session.email }, (await params).id, body, body.version);
    return NextResponse.json({ ok: true, item: { ...item, url: getAssetUrl(item.key) } });
  } catch (e) {
    return adminErrorResponse(e, "media.update");
  }
});
