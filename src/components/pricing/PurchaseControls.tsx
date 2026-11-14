"use client";

/**
 * Shared purchase UI for product cards and the Best Sellers showcase:
 * size pills, size/price cards, the pricing panel (price, MRP, discount,
 * wishlist) and data-driven offer badges. Everything promotional renders only
 * when the option carries confirmed data (see src/data/products.ts).
 */
import { Heart, ShoppingCart } from "lucide-react";
import { useId } from "react";
import { discountPercent, formatInr, type ProductOption } from "@/data/products";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

/* ------------------------------------------------------------ offer badge --- */

export function OfferBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#e7d3a4_0%,#c6a76a_55%,#b08d4c_100%)] px-3 py-1 text-[10.5px] leading-none font-bold tracking-[0.12em] whitespace-nowrap text-brand-black uppercase shadow-[0_6px_14px_-6px_rgba(120,92,40,0.6)] ring-1 ring-white/60 ${className}`}
    >
      <span aria-hidden="true">✦</span>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------- size pills --- */

interface SizeSelectorProps {
  options: readonly ProductOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Accessible group label, e.g. "Choose a size for Black Velvet". */
  label: string;
}

/** Compact pill selector (product cards). Wraps neatly on narrow cards. */
export function SizePills({ options, selectedId, onSelect, label }: SizeSelectorProps) {
  const groupId = useId();
  return (
    <div>
      <span id={groupId} className="sr-only">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={groupId} className="flex flex-wrap gap-1.5 sm:gap-2">
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(option.id)}
              className={`h-9 min-w-[54px] rounded-full border px-2.5 text-[13px] whitespace-nowrap tracking-[0.02em] transition-colors duration-200 sm:min-w-[64px] sm:px-3.5 ${FOCUS} ${
                selected
                  ? "border-brand-black bg-brand-black text-white"
                  : "border-brand-gold/45 bg-white/60 text-brand-text hover:border-brand-gold"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Size cards with price and (configured) MRP (Best Sellers). */
export function SizePriceCards({ options, selectedId, onSelect, label }: SizeSelectorProps) {
  const groupId = useId();
  return (
    <div>
      <span id={groupId} className="sr-only">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-3 gap-2 sm:gap-3">
        {options.map((option) => {
          const selected = option.id === selectedId;
          const hasOffer = Boolean(option.offers?.length);
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(option.id)}
              className={`relative flex min-h-[64px] min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 leading-tight transition-colors duration-200 ${FOCUS} ${
                selected
                  ? "border-2 border-brand-gold bg-[#1c1712] text-white shadow-[0_8px_18px_-10px_rgba(28,23,18,0.7)]"
                  : `border bg-brand-ivory text-brand-black hover:border-brand-gold ${hasOffer ? "border-brand-gold" : "border-brand-gold/45"}`
              }`}
            >
              {hasOffer ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 right-2 rounded-full bg-brand-gold px-1.5 py-0.5 text-[9px] leading-none font-bold tracking-[0.08em] text-brand-black uppercase"
                >
                  Offer
                </span>
              ) : null}
              <span className="text-[13.5px] sm:text-[15px]">{option.label}</span>
              <span className="text-[15px] font-bold sm:text-[17px]">{formatInr(option.priceInr)}</span>
              {option.mrpInr ? (
                <span className={`text-[11.5px] line-through sm:text-[12px] ${selected ? "text-white/60" : "text-brand-text/50"}`}>
                  <span className="sr-only">MRP </span>
                  {formatInr(option.mrpInr)}
                </span>
              ) : null}
              {hasOffer ? <span className="sr-only">, offer: {option.offers?.join(", ")}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- pricing panel --- */

interface PricePanelProps {
  option: ProductOption;
  productName: string;
  wishlisted?: boolean;
  onWishlist: () => void;
  /** Visual scale: "card" for product cards, "feature" for Best Sellers. */
  size?: "card" | "feature";
}

/**
 * Selling price (prominent), struck-through MRP and discount when configured,
 * wishlist heart aligned right, and floating offer badges above the panel.
 */
export function PricePanel({ option, productName, wishlisted = false, onWishlist, size = "card" }: PricePanelProps) {
  const discount = discountPercent(option);
  const offers = option.offers ?? [];
  const feature = size === "feature";

  return (
    <div className={`relative ${offers.length > 0 ? "pt-3" : ""}`}>
      {offers.length > 0 ? (
        <div className="absolute -top-0.5 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
          {offers.map((label) => (
            <OfferBadge key={label} label={label} />
          ))}
        </div>
      ) : null}
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border bg-white/70 ${
          offers.length > 0 ? "border-brand-gold/70" : "border-brand-gold/25"
        } ${feature ? "px-4 sm:px-5" : "px-3"} ${
          offers.length > 0 ? (feature ? "pt-6 pb-4" : "pt-5 pb-3") : feature ? "py-4" : "py-3"
        }`}
      >
        <div className="min-w-0" aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={`font-sans font-bold tracking-[-0.01em] text-brand-black lining-nums ${
                feature ? "text-[30px] sm:text-[34px]" : "text-[26px]"
              } leading-none`}
            >
              {formatInr(option.priceInr)}
            </span>
            <span className="sr-only"> for {option.label}</span>
            {option.mrpInr ? (
              <span className={`text-brand-text/50 line-through ${feature ? "text-[16px]" : "text-[14px]"}`}>
                <span className="sr-only">MRP </span>
                {formatInr(option.mrpInr)}
              </span>
            ) : null}
            {discount ? (
              <span
                className={`rounded-md bg-brand-gold/15 px-1.5 py-0.5 font-semibold text-[#7a5a2b] ring-1 ring-brand-gold/40 ${
                  feature ? "text-[13px]" : "text-[12px]"
                }`}
              >
                {discount}% off
              </span>
            ) : null}
          </p>
          {feature ? null : <p className="mt-1 text-[12px] text-brand-text/60">{option.label}</p>}
        </div>
        <button
          type="button"
          onClick={onWishlist}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
          className={`inline-flex shrink-0 items-center justify-center border border-brand-gold/70 bg-white text-brand-black transition-colors duration-200 hover:bg-brand-gold/10 ${FOCUS} ${
            feature ? "size-12 rounded-full shadow-[0_8px_18px_-10px_rgba(60,45,20,0.6)]" : "size-11 rounded-xl"
          }`}
        >
          <Heart
            aria-hidden="true"
            className={`transition-colors ${feature ? "size-[22px]" : "size-[21px]"} ${wishlisted ? "fill-brand-gold text-brand-gold" : ""}`}
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- add to cart --- */

export function AddToCartButton({
  onClick,
  disabled,
  srDetail,
  shape = "card",
}: {
  onClick: () => void;
  disabled?: boolean;
  /** Screen-reader context, e.g. "Black Velvet, 50 ml, ₹630". */
  srDetail?: string;
  shape?: "card" | "feature";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-3 bg-brand-black font-medium tracking-[0.02em] text-white transition-colors duration-200 hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold disabled:opacity-50 ${
        shape === "feature" ? "h-14 rounded-full text-[16px] font-semibold sm:text-[17px]" : "h-12 rounded-xl text-[15px]"
      }`}
    >
      <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={1.5} />
      Add to Cart
      {srDetail ? <span className="sr-only">: {srDetail}</span> : null}
    </button>
  );
}
