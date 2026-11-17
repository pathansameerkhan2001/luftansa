import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { revalidateCmsModule } from "@/lib/cms/loader";
import { getCmsModule } from "@/lib/cms/registry";
import { reorderEntries } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";
import { idSchema } from "@/lib/db/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ order: z.array(z.object({ id: idSchema, version: z.number().int().min(1) })).min(1).max(100) });

/** POST /api/admin/cms/:module/reorder { order: [{ id, version }, …] } (atomic). */
export const POST = withAdmin<{ module: string }>(async (request: NextRequest, { params, session }) => {
  const def = getCmsModule((await params).module);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const { order } = bodySchema.parse(await request.json().catch(() => null));
    const items = await reorderEntries({ ...data, actorEmail: session.email }, def, order);
    revalidateCmsModule(def.id);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return adminErrorResponse(e, `cms.${def.id}.reorder`);
  }
});
