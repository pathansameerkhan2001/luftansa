import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductTabs } from "@/components/product/ProductTabs";
import { TrustBadges } from "@/components/product/TrustBadges";
import type { ProductDetailData } from "@/components/product/types";
import { STORE_NAME } from "@/data/store";
import {
  getActiveStorefrontProductBySlug,
  getActiveStorefrontProducts,
  type UnifiedStorefrontProduct,
} from "@/lib/storefront/products";

// Products added later in the admin are rendered on demand.
export const dynamicParams = true;
// Refreshed on demand after admin writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await getActiveStorefrontProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveStorefrontProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} | ${STORE_NAME}`,
    description: product.description ?? `${product.name} by ${STORE_NAME}.`,
  };
}

/** Builds the detail view model from the unified product */
function toDetailData(product: UnifiedStorefrontProduct): ProductDetailData {
  const images = [product.mainImage, ...product.galleryImages].filter(
    (img): img is { src: string; alt: string; objectPosition?: string } => Boolean(img),
  );

  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    concentration: product.concentration,
    gender: product.gender,
    hasNotes: product.hasNotes,
    options: product.options,
    images,
    keywords: product.keywords,
    fragranceNotes: product.notes,
    notes: {
      top: product.notes.top.map((n) => n.name).join(" · ") || undefined,
      heart: product.notes.heart.map((n) => n.name).join(" · ") || undefined,
      base: product.notes.base.map((n) => n.name).join(" · ") || undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getActiveStorefrontProductBySlug(slug);
  if (!product) notFound();

  const data = toDetailData(product);

  return (
    <main className="bg-brand-ivory">
      <div className="mx-auto max-w-[1320px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:pb-24">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-brand-text/65">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand-black hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-black">
              {data.name}
            </li>
          </ol>
        </nav>

        <div className="mt-5 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ProductGallery name={data.name} images={data.images} />
          </div>
          <div className="min-w-0">
            <ProductPurchase product={data} />

            {data.keywords && data.keywords.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-brand-text/60 mr-1">Tags:</span>
                {data.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full border border-brand-gold/30 bg-white/70 px-2.5 py-0.5 text-[11.5px] text-brand-black"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6">
              <TrustBadges />
            </div>
            <div className="mt-7">
              <ProductTabs product={data} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
