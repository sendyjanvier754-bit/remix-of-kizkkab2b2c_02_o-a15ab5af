import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SellerCatalogStats {
  totalProducts: number;
  activeProducts: number;
  totalStock: number;
  totalValue: number;
  avgMargin: number;
}

export interface SellerCatalogItem {
  id: string; // seller_catalog_variants.id
  catalogId: string; // seller_catalog.id (parent)
  sku: string;
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  precioCosto: number;
  precioB2B: number;
  costoLogistica: number;
  costoLogisticaCalculado?: number;
  shippingCostsByTier?: Record<string, number>;
  weightKg: number;
  precioSugeridoVenta: number | null;
  stock: number;
  images: string[];
  isActive: boolean;
  importedAt: string;
  sourceProductId: string | null;
  sourceOrderId: string | null;
  orderStatus: string | null;
  margenPorcentaje: number;
  gananciaPorUnidad: number;
  availabilityStatus: string;
  variantAttributes?: Record<string, any>;
}

export interface ProductoConVariantes {
  productId: string;
  catalogId: string; // seller_catalog.id
  nombreProducto: string;
  imagenPrincipal: string | null;
  marcaProducto: string | null;
  variantes: SellerCatalogItem[];
  variantes_disponibles?: Array<{
    id: string;
    nombre: string;
    sku: string;
    weight_kg: number | null;
  }>;
  totalStock: number;
  precioMinimo: number;
  precioMaximo: number;
  costoMinimo: number;
  precioLogisticaMinimo: number;
  shippingCostsByTierMin?: Record<string, number>;
  isActive: boolean;
}

export type SellerCatalogSourceType = 'imported' | 'inventory' | 'all';

/**
 * Hook para catálogo/inventario del seller
 * Uses seller_catalog + seller_catalog_variants (1 product : N variants)
 * @param showAll - true: all catalog; false: only with stock > 0
 * @param sourceType - 'imported': productos importados (source_order_id IS NULL), 'inventory': productos de inventario B2B (source_order_id IS NOT NULL), 'all': todos
 */
export const useSellerCatalog = (showAll: boolean = false, sourceType: SellerCatalogSourceType = 'all') => {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoConVariantes[]>([]);
  const [items, setItems] = useState<SellerCatalogItem[]>([]); // flat list for backward compat
  const [isLoading, setIsLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [destinationCountryId, setDestinationCountryId] = useState<string | null>(null);
  const isShippingConfigured = destinationCountryId !== null;

  // Fetch store ID for the current user
  useEffect(() => {
    const fetchStoreId = async () => {
      if (!user?.id) { setStoreId(null); return; }
      try {
        const { data: store, error } = await supabase
          .from('stores')
          .select('id, slug')
          .eq('owner_user_id', user.id)
          .maybeSingle();
        if (error) { console.error('useSellerCatalog: Error fetching store:', error); setStoreId(null); setStoreSlug(null); return; }
        if (store) { setStoreId(store.id); setStoreSlug(store.slug); }
        else { setStoreId(null); setStoreSlug(null); }
      } catch (err) { console.error('useSellerCatalog: Exception:', err); setStoreId(null); }
    };
    fetchStoreId();
  }, [user?.id]);

  // Fetch destination country
  useEffect(() => {
    const fetchDestinationCountry = async () => {
      if (!storeId) return;
      const { data: storeData } = await supabase
        .from('stores')
        .select('market_id, destination_country_id')
        .eq('id', storeId)
        .maybeSingle();

      const directCountryId = (storeData as any)?.destination_country_id;
      if (directCountryId) { setDestinationCountryId(directCountryId); return; }

      const marketId = (storeData as any)?.market_id;
      if (!marketId) return;
      const { data: market } = await supabase
        .from('markets')
        .select('destination_country_id')
        .eq('id', marketId)
        .maybeSingle();
      if (market?.destination_country_id) setDestinationCountryId(market.destination_country_id);
    };
    fetchDestinationCountry();
  }, [storeId]);

  // Main fetch: use v_seller_catalog_with_variants view
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!storeId) { setProductos([]); setItems([]); return; }

      // Query the aggregated view with source type filter
      let query = supabase
        .from('v_seller_catalog_with_variants' as any)
        .select('*')
        .eq('seller_store_id', storeId);

      // Apply source type filter
      if (sourceType === 'imported') {
        query = query.is('source_order_id', null);
      } else if (sourceType === 'inventory') {
        query = query.not('source_order_id', 'is', null);
      }
      // 'all' = no filter

      const { data: viewData, error } = await query;

      if (error) { console.error('useSellerCatalog: Error:', error); throw error; }

      const rawRows = (viewData || []) as any[];

      // Filter: if !showAll, only products with stock > 0
      const filtered = showAll ? rawRows : rawRows.filter(r => (r.total_stock || 0) > 0);

      // Fetch shipping costs for all source products
      const sourceProductIds = filtered.map((r: any) => r.source_product_id).filter(Boolean);
      let shippingCostsByTierAll: Record<string, Record<string, number>> = {};
      let shippingCosts: Record<string, number> = {};

      if (sourceProductIds.length > 0 && destinationCountryId) {
        const { data: routeIds } = await supabase
          .from('shipping_routes')
          .select('id')
          .eq('destination_country_id', destinationCountryId)
          .eq('is_active', true);
        const routeIdList = (routeIds ?? []).map((r: any) => r.id as string);

        let distinctTierTypes: string[] = ['standard'];
        if (routeIdList.length > 0) {
          const { data: tierTypesData } = await supabase
            .from('shipping_tiers')
            .select('tier_type')
            .in('route_id', routeIdList)
            .eq('is_active', true);
          const unique = [...new Set((tierTypesData ?? []).map((t: any) => t.tier_type).filter(Boolean))];
          if (unique.length > 0) distinctTierTypes = unique;
        }

        await Promise.all(
          distinctTierTypes.map(async (tierType) => {
            const results = await Promise.all(
              sourceProductIds.map((productId: string) =>
                supabase.rpc('get_product_shipping_cost_by_country', {
                  p_product_id: productId,
                  p_destination_country_id: destinationCountryId,
                  p_tier_type: tierType,
                }).then(({ data, error }) => ({ productId, data, error }))
              )
            );
            shippingCostsByTierAll[tierType] = {};
            for (const { productId, data, error } of results) {
              if (!error && data && data[0]?.is_available) {
                const cost = Number(data[0].shipping_cost_usd) || 0;
                shippingCostsByTierAll[tierType][productId] = cost;
                if (tierType === 'standard' || shippingCosts[productId] === undefined) {
                  shippingCosts[productId] = cost;
                }
              }
            }
          })
        );
      }

      // Also fetch available admin variants for each product (batch)
      let adminVariantsMap: Record<string, Array<{ id: string; nombre: string; sku: string; weight_kg: number | null }>> = {};
      if (sourceProductIds.length > 0) {
        const { data: allAdminVariants } = await (supabase as any)
          .from('product_variants')
          .select('id, product_id, nombre, sku, weight_kg')
          .in('product_id', sourceProductIds);
        for (const v of (allAdminVariants || [])) {
          const pid = (v as any).product_id;
          if (!adminVariantsMap[pid]) adminVariantsMap[pid] = [];
          adminVariantsMap[pid].push({ id: (v as any).id, nombre: (v as any).nombre, sku: (v as any).sku, weight_kg: (v as any).weight_kg });
        }
      }

      // Map to ProductoConVariantes
      const allItems: SellerCatalogItem[] = [];
      const mappedProductos: ProductoConVariantes[] = filtered.map((row: any) => {
        const variantes: SellerCatalogItem[] = [];
        const rawVariantes = row.variantes || [];

        for (const v of rawVariantes) {
          const precio = Number(v.precio) || 0;

          // Use the real purchase price stored in seller_catalog when available
          // (written by the trigger when the B2B order was paid: precio_b2b_base + costo_logistica)
          // For imported products (no source_order_id) fall back to the live calculation.
          const hasPrecioCostoReal = row.source_order_id && Number(row.precio_costo) > 0;
          const costoLogistica = hasPrecioCostoReal
            ? Number(row.costo_logistica) || 0
            : shippingCosts[row.source_product_id] || 0;
          const precioCosto = hasPrecioCostoReal
            ? Number(row.precio_costo)
            : precio + (shippingCosts[row.source_product_id] || 0);
          // Build per-tier cost map
          const tierCosts: Record<string, number> = {};
          if (row.source_product_id) {
            for (const [tierType, costsMap] of Object.entries(shippingCostsByTierAll)) {
              const c = (costsMap as Record<string, number>)[row.source_product_id];
              if (c !== undefined && c > 0) tierCosts[tierType] = c;
            }
          }

          const item: SellerCatalogItem = {
            id: v.variant_id, // seller_catalog_variants.id
            catalogId: row.catalog_id,
            sku: v.sku || '',
            nombre: v.attributes ? Object.values(v.attributes).join(' / ') : v.sku || '',
            descripcion: row.descripcion || null,
            precioVenta: precio, // Will be overridden by pricing engine
            precioCosto,
            precioB2B: precio,
            costoLogistica,
            costoLogisticaCalculado: costoLogistica,
            shippingCostsByTier: Object.keys(tierCosts).length > 0 ? tierCosts : undefined,
            weightKg: 0,
            precioSugeridoVenta: null,
            stock: v.stock || 0,
            images: v.images || row.images || [],
            isActive: v.is_available ?? true,
            importedAt: row.catalog_created_at || new Date().toISOString(),
            sourceProductId: row.source_product_id,
            sourceOrderId: row.source_order_id || null,
            orderStatus: null,
            margenPorcentaje: 0,
            gananciaPorUnidad: 0,
            availabilityStatus: v.availability_status || 'available',
            variantAttributes: v.attributes || {},
          };
          variantes.push(item);
          allItems.push(item);
        }

        const totalStock = variantes.reduce((s, v) => s + v.stock, 0);
        const prices = variantes.map(v => v.precioVenta).filter(p => p > 0);
        const costs = variantes.map(v => v.precioCosto).filter(c => c > 0);
        const logisticCosts = variantes.map(v => v.costoLogisticaCalculado || 0);

        const shippingCostsByTierMin: Record<string, number> = {};
        for (const v of variantes) {
          if (v.shippingCostsByTier) {
            for (const [t, c] of Object.entries(v.shippingCostsByTier)) {
              if (shippingCostsByTierMin[t] === undefined || c < shippingCostsByTierMin[t]) shippingCostsByTierMin[t] = c;
            }
          }
        }

        // Get admin variants not yet in seller catalog
        const sellerVariantIds = new Set(rawVariantes.map((v: any) => v.product_variant_id));
        const availableAdminVariants = (adminVariantsMap[row.source_product_id] || [])
          .filter(av => !sellerVariantIds.has(av.id));

        return {
          productId: row.source_product_id || row.catalog_id,
          catalogId: row.catalog_id,
          nombreProducto: row.product_name || row.nombre,
          imagenPrincipal: row.product_image || (Array.isArray(row.images) ? row.images[0] : null),
          marcaProducto: null,
          variantes,
          variantes_disponibles: availableAdminVariants,
          totalStock,
          precioMinimo: prices.length > 0 ? Math.min(...prices) : 0,
          precioMaximo: prices.length > 0 ? Math.max(...prices) : 0,
          costoMinimo: costs.length > 0 ? Math.min(...costs) : 0,
          precioLogisticaMinimo: logisticCosts.length > 0 ? Math.min(...logisticCosts) : 0,
          shippingCostsByTierMin: Object.keys(shippingCostsByTierMin).length > 0 ? shippingCostsByTierMin : undefined,
          isActive: row.is_active ?? true,
        };
      });

      setProductos(mappedProductos);
      setItems(allItems);
    } catch (error) {
      console.error('Error fetching catalog:', error);
      toast.error('Error al cargar catálogo');
      setProductos([]);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, showAll, destinationCountryId, sourceType]);

  useEffect(() => {
    if (storeId) fetchCatalog();
    else { setItems([]); setProductos([]); setIsLoading(false); }
  }, [fetchCatalog, storeId, destinationCountryId, sourceType]);

  const updateStock = useCallback(async (variantId: string, newStock: number, reason?: string) => {
    if (newStock < 0) { toast.error('El stock no puede ser negativo'); return false; }
    try {
      // Update on seller_catalog_variants
      const { error } = await supabase
        .from('seller_catalog_variants' as any)
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('variant_id', variantId);
      if (error) throw error;

      if (reason) {
        const item = items.find(i => i.id === variantId);
        const previousStock = item?.stock || 0;
        await supabase.from('inventory_movements').insert({
          seller_catalog_id: item?.catalogId,
          change_amount: newStock - previousStock,
          previous_stock: previousStock,
          new_stock: newStock,
          reason,
          created_by: user?.id
        });
      }

      // Optimistic update
      setItems(prev => prev.map(i => i.id === variantId ? { ...i, stock: newStock } : i));
      setProductos(prev => prev.map(p => ({
        ...p,
        variantes: p.variantes.map(v => v.id === variantId ? { ...v, stock: newStock } : v),
        totalStock: p.variantes.reduce((s, v) => s + (v.id === variantId ? newStock : v.stock), 0),
      })));

      toast.success('Stock actualizado');
      return true;
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Error al actualizar stock');
      return false;
    }
  }, [items, user?.id]);

  const toggleActive = useCallback(async (catalogId: string) => {
    const prod = productos.find(p => p.catalogId === catalogId);
    if (!prod) return false;
    try {
      const { error } = await supabase
        .from('seller_catalog')
        .update({ is_active: !prod.isActive })
        .eq('id', catalogId);
      if (error) throw error;
      setProductos(prev => prev.map(p => p.catalogId === catalogId ? { ...p, isActive: !p.isActive } : p));
      toast.success(prod.isActive ? 'Producto desactivado' : 'Producto activado');
      return true;
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al actualizar estado');
      return false;
    }
  }, [productos]);

  const updatePrecioVenta = useCallback(async (itemId: string, newPrice: number) => {
    if (newPrice < 0) { toast.error('El precio no puede ser negativo'); return false; }
    try {
      // Save per-variant price override — if NULL later, falls back to catalog default
      const { error: variantError } = await supabase
        .from('seller_catalog_variants' as any)
        .update({ precio_override: newPrice, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (variantError) throw variantError;

      // Optimistic update
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, precioVenta: newPrice } : i));
      setProductos(prev => prev.map(p => {
        const updatedVariantes = p.variantes.map(v => v.id === itemId ? { ...v, precioVenta: newPrice } : v);
        const prices = updatedVariantes.map(v => v.precioVenta).filter(p => p > 0);
        return {
          ...p,
          variantes: updatedVariantes,
          precioMinimo: prices.length > 0 ? Math.min(...prices) : p.precioMinimo,
          precioMaximo: prices.length > 0 ? Math.max(...prices) : p.precioMaximo,
        };
      }));

      toast.success('Precio actualizado');
      return true;
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Error al actualizar precio');
      return false;
    }
  }, [items]);

  const getMargin = useCallback((item: SellerCatalogItem) => {
    if (item.precioCosto <= 0) return 0;
    return ((item.precioVenta - item.precioCosto) / item.precioCosto) * 100;
  }, []);

  // groupByProduct now just returns the already-grouped data (no N+1 queries!)
  const groupByProduct = useCallback(async (): Promise<ProductoConVariantes[]> => {
    return productos;
  }, [productos]);

  const getStats = useCallback((): SellerCatalogStats => {
    const totalProducts = productos.length;
    const activeProducts = productos.filter(p => p.isActive).length;
    const totalStock = productos.reduce((sum, p) => sum + p.totalStock, 0);
    const totalValue = items.reduce((sum, i) => sum + (i.precioVenta * (i.stock || 1)), 0);
    const margins = items.filter(i => i.precioCosto > 0).map(i => ((i.precioVenta - i.precioCosto) / i.precioCosto) * 100);
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    return { totalProducts, activeProducts, totalStock, totalValue, avgMargin };
  }, [productos, items]);

  const refetch = useCallback(async () => { await fetchCatalog(); }, [fetchCatalog]);

  const deleteItems = useCallback(async (catalogIds: string[]) => {
    if (!storeId || catalogIds.length === 0) return { success: false, error: 'No items to delete' };
    try {
      const { error } = await supabase
        .from('seller_catalog')
        .delete()
        .in('id', catalogIds)
        .eq('seller_store_id', storeId);
      if (error) throw error;
      await fetchCatalog();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting items:', error);
      return { success: false, error: error.message };
    }
  }, [storeId, fetchCatalog]);

  return {
    items,
    productos,
    isLoading,
    storeId,
    storeSlug,
    isShippingConfigured,
    destinationCountryId,
    updatePrecioVenta,
    toggleActive,
    updateStock,
    getMargin,
    groupByProduct,
    getStats,
    refetch,
    deleteItems,
  };
};
