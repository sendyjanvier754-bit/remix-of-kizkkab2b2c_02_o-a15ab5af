import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Tipos del inventario B2C - Variante individual
export interface InventarioB2CVariante {
  order_item_id: string;
  variant_id: string;
  sku: string;
  color: string;
  size: string;
  stock: number;
  precio_original: number;
}

// Tipo del producto agrupado con sus variantes
export interface InventarioB2CItem {
  product_id: string;
  producto_nombre: string;
  descripcion_corta: string;
  imagen_principal: string;
  galeria_imagenes: string[];
  order_id: string;
  order_number: string;
  seller_store_id: string;
  tienda_vendedor: string;
  total_stock: number;
  precio_promedio: number;
  availability_status: 'available' | 'pending' | 'cancelled';
  payment_confirmed_at: string;
  fecha_pedido: string;
  ultima_actualizacion: string;
  variantes: InventarioB2CVariante[];
  categoria_id?: string | null; // Categoría del producto original
}

export interface InventarioB2CResumen {
  total_productos: number;
  total_variantes: number;
  total_unidades: number;
  por_estado: {
    available?: number;
    pending?: number;
    cancelled?: number;
  };
  valor_total: number;
}

export interface UseInventarioB2COptions {
  availability_status?: 'available' | 'pending' | 'cancelled';
  limit?: number;
  autoRefresh?: boolean;
}

/**
 * Hook para obtener el inventario B2C del vendedor actual
 * Lee directamente de orders_b2b (pedidos pagados como comprador)
 */
export const useInventarioB2C = (options: UseInventarioB2COptions = {}) => {
  const { user, isLoading: authLoading } = useAuth();
  const [inventario, setInventario] = useState<InventarioB2CItem[]>([]);
  const [resumen, setResumen] = useState<InventarioB2CResumen | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventario = useCallback(async () => {
    if (!user?.id) {
      setInventario([]);
      setResumen(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Llamar a la función get_inventario_b2c_agrupado
      const { data: inventarioData, error: inventarioError } = await supabase.rpc(
        'get_inventario_b2c_agrupado',
        {
          p_user_id: null, // null = usuario actual
          p_availability_status: options.availability_status || null,
          p_limit: options.limit || 100,
        }
      );

      if (inventarioError) {
        console.error('Error al cargar inventario B2C:', inventarioError);
        throw inventarioError;
      }

      // Llamar a la función get_inventario_b2c_resumen
      const { data: resumenData, error: resumenError } = await supabase.rpc(
        'get_inventario_b2c_resumen',
        { p_user_id: null }
      );

      if (resumenError) {
        console.error('Error al cargar resumen B2C:', resumenError);
        // No es crítico, continuar sin resumen
      }

      setInventario((inventarioData || []) as any);
      setResumen((resumenData || null) as any);
    } catch (err: any) {
      console.error('Error en useInventarioB2C:', err);
      setError(err.message || 'Error al cargar inventario');
      toast.error('Error al cargar inventario', {
        description: err.message || 'Intenta de nuevo más tarde',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, options.availability_status, options.limit]);

  // Cargar inventario al montar o cuando cambie el usuario/filtros
  useEffect(() => {
    if (!authLoading) {
      fetchInventario();
    }
  }, [authLoading, fetchInventario]);

  // Auto-refresh opcional cada 30 segundos
  useEffect(() => {
    if (options.autoRefresh && user?.id) {
      const interval = setInterval(fetchInventario, 30000);
      return () => clearInterval(interval);
    }
  }, [options.autoRefresh, user?.id, fetchInventario]);

  // Función para refrescar manualmente
  const refetch = useCallback(async () => {
    await fetchInventario();
  }, [fetchInventario]);

  // Función para obtener productos disponibles (para publicar)
  const getProductosDisponibles = useCallback(() => {
    return inventario.filter(item => item.availability_status === 'available');
  }, [inventario]);

  // Función para obtener productos pendientes (en tránsito)
  const getProductosPendientes = useCallback(() => {
    return inventario.filter(item => item.availability_status === 'pending');
  }, [inventario]);

  // Estadísticas calculadas
  const stats = {
    totalProductos: resumen?.total_productos || 0,
    totalUnidades: resumen?.total_unidades || 0,
    productosDisponibles: resumen?.por_estado?.available || 0,
    productosPendientes: resumen?.por_estado?.pending || 0,
    valorTotal: resumen?.valor_total || 0,
    // Compatibilidad con el componente anterior
    totalProducts: resumen?.total_productos || 0,
    totalStock: resumen?.total_unidades || 0,
    activeProducts: resumen?.por_estado?.available || 0,
  };

  return {
    inventario,
    resumen,
    stats,
    isLoading: isLoading || authLoading,
    error,
    refetch,
    getProductosDisponibles,
    getProductosPendientes,
  };
};

/**
 * Hook simplificado para obtener solo el resumen
 */
export const useInventarioB2CResumen = () => {
  const { user } = useAuth();
  const [resumen, setResumen] = useState<InventarioB2CResumen | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResumen = async () => {
      if (!user?.id) {
        setResumen(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc(
          'get_inventario_b2c_resumen',
          { p_user_id: null }
        );

        if (error) throw error;
        setResumen(data as any);
      } catch (err) {
        console.error('Error al cargar resumen:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResumen();
  }, [user?.id]);

  return { resumen, isLoading };
};
