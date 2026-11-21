import { loadPublished } from "@/lib/cms/loader";
import {
  ANNOUNCEMENT_FALLBACK,
  ANNOUNCEMENT_MODULE,
  announcementPayloadSchema,
  resolveAnnouncementView,
  type AnnouncementDisplay,
  type AnnouncementMessageView,
  type AnnouncementPayload,
  type AnnouncementView,
} from "@/lib/cms/modules/announcement-bar";
import { AnnouncementMessageItem } from "./AnnouncementMessage";
import { AnnouncementTicker } from "./AnnouncementTicker";

function Bar({ display, messages, className = "" }: { display: AnnouncementDisplay; messages: readonly AnnouncementMessageView[]; className?: string }) {
  return (
    <section aria-label="Announcements" className={`bg-brand-black text-white ${className}`} data-announcement-bar={display}>
      {display === "ticker" ? (
        <AnnouncementTicker messages={messages} />
      ) : (
        // Static: the first message that is currently running. Fixed minimum
        // height; long text wraps (centred) instead of being cut off.
        <div className="flex min-h-9 items-center justify-center px-4 py-2 text-center text-[11px] tracking-[0.08em] sm:text-xs sm:tracking-[0.12em] lg:min-h-10">
          <AnnouncementMessageItem message={messages[0]} className="flex-wrap justify-center gap-y-0.5" />
        </div>
      )}
    </section>
  );
}

const sameMessages = (a: readonly AnnouncementMessageView[], b: readonly AnnouncementMessageView[]) => a.length === b.length && a.every((m, i) => m.id === b[i].id);

/**
 * Renders a resolved bar. Desktop and mobile get separate bars (switched by
 * CSS at 640px) only when their messages differ, since cached pages are
 * shared by all devices. Nothing is rendered on a device with no messages.
 */
export function AnnouncementBarView({ view }: { view: AnnouncementView }) {
  const { display, desktop, mobile } = view;
  if (desktop.length === 0 && mobile.length === 0) return null;
  if (sameMessages(desktop, mobile)) return <Bar display={display} messages={desktop} />;
  return (
    <>
      {desktop.length > 0 ? <Bar display={display} messages={desktop} className="hidden sm:block" /> : null}
      {mobile.length > 0 ? <Bar display={display} messages={mobile} className="sm:hidden" /> : null}
    </>
  );
}

/** Renders a stored payload, or null when it no longer satisfies the schema. */
export function renderAnnouncementPayload(payload: unknown, visibility: { desktop: boolean; mobile: boolean }, now = new Date()) {
  const parsed = announcementPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  return <AnnouncementBarView view={resolveAnnouncementView(parsed.data, now, visibility)} />;
}

export function FallbackAnnouncementBar() {
  return <AnnouncementBarView view={resolveAnnouncementView(ANNOUNCEMENT_FALLBACK, new Date())} />;
}

/**
 * Announcement bar above the header (Server Component).
 *   - Nothing published yet, or database unavailable -> the approved default
 *     ("Signature Perfumes from ₹400 — Explore the Collection").
 *   - Published                                     -> the CMS messages running now.
 *   - Deactivated, or no message running right now  -> no bar.
 * Publishing refreshes it immediately (cache tag); scheduled start and end
 * times take effect at the next cache refresh (at most 5 minutes).
 */
export async function AnnouncementBar() {
  const result = await loadPublished<AnnouncementPayload>(ANNOUNCEMENT_MODULE, [ANNOUNCEMENT_FALLBACK]);
  const item = result.items[0];
  if (!item) return null;
  const rendered = renderAnnouncementPayload(item.payload, item.visibility);
  if (rendered === null) {
    // Stored content no longer matches the schema: keep the site whole.
    console.error("[cms] announcement-bar: published payload is invalid, serving the default bar");
    return <FallbackAnnouncementBar />;
  }
  return rendered;
}
