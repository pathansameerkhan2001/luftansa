import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlourishIcon } from "@/components/collection/icons";
import { getAssetUrl } from "@/lib/assets";
import { NOTE_CATEGORIES, type NoteCategory } from "@/data/note-categories";

const BUTTON_CLASS =
  "mt-5 inline-flex h-11 items-center justify-center gap-3 rounded-md border border-brand-gold px-5 text-[12px] font-semibold tracking-[0.16em] whitespace-nowrap text-brand-black uppercase sm:mt-6 sm:px-6";

function NoteCard({ category }: { category: NoteCategory }) {
  const { label, title, description, image, href } = category;
  const src = image.key ? getAssetUrl(image.key) : image.src;
  const [labelFirst, ...labelRest] = label.split(" ");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] bg-brand-ivory shadow-[0_1px_2px_rgba(23,23,23,0.04),0_16px_34px_-18px_rgba(23,23,23,0.22)] ring-1 ring-brand-gold/15">
      <div className="relative aspect-[10/9] overflow-hidden bg-brand-cream">
        {src ? (
          <Image
            src={src}
            alt={image.alt}
            fill
            sizes="(min-width: 1280px) 24vw, (min-width: 640px) 46vw, 92vw"
            quality={75}
            className="object-cover"
            style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
          />
        ) : null}
        {/* Scrim keeps the overlay label legible on bright photographs. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(160deg,rgba(23,17,8,0.62)_0%,rgba(23,17,8,0.28)_38%,rgba(23,17,8,0)_62%)]"
        />
        <p aria-hidden="true" className="absolute top-6 left-6 sm:top-7 sm:left-7">
          <span className="block font-serif text-[30px] leading-[0.98] font-semibold tracking-[0.03em] text-white uppercase drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] sm:text-[34px]">
            {labelFirst}
            <br />
            {labelRest.join(" ")}
          </span>
          <span className="mt-3.5 block h-[2px] w-14 bg-brand-gold" />
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center px-5 pt-6 pb-7 text-center sm:pt-7 sm:pb-8">
        <h3 className="font-serif text-[27px] leading-tight font-semibold text-brand-black sm:text-[29px]">{title}</h3>
        <p className="mt-2 text-[14.5px] leading-relaxed text-pretty text-brand-text/80 sm:text-[15px]">{description}</p>
        <div className="mt-auto">
          {href ? (
            <Link
              href={href}
              className={`${BUTTON_CLASS} transition-colors duration-200 hover:bg-brand-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold`}
            >
              Explore Collection
              <span className="sr-only">: {title}</span>
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </Link>
          ) : (
            // No collection route exists yet: render the control without a link
            // (never a broken href). Set `href` in note-categories.ts to enable it.
            <span aria-disabled="true" className={`${BUTTON_CLASS} cursor-default`}>
              Explore Collection
              <span className="sr-only">: {title} (coming soon)</span>
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "Explore by Notes": four fragrance-note category cards (Server Component). */
export function ExploreByNotes({ categories = NOTE_CATEGORIES }: { categories?: readonly NoteCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="explore-notes-heading" className="bg-brand-cream">
      <div className="mx-auto max-w-[1600px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-24">
        <header className="mx-auto max-w-3xl text-center">
          <div aria-hidden="true" className="flex items-center justify-center gap-4 text-brand-gold sm:gap-6">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-brand-gold/80 min-[400px]:w-24 sm:w-56" />
            <FlourishIcon className="size-8 shrink-0 sm:size-9" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-brand-gold/80 min-[400px]:w-24 sm:w-56" />
          </div>
          <p className="mt-3 text-[11px] tracking-[0.38em] text-brand-black uppercase sm:text-[13px] sm:tracking-[0.42em]">
            <span className="font-normal">Fragrance</span> <span className="font-semibold">Notes</span>
          </p>
          <h2
            id="explore-notes-heading"
            className="mt-1 font-serif text-[46px] leading-[1.05] font-semibold italic tracking-[-0.01em] text-brand-black min-[400px]:text-[52px] sm:text-[68px] lg:text-[80px]"
          >
            Explore by Notes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:mt-4 sm:text-[18px]">
            Find your perfect fragrance from our curated note collections.
          </p>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-6 sm:mt-14 sm:grid-cols-2 sm:gap-7 xl:grid-cols-4 xl:gap-6">
          {categories.map((category) => (
            <li key={category.slug} className="mx-auto w-full max-w-[460px] sm:max-w-none">
              <NoteCard category={category} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
