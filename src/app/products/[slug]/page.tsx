import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductTabs } from "@/components/product/ProductTabs";
import { TrustBadges } from "@/components/product/TrustBadges";
import type { ProductDetailData } from "@/components/product/types";
import { FRAGRANCE_PROFILES } from "@/data/fragrance-profiles";
import { PRODUCTS, sprayOptions, type Product } from "@/data/products";
import { STORE_NAME } from "@/data/store";
import { getAssetUrl } from "@/lib/assets";

// Only catalogue products have pages; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

function findProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = findProduct((await params).slug);
  if (!product) return {};
  return {
    title: `${product.name} | ${STORE_NAME}`,
    description: product.description ?? FRAGRANCE_PROFILES[product.slug]?.description ?? `${product.name} by ${STORE_NAME}.`,
  };
}

/** Builds the page data from confirmed catalogue + profile information only. */
function toDetailData(product: Product): ProductDetailData {
  const profile = FRAGRANCE_PROFILES[product.slug] ?? {};
  const photos = [product.image, ...(product.gallery ?? [])].filter((img) => img !== undefined);
  return {
    slug: product.slug,
    name: product.name,
    category: product.category ?? "Perfume",
    description: product.description ?? profile.description,
    perfectFor: profile.perfectFor,
    concentration: product.concentration,
    gender: product.gender,
    options: sprayOptions(product),
    images: photos.map((img) => ({ src: getAssetUrl(img.key), alt: img.alt, objectPosition: img.objectPosition })),
    notes: { top: profile.notes?.top, heart: profile.notes?.middle, base: profile.notes?.base },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = findProduct((await params).slug);
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
