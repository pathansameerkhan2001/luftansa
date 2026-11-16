"use client";

import { ChevronDown, MessageCircle, Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { discountPercent, formatInr, type ProductOption } from "@/data/products";
import { BUY_NOW_VIA_WHATSAPP, CONTACT } from "@/data/store";
import { clampQuantity, maxQuantityFor } from "@/lib/storefront/quantity";
import { buildWhatsAppOrderMessage, whatsAppOrderHref, type WhatsAppOrderInput } from "@/lib/storefront/whatsapp-order";
import type { ProductDetailData } from "./types";

const LOW_STOCK = 5;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

function StockNote({ option }: { option: ProductOption }) {
  const stock = option.stockQuantity;
  if (stock === undefined) return null; // not configured: say nothing
  if (stock <= 0) return <p className="text-[13px] font-semibold text-[#9a3b2b]">Out of stock in {option.label}</p>;
  if (stock <= LOW_STOCK)
    return (
      <p className="text-[13px] font-medium text-[#7a5a2b]">
        Only {stock} left in {option.label}
      </p>
    );
  return (
    <p className="inline-flex items-center gap-2 text-[13px] text-brand-text/75">
      <span aria-hidden="true" className="size-2 rounded-full bg-[#4f7a4a]" />
      In stock
    </p>
  );
}

/** Size selector: radio group of size cards (label + price), arrow-key navigable. */
function SizeSelector({
  options,
  selectedId,
  onSelect,
  productName,
}: {
  options: readonly ProductOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  productName: string;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((o) => o.id === selectedId);

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.id === selectedId);
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const j = (i + delta + options.length) % options.length;
    onSelect(options[j].id);
    refs.current[j]?.focus();
  };

  return (
    <div>
      <p id={labelId} className="text-[13px] font-semibold tracking-[0.04em] text-brand-black">
        Size: <span className="font-normal text-brand-text/80">{selected?.label}</span>
        <span className="sr-only"> for {productName}</span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeys}
        className={`mt-2.5 grid gap-2 sm:gap-3 ${options.length >= 3 ? "grid-cols-3" : options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:max-w-[200px]"}`}
      >
        {options.map((option, i) => {
          const isSelected = option.id === selectedId;
          const soldOut = option.stockQuantity !== undefined && option.stockQuantity <= 0;
          return (
            <button
              key={option.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(option.id)}
              className={`relative flex min-h-[64px] min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2.5 leading-tight transition-[background-color,border-color,box-shadow] duration-200 ${FOCUS} ${
                isSelected
                  ? "border-2 border-brand-gold bg-[#1c1712] text-white shadow-[0_10px_22px_-12px_rgba(28,23,18,0.75)]"
                  : "border border-brand-gold/45 bg-white text-brand-black hover:border-brand-gold hover:bg-brand-ivory"
              }`}
            >
              <span className="text-[14px] font-medium sm:text-[15px]">{option.label}</span>
              <span className={`mt-1 text-[13px] lining-nums sm:text-[13.5px] ${isSelected ? "text-white/80" : "text-brand-text/70"}`}>
                {formatInr(option.priceInr)}
              </span>
              {soldOut ? <span className="mt-0.5 text-[10.5px] tracking-wide uppercase opacity-75">Sold out</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuantityStepper({
  quantity,
  max,
  onChange,
  disabled,
  compact = false,
}: {
  quantity: number;
  max: number;
  onChange: (q: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const size = compact ? "size-10" : "size-12";
  return (
    <div
      role="group"
      aria-label="Quantity"
      className={`flex shrink-0 items-center justify-between rounded-xl border border-brand-gold/50 bg-white ${compact ? "h-10 w-[112px]" : "h-12 w-[136px]"}`}
    >
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={disabled || quantity <= 1}
        aria-label="Decrease quantity"
        className={`inline-flex ${size} items-center justify-center rounded-l-xl text-brand-black transition-colors hover:bg-brand-gold/10 disabled:opacity-35 ${FOCUS}`}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-6 text-center text-[16px] font-semibold text-brand-black tabular-nums">
        {quantity}
      </output>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disabled || quantity >= max}
        aria-label="Increase quantity"
        className={`inline-flex ${size} items-center justify-center rounded-r-xl text-brand-black transition-colors hover:bg-brand-gold/10 disabled:opacity-35 ${FOCUS}`}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/**
 * Name, confirmed facts, price, size, quantity and ordering, plus a sticky
 * mobile order bar that appears only while the main button is off screen (so
 * it never covers it).
 *
 * Ordering: there is no online cart or checkout yet, so no Add to Cart is
 * shown. "Order on WhatsApp" opens a chat with the confirmed store number with
 * the product, size (variant ID), quantity, unit price and total prefilled
 * (src/lib/storefront/whatsapp-order.ts); the shopper can preview that message
 * on the page. Disabled via BUY_NOW_VIA_WHATSAPP in src/data/store.ts.
 */
export function ProductPurchase({ product }: { product: ProductDetailData }) {
  const { slug, name, category, description, options, concentration, gender } = product;
  const [optionId, setOptionId] = useState(options[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [showBar, setShowBar] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const max = maxQuantityFor(selected);
  const soldOut = max === 0;
  const total = selected ? selected.priceInr * quantity : 0;
  const discount = selected ? discountPercent(selected) : undefined;
  const facts = [concentration, gender].filter(Boolean);

  // Sticky bar: visible only while the main purchase buttons are out of view
  // and the end of the product content has not been reached.
  useEffect(() => {
    const actions = actionsRef.current;
    const end = document.getElementById("pdp-end");
    if (!actions) return;
    // A rAF-throttled scroll check (not IntersectionObserver): it also handles
    // jumps that skip straight past the end marker (e.g. the End key).
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const a = actions.getBoundingClientRect();
        const actionsVisible = a.bottom > 0 && a.top < window.innerHeight;
        const endReached = end ? end.getBoundingClientRect().top < window.innerHeight : false;
        setShowBar(!actionsVisible && !endReached);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const selectOption = (id: string) => {
    setOptionId(id);
    const next = options.find((o) => o.id === id);
    setQuantity((q) => clampQuantity(q, next));
  };

  const changeQty = (q: number) => setQuantity(clampQuantity(q, selected));

  const order: WhatsAppOrderInput | undefined = selected
    ? {
        productName: name,
        productId: slug,
        variantId: selected.id,
        variantLabel: selected.label,
        unitPriceInr: selected.priceInr,
        quantity,
      }
    : undefined;
  const canOrder = BUY_NOW_VIA_WHATSAPP && Boolean(order) && !soldOut;
  const orderHref = order ? whatsAppOrderHref(order) : undefined;
  const orderSr = selected ? `: ${name}, ${selected.label}, quantity ${quantity}, total ${formatInr(total)} (opens WhatsApp in a new tab)` : "";

  return (
    <div>
      <p className="inline-flex rounded-full border border-brand-gold/70 px-3 py-1 text-[10.5px] font-semibold tracking-[0.18em] text-brand-black uppercase">
        {category}
      </p>
      <h1 className="mt-3 font-serif text-[36px] leading-[1.04] font-semibold text-balance text-brand-black sm:text-[44px] lg:text-[48px]">
        {name}
      </h1>
      {facts.length > 0 ? (
        <p className="mt-2 text-[12.5px] font-medium tracking-[0.16em] text-brand-text/70 uppercase">{facts.join(" · ")}</p>
      ) : null}

      {selected ? (
        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
          <span className="font-sans text-[30px] leading-none font-bold tracking-[-0.01em] text-brand-black lining-nums sm:text-[32px]">
            {formatInr(selected.priceInr)}
          </span>
          {selected.mrpInr ? (
            <span className="text-[16px] text-brand-text/50 line-through">
              <span className="sr-only">MRP </span>
              {formatInr(selected.mrpInr)}
            </span>
          ) : null}
          {discount ? (
            <span className="rounded-md bg-brand-gold/15 px-2 py-0.5 text-[12.5px] font-semibold text-[#7a5a2b] ring-1 ring-brand-gold/40">
              {discount}% off
            </span>
          ) : null}
          <span className="text-[13.5px] text-brand-text/65">for {selected.label}</span>
        </div>
      ) : null}

      {description ? (
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-pretty text-brand-text/80 sm:text-[15.5px]">{description}</p>
      ) : null}

      <div aria-hidden="true" className="mt-6 h-px bg-gradient-to-r from-brand-gold/50 via-brand-gold/25 to-transparent" />

      {selected && order ? (
        <>
          <div className="mt-6">
            <SizeSelector options={options} selectedId={selected.id} onSelect={selectOption} productName={name} />
          </div>

          {selected.stockQuantity !== undefined ? (
            <div className="mt-4">
              <StockNote option={selected} />
            </div>
          ) : null}

          <p className="mt-6 text-[13px] font-semibold tracking-[0.04em] text-brand-black">Quantity</p>
          <div ref={actionsRef} className="mt-2.5">
            <div className="flex gap-3">
              <QuantityStepper quantity={quantity} max={max} onChange={changeQty} disabled={soldOut} />
              {canOrder ? (
                <a
                  href={orderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-whatsapp-order
                  className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-xl bg-brand-black px-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-text ${FOCUS}`}
                >
                  <MessageCircle aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
                  Order on WhatsApp
                  <span className="sr-only">{orderSr}</span>
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-brand-gold/50 bg-white px-3 text-[14.5px] font-semibold text-brand-text/55"
                >
                  {soldOut ? "Out of stock" : "Online ordering coming soon"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-4 rounded-xl bg-brand-cream/80 px-4 py-3 ring-1 ring-brand-gold/25">
            <span className="text-[13px] text-brand-text/75">
              Order total <span className="text-brand-text/55">({selected.label} × {quantity})</span>
            </span>
            <span aria-live="polite" className="text-[17px] font-bold text-brand-black tabular-nums">
              {formatInr(total)}
            </span>
          </div>

          <p className="mt-3 text-[12.5px] leading-relaxed text-brand-text/70">
            {canOrder ? (
              <>
                Online cart and checkout are not available yet. Orders are placed on WhatsApp: the button opens a chat with
                Luftansa ({CONTACT.phone}) with your order details filled in, and our team confirms availability, payment
                and delivery with you. Nothing is charged on this website.
              </>
            ) : (
              <>
                Online ordering is not available yet. For orders, contact Luftansa on {CONTACT.phone} or {CONTACT.email}.
              </>
            )}
          </p>

          {canOrder ? (
            <details className="group mt-3 rounded-xl border border-brand-gold/30 bg-white/70" data-order-preview>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold [&::-webkit-details-marker]:hidden">
                Preview your WhatsApp order message
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-brand-gold transition-transform group-open:rotate-180" strokeWidth={1.75} />
              </summary>
              <pre className="mx-4 mb-4 overflow-x-auto rounded-lg bg-[#e7f3e3] px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-brand-black ring-1 ring-[#cfe3c8]">
                {buildWhatsAppOrderMessage(order)}
              </pre>
            </details>
          ) : null}

          {/* Sticky mobile order bar (only while the main order button is off screen). */}
          {canOrder ? (
            <div
              aria-hidden={!showBar}
              inert={!showBar}
              className={`fixed inset-x-0 bottom-0 z-30 border-t border-brand-gold/35 bg-brand-ivory/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_28px_-18px_rgba(23,23,23,0.45)] backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none lg:hidden ${
                showBar ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[17px] leading-tight font-semibold text-brand-black">{name}</p>
                  <p className="text-[13px] text-brand-text/75 tabular-nums">
                    {selected.label} × {quantity} · <span className="font-semibold text-brand-black">{formatInr(total)}</span>
                  </p>
                </div>
                <a
                  href={orderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-black px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-text ${FOCUS}`}
                >
                  <MessageCircle aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                  Order on WhatsApp
                  <span className="sr-only">{orderSr}</span>
                </a>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-[13px] text-brand-text/60">Sizes &amp; pricing coming soon</p>
      )}
    </div>
  );
}
