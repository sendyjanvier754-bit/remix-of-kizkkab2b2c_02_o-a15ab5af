import { create } from 'zustand';

export interface VariantDrawerProduct {
  id: string;
  sku?: string;
  nombre: string;
  images?: string[];
  price?: number;
  costB2B?: number;
  pvp?: number;
  moq?: number;
  stock?: number;
  source_product_id?: string;
  description?: string;
  /** ID de la tienda vendedora (para atribución de venta) */
  storeId?: string;
  /** ID del registro en seller_catalog (para atribución de venta) */
  sellerCatalogId?: string;
}

type State = {
  isOpen: boolean;
  product?: VariantDrawerProduct | null;
  onComplete?: (() => void) | null;
  open: (product: VariantDrawerProduct, onComplete?: () => void) => void;
  close: () => void;
};

export const useVariantDrawerStore = create<State>((set) => ({
  isOpen: false,
  product: null,
  onComplete: null,
  open: (product, onComplete) => set({ isOpen: true, product, onComplete: onComplete || null }),
  close: () => set({ isOpen: false, product: null, onComplete: null }),
}));

export default useVariantDrawerStore;
