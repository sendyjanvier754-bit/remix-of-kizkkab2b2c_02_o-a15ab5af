import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BulkPriceItem {
  id: string;
  sku: string;
  nombre: string;
  precioActual: number;
  precioNuevo: number;
  precioCosto: number;
  sourceProductId?: string | null;
  sourceVariantId?: string | null;
  isManualPrice?: boolean;
}

// --- Helpers for batch updates ---

async function batchUpdate(
  items: Array<{ id: string; precio: number; isManual: boolean }>,
) {
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const promises = chunk.map(u =>
      supabase
        .from('seller_catalog_variants' as any)
        .update({
          precio_override: u.precio,
          is_manual_price: u.isManual,
          updated_at: new Date().toISOString(),
        })
        .eq('id', u.id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Batch update errors:', errors);
      throw new Error(`${errors.length} errores al actualizar`);
    }
  }
}

// --- Resolve store country ---

async function resolveStoreCountry(storeId: string): Promise<string | null> {
  const { data: storeData } = await supabase
    .from('stores')
    .select('market_id, destination_country_id')
    .eq('id', storeId)
    .maybeSingle();

  const directCountryId = (storeData as any)?.destination_country_id;
  if (directCountryId) return directCountryId;

  const marketId = (storeData as any)?.market_id;
  if (!marketId) return null;

  const { data: market } = await supabase
    .from('markets')
    .select('destination_country_id')
    .eq('id', marketId)
    .maybeSingle();

  return market?.destination_country_id || null;
}

// --- Fetch PVP data from business panel, with shipping fallback ---

async function fetchBpData(sourceIds: string[], storeId?: string | null) {
  const { data, error } = await supabase
    .from('v_business_panel_data')
    .select('product_id, variant_id, item_type, suggested_pvp_per_unit, cost_per_unit, item_name')
    .in('product_id', sourceIds)
    .eq('is_active', true);

  if (error) throw error;

  const variantPvpMap = new Map<string, number>();
  const productPvpMap = new Map<string, number>();

  // Collect items that need shipping cost resolution (null suggested_pvp)
  const needsShipping: Array<{ product_id: string; variant_id: string | null; item_type: string; cost_per_unit: number }> = [];

  for (const r of (data || []) as any[]) {
    if (r.suggested_pvp_per_unit != null && r.suggested_pvp_per_unit > 0) {
      // View already has the full PVP — use it directly
      const pvp = Number(r.suggested_pvp_per_unit);
      if (r.item_type === 'variant' && r.variant_id) {
        variantPvpMap.set(r.variant_id, pvp);
      } else if (r.item_type === 'product' && r.product_id) {
        productPvpMap.set(r.product_id, pvp);
      }
    } else if (r.cost_per_unit != null && r.cost_per_unit > 0) {
      needsShipping.push(r);
    }
  }

  // For items missing PVP, resolve country from store and calculate shipping
  if (needsShipping.length > 0 && storeId) {
    const countryId = await resolveStoreCountry(storeId);

    if (countryId) {
      // Get unique product_ids that need shipping
      const productIdsForShipping = [...new Set(needsShipping.map(r => r.product_id))];

      // Call RPC for each product
      const shippingResults = await Promise.all(
        productIdsForShipping.map(pid =>
          supabase.rpc('get_product_shipping_cost_by_country', {
            p_product_id: pid,
            p_destination_country_id: countryId,
            p_tier_type: 'standard',
          }).then(({ data, error }) => ({ pid, data, error }))
        )
      );

      const shippingMap = new Map<string, number>();
      for (const { pid, data: sData } of shippingResults) {
        if (sData && sData[0]?.is_available) {
          shippingMap.set(pid, Number(sData[0].shipping_cost_usd) || 0);
        }
      }

      // Now calculate PVP = cost × 3 + shipping
      for (const r of needsShipping) {
        const shipping = shippingMap.get(r.product_id) ?? 0;
        const cost = Number(r.cost_per_unit);
        const pvp = Math.round((cost * 3 + shipping) * 100) / 100;

        if (r.item_type === 'variant' && r.variant_id) {
          variantPvpMap.set(r.variant_id, pvp);
        } else if (r.item_type === 'product' && r.product_id) {
          productPvpMap.set(r.product_id, pvp);
        }
      }
    } else {
      // No country found — fallback to cost × 3 (without shipping)
      for (const r of needsShipping) {
        const pvp = Math.round(Number(r.cost_per_unit) * 3 * 100) / 100;
        if (r.item_type === 'variant' && r.variant_id) {
          variantPvpMap.set(r.variant_id, pvp);
        } else if (r.item_type === 'product' && r.product_id) {
          productPvpMap.set(r.product_id, pvp);
        }
      }
    }
  }

  return { variantPvpMap, productPvpMap };
}

function resolvePvp(
  item: BulkPriceItem,
  variantPvpMap: Map<string, number>,
  productPvpMap: Map<string, number>,
): number | null {
  return (item.sourceVariantId && variantPvpMap.get(item.sourceVariantId))
    || (item.sourceProductId && productPvpMap.get(item.sourceProductId))
    || null;
}

// --- Hook ---

export const useBulkPriceUpdate = (storeId: string | null) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const applyPercentageAdjustment = useCallback(async (
    items: BulkPriceItem[],
    percentage: number,
    mode: 'increase' | 'decrease'
  ) => {
    if (!storeId || items.length === 0) return false;
    setIsUpdating(true);
    try {
      const multiplier = mode === 'increase' ? 1 + percentage / 100 : 1 - percentage / 100;
      const updates = items.map(item => ({
        id: item.id,
        precio: Math.max(0, Math.round(item.precioActual * multiplier * 100) / 100),
        isManual: true, // manual adjustment
      }));
      await batchUpdate(updates);
      toast.success(`${updates.length} precios actualizados (${mode === 'increase' ? '+' : '-'}${percentage}%)`);
      return true;
    } catch (error: any) {
      console.error('Error in bulk percentage update:', error);
      toast.error(error.message || 'Error al actualizar precios');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [storeId]);

  const applyInlineEdits = useCallback(async (items: BulkPriceItem[]) => {
    if (!storeId || items.length === 0) return false;
    setIsUpdating(true);
    try {
      const changed = items.filter(i => i.precioNuevo !== i.precioActual && i.precioNuevo >= 0);
      if (changed.length === 0) {
        toast.info('No hay cambios para guardar');
        return true;
      }
      await batchUpdate(changed.map(u => ({
        id: u.id,
        precio: u.precioNuevo,
        isManual: true,
      })));
      toast.success(`${changed.length} precios actualizados`);
      return true;
    } catch (error: any) {
      console.error('Error in bulk inline update:', error);
      toast.error(error.message || 'Error al actualizar precios');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [storeId]);

  const applyFromCSV = useCallback(async (
    csvData: Array<{ sku: string; precio: number }>,
    allItems: BulkPriceItem[]
  ) => {
    if (!storeId || csvData.length === 0) return false;
    setIsUpdating(true);
    try {
      const skuMap = new Map(allItems.map(i => [i.sku.toLowerCase(), i]));
      const matched: Array<{ id: string; precio: number }> = [];
      const notFound: string[] = [];

      for (const row of csvData) {
        const item = skuMap.get(row.sku.toLowerCase());
        if (item) {
          matched.push({ id: item.id, precio: row.precio });
        } else {
          notFound.push(row.sku);
        }
      }

      if (matched.length === 0) {
        toast.error('Ningún SKU coincide con tu catálogo');
        return false;
      }

      await batchUpdate(matched.map(u => ({ ...u, isManual: true })));

      const msg = `${matched.length} precios actualizados`;
      if (notFound.length > 0) {
        toast.warning(`${msg}. ${notFound.length} SKUs no encontrados.`);
      } else {
        toast.success(msg);
      }
      return true;
    } catch (error: any) {
      console.error('Error in CSV bulk update:', error);
      toast.error(error.message || 'Error al actualizar precios');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [storeId]);

  const applyBusinessPanelPrices = useCallback(async (items: BulkPriceItem[]) => {
    if (!storeId || items.length === 0) return { success: false, preview: [] as any[] };
    setIsUpdating(true);
    try {
      // Only sync items that are NOT manually priced
      const syncableItems = items.filter(i => !i.isManualPrice);
      const sourceIds = [...new Set(syncableItems.map(i => i.sourceProductId).filter(Boolean))] as string[];
      if (sourceIds.length === 0) {
        toast.error('No se encontraron productos para sincronizar');
        return { success: false, preview: [] };
      }

      const { variantPvpMap, productPvpMap } = await fetchBpData(sourceIds, storeId);

      const updates: Array<{ id: string; precio: number; isManual: boolean }> = [];
      for (const item of syncableItems) {
        const pvp = resolvePvp(item, variantPvpMap, productPvpMap);
        if (pvp != null && pvp > 0) {
          updates.push({ id: item.id, precio: Number(pvp), isManual: false });
        }
      }

      if (updates.length === 0) {
        toast.error('No hay precios sugeridos disponibles para tus productos');
        return { success: false, preview: [] };
      }

      await batchUpdate(updates);
      toast.success(`${updates.length} precios actualizados al PVP sugerido del Business Panel`);
      return { success: true, preview: [] };
    } catch (error: any) {
      console.error('Error syncing business panel prices:', error);
      toast.error(error.message || 'Error al sincronizar precios');
      return { success: false, preview: [] };
    } finally {
      setIsUpdating(false);
    }
  }, [storeId]);

  const fetchBusinessPanelPreview = useCallback(async (items: BulkPriceItem[]) => {
    // Only preview items that are NOT manually priced
    const syncableItems = items.filter(i => !i.isManualPrice);
    const sourceIds = [...new Set(syncableItems.map(i => i.sourceProductId).filter(Boolean))] as string[];
    if (sourceIds.length === 0) return [];

    const { variantPvpMap, productPvpMap } = await fetchBpData(sourceIds, storeId);

    return syncableItems
      .map(i => {
        const pvp = resolvePvp(i, variantPvpMap, productPvpMap);
        if (!pvp || pvp <= 0) return null;
        return {
          id: i.id,
          sku: i.sku,
          nombre: i.nombre,
          precioActual: i.precioActual,
          pvpSugerido: Number(pvp),
        };
      })
      .filter(Boolean) as Array<{ id: string; sku: string; nombre: string; precioActual: number; pvpSugerido: number }>;
  }, [storeId]);

  return { isUpdating, applyPercentageAdjustment, applyInlineEdits, applyFromCSV, applyBusinessPanelPrices, fetchBusinessPanelPreview };
};
