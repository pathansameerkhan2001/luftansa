import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DeliveryInfo } from "@/components/product/DeliveryInfo";
import { FragranceNotesShowcase } from "@/components/product/FragranceNotesShowcase";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfoSections } from "@/components/product/ProductInfoSections";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { RelatedFragrances } from "@/components/product/RelatedFragrances";
import type { ProductDetailData } from "@/components/product/types";
import { STORE_NAME } from "@/data/store";
import { FORMAT_LABEL, SECTION_LABEL, SECTION_ROUTE } from "@/lib/catalogue/product-format";
import { loadPublished } from "@/lib/cms/loader";
import { resolveTrustTags, TRUST_TAGS_DEFAULT, TRUST_TAGS_MODULE, toTrustTagsView } from "@/lib/cms/modules/trust-tags";
import { selectRelated } from "@/lib/storefront/collections";
import { productJsonLd, productMetaDescription } from "@/lib/storefront/product-seo";
import {
  getActiveStorefrontProductBySlug,
  getActiveStorefrontProducts,
  toStorefrontCardData,
  type UnifiedStorefrontProduct,
} from "@/lib/storefront/products";

// Products added later in the admin are rendered on demand.
export const dynamicParams = true;
// Refreshed on demand after admin writes (revalidateStorefront); hourly safety net.
export const revalidate = 3600;

// One lookup per request, shared by generateMetadata and the page.
const getProduct = cache(getActiveStorefrontProductBySlug);

export async function generateStaticParams() {
  const products = await getActiveStorefrontProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: `Fragrance not found | ${STORE_NAME}`, robots: { index: false } };
  const title = `${product.displayName} | ${STORE_NAME}`;
  const description = productMetaDescription({ ...product, name: product.displayName, category: product.format === "other" ? product.category : FORMAT_LABEL[product.format] });
  const ogImage = product.mainImage?.src.startsWith("http") ? product.mainImage : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: STORE_NAME,
      ...(ogImage ? { images: [{ url: ogImage.src, alt: ogImage.alt }] } : {}),
    },
  };
}

/** Builds the detail view model from the unified product */
function toDetailData(product: UnifiedStorefrontProduct): ProductDetailData {
  // Main image first; gallery images follow (duplicates of the main image skipped).
  const images = [product.mainImage, ...product.galleryImages]
    .filter((img): img is { src: string; alt: string; objectPosition?: string } => Boolean(img))
    .filter((img, i, all) => all.findIndex((o) => o.src === img.src) === i);

  return {
    slug: product.slug,
    // "Black Velvet Roll-On": used for the heading, image alt text and the WhatsApp order.
    name: product.displayName,
    // The product page eyebrow and breadcrumb show the section format (Perfume / Roll-On).
    category: product.format === "other" ? product.category : FORMAT_LABEL[product.format],
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
  const product = await getProduct(slug);
  if (!product) notFound();

  const data = toDetailData(product);
  // Related products stay within the same section (Perfumes with Perfumes, Roll-Ons with Roll-Ons).
  const sameSection = (await getActiveStorefrontProducts()).filter((p) => p.format === product.format);
  const related = selectRelated(sameSection, product, 4).map(toStorefrontCardData);
  // Global quality tags: never product data, so every product (new, imported, Perfume or Roll-On) shows them.
  const trustTags = await loadPublished(TRUST_TAGS_MODULE, [TRUST_TAGS_DEFAULT]).then(resolveTrustTags, () => toTrustTagsView(TRUST_TAGS_DEFAULT));
  const section = product.format === "other" ? null : product.format;
  const seoProduct = { ...product, name: product.displayName, category: data.category };

  return (
    <main className="bg-brand-ivory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(seoProduct, data.images) }} />

      <div className="mx-auto max-w-[1320px] px-4 pt-5 pb-14 sm:px-8 sm:pt-8 sm:pb-20">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-brand-text/65">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand-black hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              {section ? (
                <Link href={SECTION_ROUTE[section]} className="hover:text-brand-black hover:underline">
                  {SECTION_LABEL[section]}
                </Link>
              ) : (
                data.category
              )}
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-black">
              {data.name}
            </li>
          </ol>
        </nav>

        {/* ~55% gallery / ~45% information on desktop; stacked (image first) below lg. */}
        <div className="mt-5 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-12 xl:gap-16">
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <ProductGallery name={data.name} images={data.images} />
          </div>
          <div className="min-w-0">
            <ProductPurchase product={data} />
            <div className="mt-6">
              <DeliveryInfo productName={data.name} />
            </div>
            <div className="mt-8">
              <ProductInfoSections product={data} trustTags={trustTags} />
            </div>
          </div>
        </div>
      </div>

      <FragranceNotesShowcase product={data} />
      <RelatedFragrances products={related} />
      {/* Sticky mobile purchase bar hides once this point is reached (so it never covers the footer). */}
      <div id="pdp-end" aria-hidden="true" className="h-px" />
    </main>
  );
}
