import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { CMS_MODULES } from "@/lib/cms/registry";
import { getDataServices } from "@/lib/db/client";
import { cancelDeletion, confirmDeletion, MediaInUseError, requestDeletion } from "@/lib/media/library";
import { getMediaStorage } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["request", "cancel", "confirm"]), version: z.number().int().min(1) });

/**
 * POST /api/admin/media/:id/deletion { action, version }
 *   request: mark for deletion (refused while in use)
 *   cancel:  keep the asset
 *   confirm: permanently delete the object and its record (usage re-checked)
 */
export const POST = withAdmin<{ id: string }>(async (request: NextRequest, { params, session }) => {
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  const id = (await params).id;
  try {
    const { action, version } = bodySchema.parse(await request.json().catch(() => null));
    const ctx = { ...data, actorEmail: session.email };
    if (action === "request") return NextResponse.json({ ok: true, item: await requestDeletion(ctx, id, version, CMS_MODULES) });
    if (action === "cancel") return NextResponse.json({ ok: true, item: await cancelDeletion(ctx, id, version) });
    const storage = getMediaStorage();
    if (!storage) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
    await confirmDeletion(ctx, storage, id, version, CMS_MODULES);
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    if (e instanceof MediaInUseError) {
      return NextResponse.json({ error: "in_use", message: "This file is in use and cannot be deleted.", usage: e.usage }, { status: 409 });
    }
    return adminErrorResponse(e, "media.deletion");
  }
});
