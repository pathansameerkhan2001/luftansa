import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FallbackAnnouncementBar, renderAnnouncementPayload } from "@/components/header/AnnouncementBar";
import { SiteHeader } from "@/components/header/SiteHeader";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { ANNOUNCEMENT_MODULE, announcementPayloadSchema, resolveAnnouncementView, scheduleState } from "@/lib/cms/modules/announcement-bar";
import { getEntry } from "@/lib/cms/service";
import { getDataServices } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announcement bar preview", robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Notice({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="note" className={`mx-auto my-6 max-w-xl rounded-xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-4 py-3 text-center text-[13.5px] text-brand-text/75 ${className}`}>
      {children}
    </div>
  );
}

/** Preview time: ?at=<ISO date-time> (to check a schedule in advance), otherwise now. */
function previewTime(at: string | undefined): Date {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? new Date(t) : new Date();
}

/**
 * Admin-only announcement bar preview (rendered inside the admin PreviewFrame
 * iframe). Uses the real storefront header and bar with the saved draft
 * (?version=draft) or exactly what the website shows (?version=live).
 * Never cached and never indexed; outside the admin shell so it looks like the storefront.
 */
export default async function AnnouncementPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string; at?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const version = sp.version === "live" ? "live" : "draft";
  const now = previewTime(sp.at);
  const data = getDataServices();
  const entry = data ? await getEntry(data.repo, ANNOUNCEMENT_MODULE, "main").catch(() => null) : null;

  let bar: ReactNode;
  let notes: ReactNode;
  const payload = !entry ? null : version === "draft" ? entry.draft : entry.status === "PUBLISHED" ? entry.published : null;

  if (!entry || (version === "live" && !entry.publishedAt)) {
    bar = <FallbackAnnouncementBar />;
    notes = <Notice>Not published yet. The website shows this default announcement.</Notice>;
  } else if (!payload) {
    bar = null;
    notes = <Notice>The announcement bar is inactive: the website currently shows no bar.</Notice>;
  } else {
    bar = renderAnnouncementPayload(payload, entry.visibility, now);
    const parsed = announcementPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      notes = <Notice>This version cannot be displayed. Check the messages in the editor.</Notice>;
    } else {
      const view = resolveAnnouncementView(parsed.data, now, entry.visibility);
      const waiting = parsed.data.messages.filter((m) => scheduleState(m, now) === "scheduled" || scheduleState(m, now) === "ended");
      notes = (
        <>
          <Notice>
            Showing the {version === "draft" ? "saved draft" : "live version"} as at {dateTime.format(now)} (India time).
            {waiting.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[12.5px]">
                {waiting.map((m) => (
                  <li key={m.id}>
                    “{m.highlight}” is not shown: {scheduleState(m, now) === "scheduled" ? `starts ${dateTime.format(new Date(m.startAt!))}` : `ended ${dateTime.format(new Date(m.endAt!))}`}.
                  </li>
                ))}
              </ul>
            ) : null}
          </Notice>
          {view.mobile.length === 0 ? <Notice className="sm:hidden">No announcement is shown on phones at this time.</Notice> : null}
          {view.desktop.length === 0 ? <Notice className="hidden sm:block">No announcement is shown on tablets and desktops at this time.</Notice> : null}
        </>
      );
    }
  }

  return (
    <div className="min-h-dvh bg-brand-ivory" data-preview={`announcement-${version}`}>
      <SiteHeader announcement={bar ?? null} />
      <main>{notes}</main>
    </div>
  );
}
