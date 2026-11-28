import Image from "next/image";
import type { NoteDetail } from "./types";

type Tier = "top" | "heart" | "base";

const TIERS: { key: Tier; label: string }[] = [
  { key: "top", label: "Top Note" },
  { key: "heart", label: "Heart Note" },
  { key: "base", label: "Base Note" },
];

/**
 * Fragrance notes as circular ingredient images (Top, Heart, Base), rendered
 * from each product's own notes: three per row, each with its tier and name
 * beneath. Equal circles, smaller on phones. A tier with several notes shows
 * each of them; empty tiers are skipped. Every note arrives with a photo
 * (uploaded → ingredient → fragrance family, see src/data/note-families.ts);
 * the plain ivory circle is only a safety net.
 */
export function FragranceNoteCircles({ notes }: { notes: Readonly<Record<Tier, readonly NoteDetail[]>> }) {
  const items = TIERS.flatMap(({ key, label }) => notes[key].map((note, i) => ({ id: `${key}-${i}-${note.name}`, tier: key, label, note })));
  if (items.length === 0) return null;

  return (
    <ul aria-label="Fragrance notes" className="-mx-1.5 flex flex-wrap justify-center gap-y-6 pt-1" data-note-circles>
      {items.map(({ id, tier, label, note }) => (
        <li key={id} className="flex w-1/3 min-w-0 flex-col items-center px-1.5 text-center" data-note-circle={tier}>
          <span className="relative block aspect-square w-full max-w-[84px] overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,var(--brand-cream)_100%)] ring-1 ring-brand-gold/45 ring-offset-[3px] ring-offset-brand-ivory sm:max-w-[104px]">
            {note.image ? (
              <Image src={note.image.src} alt={note.image.alt || note.name} fill loading="lazy" sizes="(min-width: 640px) 104px, 84px" className="object-cover" />
            ) : null}
          </span>
          <span className="mt-3 text-[10.5px] font-semibold tracking-[0.2em] text-brand-gold uppercase">{label}</span>
          <span className="mt-0.5 max-w-full font-serif text-[17px] leading-tight [overflow-wrap:anywhere] text-brand-black sm:text-[19px]">{note.name}</span>
        </li>
      ))}
    </ul>
  );
}
