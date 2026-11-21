"use client";

/**
 * Reusable admin CMS building blocks (Phase 3A). Every CMS module from 3B on
 * uses these for a consistent, accessible admin: page intro, status badges,
 * feedback messages, search and filter controls, empty states and a
 * confirmation dialog (native <dialog>: focus trap and Esc to close).
 */
import { AlertTriangle, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const ADMIN_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";
export const BTN_PRIMARY = `inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-black px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-text disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_FOCUS}`;
export const BTN_SECONDARY = `inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d9c79f] bg-white px-4 text-[13.5px] font-medium text-brand-black transition-colors hover:border-brand-black disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_FOCUS}`;
/** Square 40px icon-only button (secondary style). Never combine BTN_SECONDARY with px-0: its px-4 wins and squashes the icon. */
export const BTN_ICON = BTN_SECONDARY.replace(" px-4 ", " w-10 shrink-0 px-0 ");
export const BTN_DANGER = `inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#9a3b2b] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#7f2f22] disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_FOCUS}`;
export const INPUT = `w-full rounded-xl border border-[#d9c79f] bg-white px-3 py-2 text-[14px] text-brand-black placeholder:text-brand-text/40 ${ADMIN_FOCUS}`;

export function PageIntro({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11.5px] font-semibold tracking-[0.18em] text-[#7a5a2b] uppercase">{eyebrow}</p> : null}
        <h1 className="mt-1 font-serif text-[28px] leading-tight font-semibold text-brand-black sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-brand-text/70">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "border-[#d9c79f] bg-brand-cream text-brand-text/80",
  success: "border-[#b9d4b3] bg-[#eef6ec] text-[#2f5f2a]",
  warning: "border-[#e5c98f] bg-[#fdf4e2] text-[#7a5a2b]",
  danger: "border-[#e2b4ab] bg-[#fbeeeb] text-[#8a2f22]",
  dark: "border-[#161513] bg-[#161513] text-[#e9d6ab]",
} as const;

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export type Feedback = { tone: "success" | "error"; message: string } | null;

/** Polite live region for save/upload results. */
export function FeedbackBanner({ feedback, onDismiss }: { feedback: Feedback; onDismiss: () => void }) {
  return (
    <div role="status" aria-live="polite">
      {feedback ? (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13.5px] ${
            feedback.tone === "success" ? "border-[#b9d4b3] bg-[#eef6ec] text-[#2f5f2a]" : "border-[#e2b4ab] bg-[#fbeeeb] text-[#8a2f22]"
          }`}
        >
          {feedback.tone === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
          <p className="min-w-0 flex-1">{feedback.message}</p>
          <button type="button" onClick={onDismiss} aria-label="Dismiss message" className={`-m-1 rounded p-1 opacity-70 hover:opacity-100 ${ADMIN_FOCUS}`}>
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-text/45" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${INPUT} h-10 pl-9`} />
    </label>
  );
}

export function FilterTabs<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-xl px-3.5 text-[13px] font-semibold transition-colors ${ADMIN_FOCUS} ${
              active ? "bg-brand-black text-[#e9d6ab]" : "border border-[#e3d6bd] bg-white text-brand-text/75 hover:border-brand-gold"
            }`}
          >
            {o.label}
            {o.count !== undefined ? <span className={`ml-1.5 tabular-nums ${active ? "text-white/60" : "text-brand-text/45"}`}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9c79f] bg-[#fffdf8] px-6 py-14 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-cream text-brand-text/50">{icon}</div>
      <p className="mt-3.5 text-[15px] font-semibold text-brand-black">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-brand-text/65">{children}</div> : null}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[13px] text-brand-text/70">
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      {label}
    </span>
  );
}

/** Confirmation dialog. Resolves through onConfirm/onCancel; busy disables both buttons. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-[#e3d6bd] bg-[#fffdf8] p-0 text-brand-black shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-serif text-[22px] font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-[14px] leading-relaxed text-brand-text/75">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onCancel} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={tone === "danger" ? BTN_DANGER : BTN_PRIMARY} data-confirm>
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Small helper for JSON admin API calls with readable errors. */
export async function adminFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; issues?: { message: string }[] };
  if (!res.ok) {
    if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(data.message ?? data.issues?.[0]?.message ?? data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  return { feedback, setFeedback, clear: () => setFeedback(null) };
}
