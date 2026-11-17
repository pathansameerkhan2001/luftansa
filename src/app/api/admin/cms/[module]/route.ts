import { type NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, databaseUnavailable } from "@/lib/admin/api-errors";
import { withAdmin } from "@/lib/auth/require-admin";
import { revalidateCmsModule } from "@/lib/cms/loader";
import { getCmsModule } from "@/lib/cms/registry";
import { createEntry, listEntries } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { module: string };

/** GET /api/admin/cms/:module: every entry (drafts included) in display order. */
export const GET = withAdmin<Params>(async (_request, { params }) => {
  const def = getCmsModule((await params).module);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    return NextResponse.json({ ok: true, module: { id: def.id, label: def.label, kind: def.kind }, items: await listEntries(data.repo, def) });
  } catch (e) {
    return adminErrorResponse(e, "cms.list");
  }
});

/** POST /api/admin/cms/:module: create a draft entry. */
export const POST = withAdmin<Params>(async (request: NextRequest, { params, session }) => {
  const def = getCmsModule((await params).module);
  if (!def) return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  const data = getDataServices();
  if (!data) return databaseUnavailable();
  try {
    const body = await request.json().catch(() => null);
    const entry = await createEntry({ ...data, actorEmail: session.email }, def, body ?? {});
    revalidateCmsModule(def.id);
    return NextResponse.json({ ok: true, item: entry }, { status: 201 });
  } catch (e) {
    return adminErrorResponse(e, "cms.create");
  }
});
