"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { PricePanel, SizePriceCards } from "@/components/pricing/PurchaseControls";
import { formatInr } from "@/data/products";
import { BUY_NOW_VIA_WHATSAPP, whatsappHref } from "@/data/store";
import { dispatchAddToCart, dispatchWishlist } from "@/lib/cart-events";
import type { ProductDetailData } from "./types";

const MAX_QTY = 10;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

/** Name, size, description, size/price selection, quantity, Add to Cart and Buy Now. */
export function ProductPurchase({ product }: { product: ProductDetailData }) {
  const { slug, name, category, description, options } = product;
  const [optionId, setOptionId] = useState(options[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [status, setStatus] = useState("");
  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const total = selected ? selected.priceInr * quantity : 0;

  const changeQty = (delta: number) => {
    setQuantity((q) => Math.min(MAX_QTY, Math.max(1, q + delta)));
    setStatus("");
  };

  const addToCart = () => {
    if (!selected) return;
    dispatchAddToCart({ slug, name, optionId: selected.id, optionLabel: selected.label, priceInr: selected.priceInr, quantity });
    setStatus(`Online cart is coming soon. Your selection: ${name}, ${selected.label} × ${quantity}.`);
  };

  const orderMessage = selected
    ? `Hello Luftansa, I would like to order: ${name} – ${selected.label} × ${quantity} (${formatInr(total)}). Please share the next steps.`
    : "";

  return (
    <div>
      <p className="inline-flex rounded-full border border-brand-gold/70 px-3 py-1 text-[10.5px] font-semibold tracking-[0.18em] text-brand-black uppercase">
        {category}
      </p>
      <h1 className="mt-3 font-serif text-[34px] leading-[1.05] font-semibold text-brand-black sm:text-[42px] lg:text-[46px]">
        {name}
      </h1>
      {selected ? (
        <p className="mt-1.5 text-[17px] font-medium text-brand-black sm:text-[18px]" aria-live="polite">
          {selected.label}
        </p>
      ) : null}
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-pretty text-brand-text/80 sm:text-[15px]">
        {description ?? <span className="text-brand-text/55 italic">Fragrance description coming soon.</span>}
      </p>

      {selected ? (
        <>
          <p id="pdp-size-label" className="mt-6 text-[13px] font-semibold tracking-[0.04em] text-brand-black">
            Size
          </p>
          <div className="mt-2">
            <SizePriceCards
              options={options}
              selectedId={selected.id}
              onSelect={(id) => {
                setOptionId(id);
                setStatus("");
              }}
              label={`Choose a size for ${name}`}
            />
          </div>

          <div className="mt-4">
            <PricePanel
              option={selected}
              productName={name}
              wishlisted={wishlisted}
              onWishlist={() => {
                const next = !wishlisted;
                setWishlisted(next);
                dispatchWishlist({ slug, name, wishlisted: next });
              }}
              size="feature"
            />
          </div>

          <p className="mt-5 text-[13px] font-semibold tracking-[0.04em] text-brand-black">Quantity</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <div className="flex h-12 items-center justify-between rounded-xl border border-brand-gold/50 bg-white sm:w-40">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className={`inline-flex size-12 items-center justify-center rounded-l-xl text-brand-black transition-colors hover:bg-brand-gold/10 disabled:opacity-35 ${FOCUS}`}
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <output aria-live="polite" aria-label="Quantity" className="min-w-8 text-center text-[16px] font-semibold text-brand-black">
                {quantity}
              </output>
              <button
                type="button"
                onClick={() => changeQty(1)}
                disabled={quantity >= MAX_QTY}
                aria-label="Increase quantity"
                className={`inline-flex size-12 items-center justify-center rounded-r-xl text-brand-black transition-colors hover:bg-brand-gold/10 disabled:opacity-35 ${FOCUS}`}
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={addToCart}
              className={`inline-flex h-12 w-full shrink-0 items-center justify-center gap-2.5 rounded-xl border-2 sm:w-auto sm:flex-1 border-brand-black bg-white text-[15px] font-semibold text-brand-black transition-colors hover:bg-brand-black hover:text-white ${FOCUS}`}
            >
              <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Add to Cart
              <span className="sr-only">: {name}, {selected.label}, quantity {quantity}</span>
            </button>
          </div>

          {quantity > 1 ? (
            <p className="mt-2.5 text-[13px] text-brand-text/75" aria-live="polite">
              Total for {quantity}: <span className="font-semibold text-brand-black">{formatInr(total)}</span>
            </p>
          ) : null}

          {BUY_NOW_VIA_WHATSAPP ? (
            <a
              href={whatsappHref(orderMessage)}
              target="_blank"
              rel="noopener noreferrer"
              data-buy-now
              className={`mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-black text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-text ${FOCUS}`}
            >
              Buy Now
              <span className="sr-only">: order {name}, {selected.label}, quantity {quantity} on WhatsApp (opens in a new tab)</span>
            </a>
          ) : (
            <button
              type="button"
              data-buy-now
              onClick={() => setStatus("Online checkout is coming soon.")}
              className={`mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-black text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-text ${FOCUS}`}
            >
              Buy Now
            </button>
          )}
          {BUY_NOW_VIA_WHATSAPP ? (
            <p className="mt-2 text-center text-[12px] text-brand-text/60">Buy Now opens a prefilled order on WhatsApp.</p>
          ) : null}
          <p role="status" className="mt-1 min-h-[1.25rem] text-[12.5px] text-brand-text/70">
            {status}
          </p>
        </>
      ) : (
        <p className="mt-6 text-[13px] text-brand-text/60">Sizes &amp; pricing coming soon</p>
      )}
    </div>
  );
}
