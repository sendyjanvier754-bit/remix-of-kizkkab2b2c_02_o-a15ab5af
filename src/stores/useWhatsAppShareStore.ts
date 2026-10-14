import { create } from 'zustand';

export interface WhatsAppShareProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  currency?: string;
  image?: string;
  sourceProductId?: string;
  storeId?: string;
  storeWhatsapp?: string;
}

type State = {
  isOpen: boolean;
  product: WhatsAppShareProduct | null;
  open: (p: WhatsAppShareProduct) => void;
  close: () => void;
};

export const useWhatsAppShareStore = create<State>((set) => ({
  isOpen: false,
  product: null,
  open: (product) => set({ isOpen: true, product }),
  close: () => set({ isOpen: false, product: null }),
}));
