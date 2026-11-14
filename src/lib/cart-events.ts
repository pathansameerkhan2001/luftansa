/**
 * Browser events for the future cart / wishlist integration.
 *
 * No cart or wishlist backend exists yet. Purchase controls dispatch these
 * events so an integration can subscribe without touching the UI components:
 *   window.addEventListener(ADD_TO_CART_EVENT, (e) => cart.add(e.detail));
 */
export const ADD_TO_CART_EVENT = "luftansa:add-to-cart";
export const WISHLIST_EVENT = "luftansa:wishlist";

export interface AddToCartDetail {
  slug: string;
  name: string;
  optionId: string;
  optionLabel: string;
  /** Unit price. */
  priceInr: number;
  /** Defaults to 1. */
  quantity?: number;
}

export function dispatchAddToCart(detail: AddToCartDetail) {
  window.dispatchEvent(new CustomEvent<AddToCartDetail>(ADD_TO_CART_EVENT, { detail }));
}

export function dispatchWishlist(detail: { slug: string; name: string; wishlisted?: boolean }) {
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT, { detail }));
}
