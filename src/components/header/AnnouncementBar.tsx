import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { ANNOUNCEMENT } from "./nav-config";

export function AnnouncementBar() {
  return (
    <div className="bg-brand-black text-white">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-3 sm:px-4">
        <Link
          href={ANNOUNCEMENT.href}
          className="group inline-flex min-w-0 items-center gap-1.5 text-[11px] tracking-[0.01em] min-[360px]:gap-2 min-[360px]:tracking-[0.08em] sm:text-xs sm:tracking-[0.12em] focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
        >
          <Star
            aria-hidden="true"
            className="size-3 shrink-0 fill-brand-gold text-brand-gold"
            strokeWidth={1.5}
          />
          <span className="truncate">
            <span className="font-medium">{ANNOUNCEMENT.highlight}</span>
            <span className="mx-1.5 text-white/50" aria-hidden="true">
              —
            </span>
            <span className="text-white/85 underline-offset-4 transition-colors group-hover:text-brand-gold group-hover:underline">
              {ANNOUNCEMENT.cta}
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="size-3 shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-gold motion-reduce:transition-none"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </div>
  );
}
