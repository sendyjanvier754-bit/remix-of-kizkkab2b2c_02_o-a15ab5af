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
}

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
        precio_override: Math.max(0, Math.round(item.precioActual * multiplier * 100) / 100),
        updated_at: new Date().toISOString(),
      }));

      // Batch update in chunks of 50
      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        const promises = chunk.map(u =>
          supabase
            .from('seller_catalog_variants' as any)
            .update({ precio_override: u.precio_override, updated_at: u.updated_at })
            .eq('id', u.id)
        );
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error('Bulk update errors:', errors);
          throw new Error(`${errors.length} errores al actualizar`);
        }
      }

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

      for (let i = 0; i < changed.length; i += 50) {
        const chunk = changed.slice(i, i + 50);
        const promises = chunk.map(u =>
          supabase
            .from('seller_catalog_variants' as any)
            .update({ precio_override: u.precioNuevo, updated_at: new Date().toISOString() })
            .eq('id', u.id)
        );
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw new Error(`${errors.length} errores al actualizar`);
      }

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

      for (let i = 0; i < matched.length; i += 50) {
        const chunk = matched.slice(i, i + 50);
        const promises = chunk.map(u =>
          supabase
            .from('seller_catalog_variants' as any)
            .update({ precio_override: u.precio, updated_at: new Date().toISOString() })
            .eq('id', u.id)
        );
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw new Error(`${errors.length} errores al actualizar`);
      }

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

  return { isUpdating, applyPercentageAdjustment, applyInlineEdits, applyFromCSV, applyBusinessPanelPrices };
};

// New method: sync prices from v_business_panel_data
