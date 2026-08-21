import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface B2CCatalogVariant {
  id: string;               // seller_catalog_variants.id (row id) or product_variants.id on fallback
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

const extractAttrs = (pv: { attribute_combination: any; option_type?: string | null; option_value?: string | null } | undefined) => {
  const attrs = (pv?.attribute_combination as Record<string, any>) || {};
  const color = attrs.color ?? (pv?.option_type === 'color' ? pv?.option_value : null) ?? null;
  const size =
    attrs.size ?? attrs.talla ??
    (pv?.option_type === 'size' || pv?.option_type === 'talla' ? pv?.option_value : null) ?? null;
  return { attrs, color, size };
};

/**
 * Fetches all variants shown to a B2C customer for a given seller_catalog entry.
 *
 * Primary source: seller_catalog_variants (seller-configured prices/stock).
 * Fallback: the source product's product_variants (same data the seller cart uses),
 * priced with the catalog's precio_venta, so customers always see the same variant
 * options the seller sees.
 */
export const useB2CCatalogVariants = (catalogId: string | null) => {
  return useQuery<B2CCatalogVariant[]>({
    queryKey: ['b2c-catalog-variants', catalogId],
    enabled: !!catalogId,
    staleTime: 60_000,
    queryFn: async () => {
      // Catalog entry (needed for fallback pricing + source product)
      const { data: catalogEntry } = await supabase
        .from('seller_catalog')
        .select('id, source_product_id, precio_venta')
        .eq('id', catalogId!)
        .maybeSingle();

      // Step 1: fetch seller_catalog_variants (no stock filter: out-of-stock options stay visible)
      const { data: variants, error: variantsError } = await supabase
        .from('seller_catalog_variants')
        .select('id, sku, precio_override, stock, is_available, availability_status, variant_id')
        .eq('seller_catalog_id', catalogId!)
        .order('created_at', { ascending: true });

      if (variantsError) throw variantsError;

      if (variants && variants.length > 0) {
        // Step 2: fetch product_variants to get attributes/images
        const productVariantIds = variants.map(v => v.variant_id).filter(Boolean);
        const productVariantMap = new Map<string, any>();

        if (productVariantIds.length > 0) {
          const { data: pvData } = await supabase
            .from('product_variants')
            .select('id, attribute_combination, images, option_type, option_value')
            .in('id', productVariantIds);

          (pvData || []).forEach(pv => productVariantMap.set(pv.id, pv));
        }

        return variants.map(v => {
          const pv = v.variant_id ? productVariantMap.get(v.variant_id) : undefined;
          const { attrs, color, size } = extractAttrs(pv);
          return {
            id: v.id,
            productVariantId: v.variant_id,
            sku: v.sku || '',
            price: Number(v.precio_override) || Number(catalogEntry?.precio_venta) || 0,
            stock: v.stock || 0,
            availabilityStatus: ((v as any).availability_status ?? null) as B2CCatalogVariant['availabilityStatus'],
            color,
            size,
            variantAttributes: attrs,
            isAvailable: v.is_available ?? true,
            images: pv?.images || null,
          };
        });
      }

      // Fallback: use the source product's variants (same source as the seller cart)
      if (!catalogEntry?.source_product_id) return [];

      const { data: pvData, error: pvError } = await supabase
        .from('product_variants')
        .select('id, sku, price, stock, images, attribute_combination, option_type, option_value')
        .eq('product_id', catalogEntry.source_product_id)
        .eq('is_active', true)
        .order('sku', { ascending: true });

      if (pvError) throw pvError;

      const basePrice = Number(catalogEntry.precio_venta) || 0;

      return (pvData || []).map(pv => {
        const { attrs, color, size } = extractAttrs(pv);
        return {
          id: pv.id,
          productVariantId: pv.id,
          sku: pv.sku || '',
          price: basePrice || Number(pv.price) || 0,
          stock: pv.stock ?? 0,
          availabilityStatus: null,
          color,
          size,
          variantAttributes: attrs,
          isAvailable: true,
          images: Array.isArray(pv.images) ? (pv.images as string[]) : null,
        };
      });
    },
  });
};
