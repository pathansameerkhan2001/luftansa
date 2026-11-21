import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { AnnouncementMessageView } from "@/lib/cms/modules/announcement-bar";

/**
 * One announcement: ✦ highlight — button label →
 * A neutral sparkle (not a star) so the bar never suggests a customer rating.
 */
export function AnnouncementMessageContent({ message }: { message: AnnouncementMessageView }) {
  return (
    <>
      <Sparkles aria-hidden="true" className="size-3 shrink-0 text-brand-gold" strokeWidth={1.5} />
      <span className="font-medium">{message.highlight}</span>
      {message.cta ? (
        <>
          {/* Spaces are part of the text (so screen readers pause between highlight and button); flex layout trims them visually. */}
          <span className="text-white/50">{" — "}</span>
          {/* Button text and arrow wrap together (static bar on narrow phones). */}
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="text-white/85 transition-colors group-hover/msg:text-brand-gold group-hover/msg:underline group-hover/msg:underline-offset-4">{message.cta.label}</span>
            <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-white/70 transition-colors group-hover/msg:text-brand-gold" strokeWidth={1.5} />
          </span>
        </>
      ) : null}
    </>
  );
}

const MESSAGE_FOCUS = "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

/**
 * The message, as a link when it has a button. Site paths use client-side
 * navigation; https:// destinations open in a new tab.
 */
export function AnnouncementMessageItem({ message, className = "", focusable = true }: { message: AnnouncementMessageView; className?: string; focusable?: boolean }) {
  const inner = <AnnouncementMessageContent message={message} />;
  const cls = `group/msg inline-flex items-center gap-2 ${className}`;
  if (!message.cta) return <span className={cls}>{inner}</span>;
  const external = !message.cta.href.startsWith("/");
  return (
    <Link
      href={message.cta.href}
      className={`${cls} ${MESSAGE_FOCUS}`}
      {...(focusable ? {} : { tabIndex: -1 })}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
      {external && focusable ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </Link>
  );
}
