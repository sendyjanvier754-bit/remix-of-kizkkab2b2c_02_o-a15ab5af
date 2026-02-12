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
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  precioCosto: number; // Total: precio_b2b_base + costo_logistica
  precioB2B: number; // Precio B2B histórico (lo que pagó al admin)
  costoLogistica: number; // Costo logística histórico (lo que pagó en la orden)
  costoLogisticaCalculado?: number; // Costo logística actual desde v_product_shipping_costs
  weightKg: number; // Peso del producto original
  precioSugeridoVenta: number | null; // Precio sugerido por el admin
  stock: number;
  images: string[];
  isActive: boolean;
  importedAt: string;
  sourceProductId: string | null;
  sourceOrderId: string | null; // ID de la orden B2B original
  orderStatus: string | null; // Estado de la orden (completed, delivered, etc)
  margenPorcentaje: number; // Margen actual calculado
  gananciaPorUnidad: number; // Ganancia por unidad
}

export interface ProductoConVariantes {
  productId: string;
  nombreProducto: string;
  imagenPrincipal: string | null;
  marcaProducto: string | null;
  variantes: SellerCatalogItem[]; // Variantes del seller compradas/importadas
  variantes_disponibles?: Array<{
    id: string;
    nombre: string;
    sku: string;
    weight_kg: number | null;
  }>; // Variantes disponibles en catálogo admin
  totalStock: number;
  precioMinimo: number;
  precioMaximo: number;
  costoMinimo: number;
  precioLogisticaMinimo: number;
}

/**
 * Hook para catálogo/inventario del seller
 * @param showAll - true: muestra TODO el catálogo (incluyendo sin stock)
 *                  false: solo inventario (con stock > 0 de órdenes completadas)
 */
export const useSellerCatalog = (showAll: boolean = false) => {
  const { user } = useAuth();
  const [items, setItems] = useState<SellerCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  // Fetch store ID for the current user
  useEffect(() => {
    const fetchStoreId = async () => {
      if (!user?.id) {
        console.log('useSellerCatalog: No user ID');
        setStoreId(null);
        return;
      }
      
      try {
        const { data: store, error } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('useSellerCatalog: Error fetching store:', error);
          setStoreId(null);
          return;
        }

        if (store) {
          console.log('useSellerCatalog: Store found:', store.id);
          setStoreId(store.id);
        } else {
          console.log('useSellerCatalog: No store found for user');
          setStoreId(null);
        }
      } catch (err) {
        console.error('useSellerCatalog: Exception fetching store:', err);
        setStoreId(null);
      }
    };
    
    fetchStoreId();
  }, [user?.id]);

  // Fetch catalog from seller_catalog or v_seller_inventory
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('useSellerCatalog: Fetching', showAll ? 'full catalog' : 'inventory only');

      if (!storeId) {
        console.log('useSellerCatalog: No storeId yet, skipping fetch');
        setItems([]);
        return;
      }

      if (showAll) {
        // CATÁLOGO COMPLETO: seller_catalog (todos los productos, con y sin stock)
        const { data: catalogData, error: catalogError } = await supabase
          .from('seller_catalog')
          .select(`
            id,
            sku,
            nombre,
            descripcion,
            precio_venta,
            precio_costo,
            precio_b2b_base,
            costo_logistica,
            stock,
            images,
            is_active,
            imported_at,
            source_product_id,
            source_order_id,
            source_product:products(
              id,
              weight_kg,
              precio_sugerido_venta
            )
          `)
          .eq('seller_store_id', storeId)
          .order('created_at', { ascending: false });

        if (catalogError) {
          console.error('useSellerCatalog: Error fetching catalog:', catalogError);
          throw catalogError;
        }

        console.log('useSellerCatalog: Catalog data fetched:', catalogData?.length);

        // Get shipping costs for all source products
        const sourceProductIds = (catalogData || [])
          .map(item => item.source_product_id)
          .filter(Boolean);

        let shippingCosts: Record<string, number> = {};
        if (sourceProductIds.length > 0) {
          console.log('[SHIPPING] Fetching shipping costs for products:', sourceProductIds);
          
          const { data: shippingData, error: shippingError } = await supabase
            .from('v_product_shipping_costs')
            .select('product_id, total_cost')
            .in('product_id', sourceProductIds);

          if (shippingError) {
            console.error('[SHIPPING ERROR] Error fetching shipping costs:', shippingError);
          }

          if (shippingData) {
            console.log('[SHIPPING] Shipping data received:', shippingData);
            shippingCosts = Object.fromEntries(
              shippingData.map(item => [item.product_id, item.total_cost || 0])
            );
            console.log('[SHIPPING] Shipping costs mapped:', shippingCosts);
          } else {
            console.warn('[SHIPPING] No shipping data returned from view');
          }
        } else {
          console.warn('[SHIPPING] No source product IDs found in catalog');
        }

        // Map to SellerCatalogItem interface
        const mappedItems: SellerCatalogItem[] = (catalogData || []).map(item => {
          const precioB2B = Number(item.precio_b2b_base) || 0;
          const costoLogistica = Number(item.costo_logistica) || 0;
          const precioCosto = Number(item.precio_costo) || (precioB2B + costoLogistica);
          const precioVenta = Number(item.precio_venta) || 0;

          // Get weight and suggested price from source product
          const sourceProduct = (item as any).source_product;
          const weightKg = sourceProduct?.weight_kg ? Number(sourceProduct.weight_kg) : 0;
          const precioSugerido = sourceProduct?.precio_sugerido_venta 
            ? Number(sourceProduct.precio_sugerido_venta)
            : null;

          // Get calculated shipping cost from view
          const sourceProductId = item.source_product_id || sourceProduct?.id;
          const costoLogisticaCalculado = sourceProductId 
            ? (shippingCosts[sourceProductId] ?? costoLogistica)
            : costoLogistica;
          
          // Debug logging (remove in production)
          if (sourceProductId && shippingCosts[sourceProductId] !== undefined) {
            console.log(`[${item.nombre}] source_id=${sourceProductId}, historico=$${costoLogistica}, calculado=$${shippingCosts[sourceProductId]}`);
          } else if (sourceProductId) {
            console.warn(`[${item.nombre}] sin costo en vista (source_id=${sourceProductId})`);
          }

          // Parse images
          const images = Array.isArray(item.images) 
            ? item.images 
            : (typeof item.images === 'string' ? JSON.parse(item.images) : []);

          // Calculate metrics
          const gananciaPorUnidad = precioVenta - precioCosto;
          const margenPorcentaje = precioCosto > 0 
            ? ((gananciaPorUnidad / precioCosto) * 100) 
            : 0;

          return {
            id: item.id,
            sku: item.sku || '',
            nombre: item.nombre || '',
            descripcion: item.descripcion || null,
            precioVenta,
            precioCosto,
            precioB2B,
            costoLogistica,
            costoLogisticaCalculado,
            weightKg,
            precioSugeridoVenta: precioSugerido,
            stock: item.stock || 0,
            images: images.filter(Boolean),
            isActive: item.is_active ?? true,
            importedAt: item.imported_at || new Date().toISOString(),
            sourceProductId: item.source_product_id,
            sourceOrderId: item.source_order_id || null,
            orderStatus: null,
            margenPorcentaje: Number(margenPorcentaje.toFixed(1)),
            gananciaPorUnidad: Number(gananciaPorUnidad.toFixed(2)),
          };
        });

        console.log('useSellerCatalog: Items mapped:', mappedItems.length);
        setItems(mappedItems);
        
      } else {
        // INVENTARIO: v_seller_inventory (solo stock > 0 de órdenes completadas)
        const { data: catalogData, error: catalogError } = await supabase
          .from('v_seller_inventory')
        .select(`
          id,
          sku,
          nombre,
          descripcion,
          precio_venta,
          precio_costo,
          precio_b2b_base,
          costo_logistica,
          stock,
          images,
          is_active,
          imported_at,
          source_product_id,
          source_order_id,
          weight_kg,
          precio_sugerido_venta,
          order_status,
          payment_status,
          ganancia_por_unidad,
          margen_porcentaje
        `)
        .eq('seller_store_id', storeId)
        .order('created_at', { ascending: false });

      if (catalogError) {
        console.error('Error fetching seller_catalog:', catalogError);
        throw catalogError;
      }

      console.log('useSellerCatalog: Catalog data fetched:', catalogData?.length);

      // Map to SellerCatalogItem interface
      const mappedItems: SellerCatalogItem[] = (catalogData || []).map(item => {
        const precioB2B = Number(item.precio_b2b_base) || 0;
        const costoLogistica = Number(item.costo_logistica) || 0;
        const precioCosto = Number(item.precio_costo) || (precioB2B + costoLogistica);
        const precioVenta = Number(item.precio_venta) || 0;

        // Get weight and suggested price directly from view
        const weightKg = Number((item as any).weight_kg) || 0;
        const precioSugerido = (item as any).precio_sugerido_venta 
          ? Number((item as any).precio_sugerido_venta)
          : null;

        // Parse images
        const images = Array.isArray(item.images) 
          ? item.images 
          : (typeof item.images === 'string' ? JSON.parse(item.images) : []);

        // Get calculated metrics from view (or calculate as fallback)
        const gananciaPorUnidad = (item as any).ganancia_por_unidad 
          ? Number((item as any).ganancia_por_unidad)
          : (precioVenta - precioCosto);
        
        const margenPorcentaje = (item as any).margen_porcentaje
          ? Number((item as any).margen_porcentaje)
          : (precioCosto > 0 ? ((gananciaPorUnidad / precioCosto) * 100) : 0);

        return {
          id: item.id,
          sku: item.sku || '',
          nombre: item.nombre || '',
          descripcion: item.descripcion || null,
          precioVenta,
          precioCosto,
          precioB2B,
          costoLogistica,
          costoLogisticaCalculado: costoLogistica, // For inventory view, use historical value
          weightKg,
          precioSugeridoVenta: precioSugerido,
          stock: item.stock || 0,
          images: images.filter(Boolean),
          isActive: item.is_active ?? true,
          importedAt: item.imported_at || new Date().toISOString(),
          sourceProductId: item.source_product_id,
          sourceOrderId: item.source_order_id || null,
          orderStatus: (item as any).order_status || null,
          margenPorcentaje: Number(margenPorcentaje.toFixed(1)),
          gananciaPorUnidad: Number(gananciaPorUnidad.toFixed(2)),
        };
      });

        console.log('useSellerCatalog: Items mapped:', mappedItems.length);
        setItems(mappedItems);
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
      toast.error('Error al cargar catálogo');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, showAll]);

  useEffect(() => {
    if (storeId) {
      fetchCatalog();
    } else {
      // No store ID, so can't fetch catalog
      setItems([]);
      setIsLoading(false);
    }
  }, [fetchCatalog, storeId]);

  const updatePrecioVenta = useCallback(async (itemId: string, newPrice: number) => {
    if (newPrice < 0) {
      toast.error('El precio no puede ser negativo');
      return false;
    }

    try {
      toast.info('Los precios B2B se calculan automáticamente según rangos de margen configurados');
      return false;
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Error al actualizar precio');
      return false;
    }
  }, []);

  const toggleActive = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return false;

    try {
      const { error } = await supabase
        .from('seller_catalog')
        .update({ is_active: !item.isActive })
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev =>
        prev.map(i =>
          i.id === itemId ? { ...i, isActive: !i.isActive } : i
        )
      );

      toast.success(item.isActive ? 'Producto desactivado' : 'Producto activado');
      return true;
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al actualizar estado');
      return false;
    }
  }, [items]);

  const updateStock = useCallback(async (itemId: string, newStock: number, reason?: string) => {
    if (newStock < 0) {
      toast.error('El stock no puede ser negativo');
      return false;
    }

    try {
      const { error } = await supabase
        .from('seller_catalog')
        .update({ stock: newStock })
        .eq('id', itemId);

      if (error) throw error;

      // Optionally log inventory movement with reason
      if (reason) {
        const item = items.find(i => i.id === itemId);
        const previousStock = item?.stock || 0;
        await supabase.from('inventory_movements').insert({
          seller_catalog_id: itemId,
          change_amount: newStock - previousStock,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason,
          created_by: user?.id
        });
      }

      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, stock: newStock } : item
        )
      );

      toast.success('Stock actualizado');
      return true;
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Error al actualizar stock');
      return false;
    }
  }, [items, user?.id]);

  const getMargin = useCallback((item: SellerCatalogItem) => {
    if (item.precioCosto <= 0) return 0;
    return ((item.precioVenta - item.precioCosto) / item.precioCosto) * 100;
  }, []);

  // Agrupar items por producto padre y obtener variantes disponibles
  const groupByProduct = useCallback(async (): Promise<ProductoConVariantes[]> => {
    // Agrupar por sourceProductId
    const gruposMap = new Map<string, SellerCatalogItem[]>();
    
    items.forEach(item => {
      const productId = item.sourceProductId || item.id;
      if (!gruposMap.has(productId)) {
        gruposMap.set(productId, []);
      }
      gruposMap.get(productId)?.push(item);
    });

    // Convertir a array y obtener datos del producto padre
    const productosConVariantes: ProductoConVariantes[] = [];

    for (const [productId, variantes] of gruposMap) {
      // Obtener datos del producto padre e imagen
      const { data: productData } = await supabase
        .from('products')
        .select('id, nombre, imagen_principal, marca')
        .eq('id', productId)
        .maybeSingle();

      // Obtener variantes disponibles en el catálogo admin
      const { data: variantesDisponibles } = await supabase
        .from('product_variants')
        .select('id, nombre, sku, weight_kg')
        .eq('product_id', productId);

      const totalStock = variantes.reduce((sum, v) => sum + v.stock, 0);
      const preciosVenta = variantes.map(v => v.precioVenta);
      const preciosCosto = variantes.map(v => v.precioCosto);
      const preciosLogistica = variantes.map(v => v.costoLogisticaCalculado || v.costoLogistica);

      productosConVariantes.push({
        productId,
        nombreProducto: productData?.nombre || variantes[0].nombre,
        imagenPrincipal: productData?.imagen_principal || variantes[0].images[0] || null,
        marcaProducto: productData?.marca || null,
        variantes,
        variantes_disponibles: variantesDisponibles || [],
        totalStock,
        precioMinimo: Math.min(...preciosVenta),
        precioMaximo: Math.max(...preciosVenta),
        costoMinimo: Math.min(...preciosCosto),
        precioLogisticaMinimo: Math.min(...preciosLogistica),
      });
    }

    return productosConVariantes;
  }, [items]);

  const getStats = useCallback((): SellerCatalogStats => {
    const totalProducts = items.length;
    const activeProducts = items.filter(i => i.isActive).length;
    const totalStock = items.reduce((sum, i) => sum + (i.stock || 0), 0);
    const totalValue = items.reduce((sum, i) => sum + (i.precioVenta * (i.stock || 1)), 0);
    
    // Calculate average margin
    const margins = items
      .filter(i => i.precioCosto > 0)
      .map(i => ((i.precioVenta - i.precioCosto) / i.precioCosto) * 100);
    const avgMargin = margins.length > 0 
      ? margins.reduce((a, b) => a + b, 0) / margins.length 
      : 0;

    return { totalProducts, activeProducts, totalStock, totalValue, avgMargin };
  }, [items]);

  const refetch = useCallback(async () => {
    await fetchCatalog();
  }, [fetchCatalog]);

  return {
    items,
    isLoading,
    storeId,
    updatePrecioVenta,
    toggleActive,
    updateStock,
    getMargin,
    groupByProduct,
    getStats,
    refetch,
  };
};
