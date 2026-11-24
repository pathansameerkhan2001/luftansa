import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ListingCount, ListingEmpty, PillLink, ProductGrid } from "@/components/collection/ProductGrid";
import { Breadcrumbs, PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { NOTE_CATEGORIES } from "@/data/note-categories";
import { STORE_NAME } from "@/data/store";
import { getAssetUrl } from "@/lib/assets";
import { selectNoteFamily } from "@/lib/storefront/collection-pages";
import { getActiveStorefrontProducts, toStorefrontCardData } from "@/lib/storefront/products";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return NOTE_CATEGORIES.map((c) => ({ family: c.slug }));
}

const find = (slug: string) => NOTE_CATEGORIES.find((c) => c.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  const c = find((await params).family);
  return c ? { title: `${c.title} | ${STORE_NAME}`, description: `${c.description} Luftansa fragrances with ${c.label.toLowerCase()}.` } : {};
}

/** One "Explore by Notes" family: every fragrance whose notes belong to it (src/lib/storefront/collection-pages.ts). */
export default async function NoteFamilyPage({ params }: { params: Promise<{ family: string }> }) {
  const category = find((await params).family);
  if (!category) notFound();
  const products = selectNoteFamily(await getActiveStorefrontProducts(), category.slug).map(toStorefrontCardData);
  const src = category.image.key ? getAssetUrl(category.image.key) : category.image.src;
  const others = NOTE_CATEGORIES.filter((c) => c.slug !== category.slug);

  return (
    <PageFrame>
      <div data-collection-page={`notes-${category.slug}`}>
        <Breadcrumbs crumbs={[{ label: "Explore by Notes", href: "/notes" }, { label: category.title }]} />
        <PageHeader eyebrow={category.label} title={category.title} intro={category.description}>
          <ListingCount count={products.length} />
        </PageHeader>

        {src ? (
          <div className="relative mx-auto mt-8 aspect-[21/9] max-w-4xl overflow-hidden rounded-[22px] ring-1 ring-brand-gold/20 sm:mt-10">
            <Image src={src} alt={category.image.alt} fill sizes="(min-width: 960px) 896px, 92vw" className="object-cover" style={{ objectPosition: category.image.objectPosition ?? "50% 50%" }} priority />
          </div>
        ) : null}

        {products.length ? (
          <ProductGrid products={products} label={category.title} />
        ) : (
          <ListingEmpty text={`Fragrances with ${category.label.toLowerCase()} will appear here. Meanwhile, explore our full collection or ask us for a recommendation.`}>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <PillLink href="/perfumes">Shop Perfumes</PillLink>
              <PillLink href="/contact">Ask for advice</PillLink>
            </div>
          </ListingEmpty>
        )}

        <nav aria-label="Other note families" className="mt-14 text-center sm:mt-16">
          <p className="font-serif text-[18px] text-brand-text/80 sm:text-[20px]">Explore other notes</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {others.map((c) => (
              <li key={c.slug}>
                <PillLink href={`/notes/${c.slug}`}>{c.title}</PillLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </PageFrame>
  );
}
