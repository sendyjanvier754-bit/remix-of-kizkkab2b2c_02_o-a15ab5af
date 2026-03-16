import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface B2CCatalogVariant {
  id: string;               // seller_catalog_variants.id (row id)
  productVariantId: string; // product_variants.id — matches b2c_cart_items.variant_id
  sku: string;
  price: number;            // precio_override (seller's configured price)
  stock: number;
  availabilityStatus: 'pending' | 'available' | 'out_of_stock' | null;
  color: string | null;
  size: string | null;
  variantAttributes: Record<string, any>;
  isAvailable: boolean;
  images: string[] | null;
}

/**
 * Fetches all active variants for a given seller_catalog entry.
 * Used by the CartPage variant-change drawer to show the seller's current prices.
 */
export const useB2CCatalogVariants = (catalogId: string | null) => {
  return useQuery<B2CCatalogVariant[]>({
    queryKey: ['b2c-catalog-variants', catalogId],
    enabled: !!catalogId,
    staleTime: 60_000,
    queryFn: async () => {
      // Step 1: fetch seller_catalog_variants (only columns that actually exist)
      const { data: variants, error: variantsError } = await supabase
        .from('seller_catalog_variants')
        .select('id, sku, precio_override, stock, is_available, availability_status, variant_id')
        .eq('seller_catalog_id', catalogId!)
        .gt('stock', 0)
        .or('is_available.eq.true,availability_status.eq.pending')
        .order('created_at', { ascending: true });

      if (variantsError) throw variantsError;
      if (!variants || variants.length === 0) return [];

      // Step 2: fetch product_variants to get attributes/images
      const productVariantIds = variants.map(v => v.variant_id).filter(Boolean);
      const productVariantMap = new Map<string, { attribute_combination: any; images: string[] | null; option_type: string | null; option_value: string | null }>();

      if (productVariantIds.length > 0) {
        const { data: pvData } = await supabase
          .from('product_variants')
          .select('id, attribute_combination, images, option_type, option_value')
          .in('id', productVariantIds);

        (pvData || []).forEach(pv => {
          productVariantMap.set(pv.id, {
            attribute_combination: pv.attribute_combination,
            images: pv.images,
            option_type: pv.option_type,
            option_value: pv.option_value,
          });
        });
      }

      return variants.map(v => {
        const pv = v.variant_id ? productVariantMap.get(v.variant_id) : undefined;
        const attrs = (pv?.attribute_combination as Record<string, any>) || {};
        const color = attrs.color ?? (pv?.option_type === 'color' ? pv.option_value : null) ?? null;
        const size = attrs.size ?? attrs.talla ?? (pv?.option_type === 'size' || pv?.option_type === 'talla' ? pv?.option_value : null) ?? null;
        return {
          id: v.id,
          productVariantId: v.variant_id,
          sku: v.sku || '',
          price: Number(v.precio_override) || 0,
          stock: v.stock || 0,
          availabilityStatus: ((v as any).availability_status ?? null) as 'pending' | 'available' | 'out_of_stock' | null,
          color,
          size,
          variantAttributes: attrs,
          isAvailable: v.is_available ?? true,
          images: pv?.images || null,
        };
      });
    },
  });
};
