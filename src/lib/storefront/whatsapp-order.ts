/**
 * WhatsApp ordering (pure, no I/O).
 *
 * There is no online cart or checkout yet. Orders are placed by sending a
 * prefilled WhatsApp message to the confirmed store number (src/data/store.ts).
 * The message carries everything needed to fulfil the order: product, selected
 * size and its variant ID, quantity, unit price and total. It makes no promise
 * about delivery, payment or availability; the store confirms those.
 */
import { formatInr } from "@/data/products";
import { whatsappHref } from "@/data/store";

export interface WhatsAppOrderInput {
  productName: string;
  /** Product ID (slug). */
  productId: string;
  /** Variant ID, exactly as stored (e.g. "50ml", "00050"). */
  variantId: string;
  /** Variant label, e.g. "50 ml". */
  variantLabel: string;
  /** Selling price of one unit of the selected variant (INR). */
  unitPriceInr: number;
  quantity: number;
}

export function buildWhatsAppOrderMessage(order: WhatsAppOrderInput): string {
  const quantity = Math.max(1, Math.floor(order.quantity));
  const total = order.unitPriceInr * quantity;
  return [
    "Hello Luftansa, I would like to place an order:",
    "",
    `Product: ${order.productName}`,
    `Size: ${order.variantLabel}`,
    `Quantity: ${quantity}`,
    `Price: ${formatInr(order.unitPriceInr)} each`,
    `Total: ${formatInr(total)}`,
    `Product code: ${order.productId} / ${order.variantId}`,
    "",
    "Please confirm availability, payment and delivery details.",
  ].join("\n");
}

/** wa.me link with the prepared order message. */
export function whatsAppOrderHref(order: WhatsAppOrderInput): string {
  return whatsappHref(buildWhatsAppOrderMessage(order));
}
