import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SellerCatalogItem {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  precioCosto: number;
  stock: number;
  images: string[];
  isActive: boolean;
  importedAt: string;
  sourceProductId: string | null;
  margenAplicado: number;
  costBase: number;
}

export const useSellerCatalog = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SellerCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch catalog from dynamic pricing views
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('useSellerCatalog: Iniciando fetch desde v_productos_con_precio_b2b');

      const { data: products, error: productsError } = await supabase
        .from('v_productos_con_precio_b2b')
        .select(`
          id,
          sku_interno,
          nombre,
          descripcion_corta,
          precio_b2b,
          applied_margin_percent,
          costo_base_excel,
          imagen_principal,
          is_active
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error fetching from v_productos_con_precio_b2b:', productsError);
        throw productsError;
      }

      console.log('useSellerCatalog: Datos obtenidos:', products?.length, 'productos');

      const mappedItems: SellerCatalogItem[] = (products || []).map(product => {
        const images = product.imagen_principal ? [product.imagen_principal] : [];

        return {
          id: product.id,
          sku: product.sku_interno || '',
          nombre: product.nombre || '',
          descripcion: product.descripcion_corta,
          precioVenta: Number(product.precio_b2b) || 0,
          precioCosto: Number(product.costo_base_excel) || 0,
          stock: 0,
          images,
          isActive: product.is_active ?? true,
          importedAt: new Date().toISOString(),
          sourceProductId: product.id,
          margenAplicado: Number(product.applied_margin_percent) || 30,
          costBase: Number(product.costo_base_excel) || 0,
        };
      });

      console.log('useSellerCatalog: Items mapeados:', mappedItems.length);
      setItems(mappedItems);
    } catch (error) {
      console.error('Error fetching catalog:', error);
      toast.error('Error al cargar catálogo');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

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
        .from('products')
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

  const updateStock = useCallback(async (itemId: string, newStock: number) => {
    if (newStock < 0) {
      toast.error('El stock no puede ser negativo');
      return false;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_fisico: newStock })
        .eq('id', itemId);

      if (error) throw error;

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
  }, []);

  const getMargin = useCallback((item: SellerCatalogItem) => {
    if (item.precioCosto <= 0) return 0;
    return ((item.precioVenta - item.precioCosto) / item.precioCosto) * 100;
  }, []);

  const getStats = useCallback(() => {
    const total = items.length;
    const active = items.filter(i => i.isActive).length;
    const totalValue = items.reduce((sum, i) => sum + (i.precioVenta * (i.stock || 1)), 0);

    return { total, active, totalValue };
  }, [items]);

  const refetch = useCallback(async () => {
    await fetchCatalog();
  }, [fetchCatalog]);

  return {
    items,
    isLoading,
    updatePrecioVenta,
    toggleActive,
    updateStock,
    getMargin,
    getStats,
    refetch,
  };
};
