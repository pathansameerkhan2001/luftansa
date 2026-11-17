import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { revalidateCmsModule } from "@/lib/cms/loader";
import { getCmsModule } from "@/lib/cms/registry";
import { entrySettingsInputSchema } from "@/lib/cms/schemas";
import { deleteEntry, getEntry, publishEntry, saveDraft, unpublishEntry, updateSettings } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { module: string; id: string };

const version = z.number().int().min(1);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveDraft"), version, draft: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("settings"), version, settings: entrySettingsInputSchema }),
  z.object({ action: z.literal("publish"), version }),
  z.object({ action: z.literal("unpublish"), version }),
]);

async function resolve(params: Promise<Params>) {
  const { module, id } = await params;
  return { def: getCmsModule(module), id };
}

export const GET = withAdmin<Params>(async (_request, { params }) => {
  const { def, id } = await resolve(params);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const item = await getEntry(data.repo, def, id);
    return item ? NextResponse.json({ ok: true, item }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    return adminErrorResponse(e, "cms.get");
  }
});

/** PATCH: { action: "saveDraft" | "settings" | "publish" | "unpublish", version, … } */
export const PATCH = withAdmin<Params>(async (request: NextRequest, { params, session }) => {
  const { def, id } = await resolve(params);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const body = actionSchema.parse(await request.json().catch(() => null));
    const ctx = { ...data, actorEmail: session.email };
    const item =
      body.action === "saveDraft"
        ? await saveDraft(ctx, def, id, body.draft, body.version)
        : body.action === "settings"
          ? await updateSettings(ctx, def, id, body.settings, body.version)
          : body.action === "publish"
            ? await publishEntry(ctx, def, id, body.version)
            : await unpublishEntry(ctx, def, id, body.version);
    revalidateCmsModule(def.id);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return adminErrorResponse(e, `cms.${def.id}.update`);
  }
});

/** DELETE ?version=N (the admin UI asks for confirmation first). */
export const DELETE = withAdmin<Params>(async (request: NextRequest, { params, session }) => {
  const { def, id } = await resolve(params);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const v = version.parse(Number(request.nextUrl.searchParams.get("version")));
    await deleteEntry({ ...data, actorEmail: session.email }, def, id, v);
    revalidateCmsModule(def.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminErrorResponse(e, `cms.${def.id}.delete`);
  }
});
