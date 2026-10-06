export interface CartAddedDetail {
  name: string;
  image?: string;
  quantity?: number;
  price?: number;
  variant?: string;
  isB2B?: boolean;
}

export const CART_ADDED_EVENT = "cart:item-added";

export const notifyCartAdded = (detail: CartAddedDetail) => {
  window.dispatchEvent(new CustomEvent<CartAddedDetail>(CART_ADDED_EVENT, { detail }));
};
