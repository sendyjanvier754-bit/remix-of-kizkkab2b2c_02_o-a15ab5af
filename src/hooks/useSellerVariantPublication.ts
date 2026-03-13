import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductVariantFull {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  option_type: string | null;
  option_value: string | null;
  attribute_combination: Record<string, any> | null;
  stock: number;
  images: string[] | null;
  is_active: boolean;
  price: number | null;
  cost_price: number | null;
}

export interface SellerVariantConfig {
  variantId: string;
  sku: string;
  label: string;
  images: string[];
  attributeCombination: Record<string, any>;
  // Purchased stock from B2B
  purchasedStock: number;
  // Seller configuration
  isEnabled: boolean;
  stockToSell: number;
  priceOverride: number;
  // Existing seller_catalog_variants row id (if any)
  existingId?: string;
}

export interface UseSellerVariantPublicationResult {
  variants: SellerVariantConfig[];
  isLoading: boolean;
  isSaving: boolean;
  updateVariant: (variantId: string, updates: Partial<Pick<SellerVariantConfig, 'isEnabled' | 'stockToSell' | 'priceOverride'>>) => void;
  saveAll: () => Promise<boolean>;
}

/**
 * Hook to manage which variants a seller wants to publish (B2C), their prices and stock.
 * 
 * @param catalogId - seller_catalog.id (the seller's catalog entry for this product)
 * @param sourceProductId - products.id (the admin product from which variants come)
 * @param defaultPrice - Default price to pre-fill for new variants
 */
export const useSellerVariantPublication = (
  catalogId: string | null,
  sourceProductId: string | null,
  defaultPrice: number = 0
): UseSellerVariantPublicationResult => {
  const [variants, setVariants] = useState<SellerVariantConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!catalogId || !sourceProductId) return;
    setIsLoading(true);
    try {
      // Fetch all admin-defined variants for this source product
      const { data: productVariants, error: pvError } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, name, option_type, option_value, attribute_combination, stock, images, is_active, price, cost_price')
        .eq('product_id', sourceProductId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (pvError) throw pvError;

      // Fetch existing seller_catalog_variants for this catalog entry
      const { data: sellerVariants, error: svError } = await supabase
        .from('seller_catalog_variants')
        .select('id, variant_id, sku, stock, precio_override, is_available')
        .eq('seller_catalog_id', catalogId);

      if (svError) throw svError;

      const sellerVariantMap = new Map<string, any>(
        (sellerVariants || []).map(sv => [sv.variant_id, sv])
      );

      const configs: SellerVariantConfig[] = (productVariants || []).map(pv => {
        const existing = sellerVariantMap.get(pv.id);
        const attrCombo = (pv.attribute_combination as Record<string, any>) || {};

        // Build label from attribute_combination: e.g. "Rojo / Talla S"
        const attrLabel = Object.values(attrCombo)
          .filter(Boolean)
          .map(v => String(v))
          .join(' / ');
        const label = attrLabel || pv.name || pv.option_value || pv.sku;

        return {
          variantId: pv.id,
          sku: pv.sku,
          label,
          images: (pv.images as string[]) || [],
          attributeCombination: attrCombo,
          purchasedStock: pv.stock || 0,
          isEnabled: existing ? (existing.is_available ?? true) : false,
          stockToSell: existing?.stock ?? Math.min(pv.stock || 0, 1),
          priceOverride: existing?.precio_override
            ? Number(existing.precio_override)
            : defaultPrice > 0 ? defaultPrice : (pv.price ? Number(pv.price) : 0),
          existingId: existing?.id,
        };
      });

      setVariants(configs);
    } catch (err) {
      console.error('useSellerVariantPublication load error:', err);
      toast.error('Error al cargar variantes');
    } finally {
      setIsLoading(false);
    }
  }, [catalogId, sourceProductId, defaultPrice]);

  useEffect(() => {
    load();
  }, [load]);

  const updateVariant = useCallback((variantId: string, updates: Partial<Pick<SellerVariantConfig, 'isEnabled' | 'stockToSell' | 'priceOverride'>>) => {
    setVariants(prev => prev.map(v => v.variantId === variantId ? { ...v, ...updates } : v));
  }, []);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!catalogId) return false;
    setIsSaving(true);
    try {
      for (const v of variants) {
        if (v.existingId) {
          // Update existing row
          const { error } = await supabase
            .from('seller_catalog_variants')
            .update({
              stock: v.isEnabled ? v.stockToSell : 0,
              precio_override: v.priceOverride,
              is_available: v.isEnabled,
            })
            .eq('id', v.existingId);
          if (error) throw error;
        } else if (v.isEnabled) {
          // Insert new row only if enabled
          const { error } = await supabase
            .from('seller_catalog_variants')
            .insert({
              seller_catalog_id: catalogId,
              variant_id: v.variantId,
              sku: v.sku,
              stock: v.stockToSell,
              precio_override: v.priceOverride,
              is_available: true,
            });
          if (error) throw error;
        }
        // if not enabled and no existing row → skip (don't create a disabled row)
      }

      toast.success('Variantes actualizadas correctamente');
      await load(); // Refresh to get new IDs
      return true;
    } catch (err: any) {
      console.error('useSellerVariantPublication save error:', err);
      toast.error('Error al guardar variantes', { description: err.message });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [catalogId, variants, load]);

  return { variants, isLoading, isSaving, updateVariant, saveAll };
};
