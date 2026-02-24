/**
 * Hook to calculate product-level totals from B2B cart items
 * Used for MOQ validation at the product level (not variant level)
 *
 * @param externalItems - Optional: pass the optimistic local items from the page
 *   so MOQ validation reacts instantly to quantity changes without waiting for
 *   a DB round-trip / Supabase subscription.
 *   If not provided the hook reads from its own useB2BCartItems instance.
 */
import { useMemo } from 'react';
import { useB2BCartItems, type B2BCartItem } from './useB2BCartItems';

export interface ProductCartTotal {
  productId: string;
  productName: string;
  totalQuantity: number;
  moq: number;
  missingQuantity: number; // How many more units needed to meet MOQ
  meetsMinimum: boolean;
  variants: {
    sku: string;
    name: string;
    quantity: number;
    color?: string;
    size?: string;
  }[];
}

export const useB2BCartProductTotals = (externalItems?: B2BCartItem[]) => {
  const { items: dbItems, isLoading, error, refetch } = useB2BCartItems();

  // Prefer caller-supplied optimistic state; fall back to DB-fetched items
  const items = externalItems ?? dbItems;

  // Aggregate cart items by product_id
  const productTotals = useMemo(() => {
    if (!items || items.length === 0) return new Map<string, ProductCartTotal>();

    const totalsMap = new Map<string, ProductCartTotal>();

    items.forEach(item => {
      const productId = item.productId || item.sku; // Fallback to SKU if no product_id
      
      if (!totalsMap.has(productId)) {
        totalsMap.set(productId, {
          productId,
          productName: item.name,
          totalQuantity: 0,
          moq: item.moq || 1,
          missingQuantity: 0,
          meetsMinimum: true,
          variants: [],
        });
      }

      const productTotal = totalsMap.get(productId)!;
      productTotal.totalQuantity += item.cantidad;
      productTotal.variants.push({
        sku: item.sku,
        name: item.name,
        quantity: item.cantidad,
        color: item.color,
        size: item.size,
      });
    });

    // Calculate missing quantities and validation
    totalsMap.forEach(product => {
      product.missingQuantity = Math.max(0, product.moq - product.totalQuantity);
      product.meetsMinimum = product.totalQuantity >= product.moq;
    });

    return totalsMap;
  }, [items]);

  // Get total for a specific product
  const getProductTotal = (productId: string): ProductCartTotal | undefined => {
    return productTotals.get(productId);
  };

  // Check if a product meets MOQ
  const productMeetsMOQ = (productId: string, moq: number = 1): boolean => {
    const total = productTotals.get(productId);
    return total ? total.totalQuantity >= moq : false;
  };

  // Get quantity needed to meet MOQ for a product
  const getQuantityNeeded = (productId: string, moq: number = 1, additionalQty: number = 0): number => {
    const currentTotal = productTotals.get(productId)?.totalQuantity || 0;
    return Math.max(0, moq - (currentTotal + additionalQty));
  };

  // Check if adding items would meet MOQ
  const wouldMeetMOQ = (productId: string, moq: number, addingQty: number): boolean => {
    const currentTotal = productTotals.get(productId)?.totalQuantity || 0;
    return (currentTotal + addingQty) >= moq;
  };

  // Get all products that don't meet MOQ
  const productsNotMeetingMOQ = useMemo(() => {
    return Array.from(productTotals.values()).filter(p => !p.meetsMinimum);
  }, [productTotals]);

  // Check if cart is valid for checkout (all products meet MOQ)
  const isCartValid = useMemo(() => {
    return productsNotMeetingMOQ.length === 0;
  }, [productsNotMeetingMOQ]);

  return {
    productTotals,
    getProductTotal,
    productMeetsMOQ,
    getQuantityNeeded,
    wouldMeetMOQ,
    productsNotMeetingMOQ,
    isCartValid,
    isLoading,
    error,
    refetch,
  };
};
