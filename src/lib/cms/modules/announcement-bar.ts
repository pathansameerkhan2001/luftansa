/**
 * Announcement Bar CMS module (Phase 3B, Checkpoint B).
 *
 * One record (singleton) holding the ordered list of messages and the display
 * mode. Keeping the whole bar in one record means adding, editing, deleting
 * and reordering messages all stay in the draft until Publish, so the bar can
 * always be previewed exactly as it will go live, and one version check
 * protects the whole bar from concurrent edits.
 *
 * Each message has highlight text, an optional button (label + destination),
 * an optional schedule (start/end) and desktop/mobile visibility. The entry's
 * own visibility (Visibility Controls) hides the whole bar per device.
 *
 * Fallback (approved, docs/announcement-bar-recommendation.md, Option A):
 * "Signature Perfumes from ₹400 — Explore the Collection". It replaced the
 * unverified "20,000+ Verified Reviews" claim and its broken /reviews link.
 */
import { z } from "zod";
import { isoDateTimeSchema } from "@/lib/db/schemas";
import type { CmsModuleDefinition } from "../schemas";
import { optionalCtaSchema } from "../fields";

export const ANNOUNCEMENT_MAX_MESSAGES = 10;
export const ANNOUNCEMENT_HIGHLIGHT_MAX = 90;
export const ANNOUNCEMENT_DISPLAY_MODES = ["ticker", "static"] as const;
export type AnnouncementDisplay = (typeof ANNOUNCEMENT_DISPLAY_MODES)[number];

/** Stable per-message key (generated in the editor), used for ordering and React keys. */
export const messageIdSchema = z.string().regex(/^[a-z0-9]{4,24}$/, "Invalid message id");

export const announcementMessageSchema = z
  .object({
    id: messageIdSchema,
    highlight: z.string().trim().min(1, "Enter the message text").max(ANNOUNCEMENT_HIGHLIGHT_MAX, `Message must be ${ANNOUNCEMENT_HIGHLIGHT_MAX} characters or fewer`),
    cta: optionalCtaSchema,
    startAt: isoDateTimeSchema.optional(),
    endAt: isoDateTimeSchema.optional(),
    desktop: z.boolean().default(true),
    mobile: z.boolean().default(true),
  })
  .strict()
  .refine((m) => !m.startAt || !m.endAt || m.startAt < m.endAt, { message: "The end must be after the start", path: ["endAt"] })
  .refine((m) => m.desktop || m.mobile, { message: "Show this message on desktops, phones or both", path: ["desktop"] });

export const announcementPayloadSchema = z
  .object({
    display: z.enum(ANNOUNCEMENT_DISPLAY_MODES).default("ticker"),
    messages: z
      .array(announcementMessageSchema)
      .min(1, "Add at least one message")
      .max(ANNOUNCEMENT_MAX_MESSAGES, `At most ${ANNOUNCEMENT_MAX_MESSAGES} messages`)
      .refine((list) => new Set(list.map((m) => m.id)).size === list.length, "Each message must be unique"),
  })
  .strict();

export type AnnouncementPayload = z.infer<typeof announcementPayloadSchema>;
export type AnnouncementPayloadInput = z.input<typeof announcementPayloadSchema>;
export type AnnouncementMessage = z.infer<typeof announcementMessageSchema>;

export const ANNOUNCEMENT_MODULE = {
  id: "announcement-bar",
  label: "Announcement Bar",
  kind: "singleton",
  payload: announcementPayloadSchema as unknown as z.ZodType<Record<string, unknown>>,
} as const satisfies CmsModuleDefinition;

/** The approved default bar, shown until an announcement is published (and if the database is unavailable). */
export const ANNOUNCEMENT_FALLBACK: AnnouncementPayload = {
  display: "ticker",
  messages: [
    {
      id: "default",
      highlight: "Signature Perfumes from ₹400",
      cta: { label: "Explore the Collection", href: "/#personality-collection" },
      desktop: true,
      mobile: true,
    },
  ],
};

/* ------------------------------------------------------------ rendering --- */

export interface AnnouncementMessageView {
  id: string;
  highlight: string;
  cta?: { label: string; href: string };
}

export interface AnnouncementView {
  display: AnnouncementDisplay;
  /** Messages for tablets and desktops (640px and wider), in order. */
  desktop: AnnouncementMessageView[];
  /** Messages for phones (narrower than 640px), in order. */
  mobile: AnnouncementMessageView[];
}

export type ScheduleState = "always" | "scheduled" | "running" | "ended";

/** Where a message is in its schedule at `now` (pure). End is exclusive. */
export function scheduleState(m: Pick<AnnouncementMessage, "startAt" | "endAt">, now: Date): ScheduleState {
  if (!m.startAt && !m.endAt) return "always";
  const t = now.getTime();
  if (m.startAt && t < Date.parse(m.startAt)) return "scheduled";
  if (m.endAt && t >= Date.parse(m.endAt)) return "ended";
  return "running";
}

export const isMessageActive = (m: Pick<AnnouncementMessage, "startAt" | "endAt">, now: Date) => {
  const s = scheduleState(m, now);
  return s === "always" || s === "running";
};

/**
 * What the bar shows at `now` (pure): messages inside their schedule, split
 * by device, after the bar-level visibility. Either list may be empty, in
 * which case the bar is not rendered on that device.
 */
export function resolveAnnouncementView(payload: AnnouncementPayload, now: Date, visibility: { desktop: boolean; mobile: boolean } = { desktop: true, mobile: true }): AnnouncementView {
  const active = payload.messages.filter((m) => isMessageActive(m, now));
  const view = (m: AnnouncementMessage): AnnouncementMessageView => ({ id: m.id, highlight: m.highlight, ...(m.cta ? { cta: m.cta } : {}) });
  return {
    display: payload.display,
    desktop: visibility.desktop ? active.filter((m) => m.desktop).map(view) : [],
    mobile: visibility.mobile ? active.filter((m) => m.mobile).map(view) : [],
  };
}
