import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface B2BMarginRange {
  id: string;
  min_cost: number;
  max_cost: number | null;
  margin_percent: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface B2BPriceCalculationInput {
  baseCost: number; // Costo de fábrica
  logisticsCost: number; // Costo de envío (se suma DESPUÉS del margen)
  categoryFees?: number; // Tarifas de categoría
  additionalExpenses?: number; // Otros gastos
}

export interface B2BPriceResult {
  baseCost: number;
  marginRange: B2BMarginRange | null;
  marginPercent: number;
  marginValue: number;
  subtotalWithMargin: number; // Base + Margen (ANTES de logística)
  logisticsCost: number;
  categoryFees: number;
  additionalExpenses: number;
  finalB2BPrice: number; // Precio final incluyendo todo
}

export const useB2BMarginRanges = () => {
  const queryClient = useQueryClient();

  // Obtener todos los rangos de márgenes
  const useMarginRanges = () => useQuery({
    queryKey: ['b2b-margin-ranges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('b2b_margin_ranges')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as B2BMarginRange[];
    },
  });

  // Obtener solo rangos activos
  const useActiveMarginRanges = () => useQuery({
    queryKey: ['b2b-margin-ranges', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('b2b_margin_ranges')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as B2BMarginRange[];
    },
  });

  // Crear rango de margen
  const createMarginRange = useMutation({
    mutationFn: async (range: Omit<B2BMarginRange, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('b2b_margin_ranges')
        .insert(range)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-margin-ranges'] });
      toast.success('Rango de margen creado');
    },
    onError: (err: any) => {
      toast.error('Error al crear rango: ' + err.message);
    },
  });

  // Actualizar rango de margen
  const updateMarginRange = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<B2BMarginRange> & { id: string }) => {
      const { data, error } = await supabase
        .from('b2b_margin_ranges')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-margin-ranges'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['b2b-products'] });
      queryClient.invalidateQueries({ queryKey: ['business-panel'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      toast.success('Rango de margen actualizado');
    },
    onError: (err: any) => {
      toast.error('Error al actualizar rango: ' + err.message);
    },
  });

  // Eliminar rango de margen
  const deleteMarginRange = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('b2b_margin_ranges')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-margin-ranges'] });
      toast.success('Rango de margen eliminado');
    },
    onError: (err: any) => {
      toast.error('Error al eliminar rango: ' + err.message);
    },
  });

  // Toggle estado activo
  const toggleMarginRangeActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('b2b_margin_ranges')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-margin-ranges'] });
    },
    onError: (err: any) => {
      toast.error('Error al cambiar estado: ' + err.message);
    },
  });

  /**
   * Encuentra el rango de margen aplicable para un costo base dado.
   * IMPORTANTE: El costo base es el costo de fábrica ANTES de aplicar logística.
   */
  const findMarginRangeForCost = (
    baseCost: number, 
    ranges: B2BMarginRange[]
  ): B2BMarginRange | null => {
    if (!ranges || ranges.length === 0) return null;
    
    // Buscar el rango que aplica para el costo base
    return ranges.find(range => {
      const minOk = baseCost >= range.min_cost;
      const maxOk = range.max_cost === null || baseCost < range.max_cost;
      return minOk && maxOk && range.is_active;
    }) || null;
  };

  /**
   * Calcula el precio B2B aplicando la regla de protección:
   * 1. Aplicar margen sobre el costo base (fábrica)
   * 2. DESPUÉS sumar el costo de logística
   * 
   * Esto garantiza que la logística no reduce el margen de beneficio.
   */
  const calculateB2BPriceWithRanges = (
    input: B2BPriceCalculationInput,
    ranges: B2BMarginRange[]
  ): B2BPriceResult => {
    const { 
      baseCost, 
      logisticsCost, 
      categoryFees = 0, 
      additionalExpenses = 0 
    } = input;

    // Encontrar el rango de margen aplicable basado en el costo base
    const marginRange = findMarginRangeForCost(baseCost, ranges);
    const marginPercent = marginRange?.margin_percent ?? 30; // Default 30%

    // REGLA DE PROTECCIÓN:
    // 1. Primero aplicamos el margen sobre el costo base (antes de logística)
    const marginValue = (baseCost * marginPercent) / 100;
    const subtotalWithMargin = baseCost + marginValue;

    // 2. Luego sumamos los costos de logística y otros gastos
    const finalB2BPrice = subtotalWithMargin + logisticsCost + categoryFees + additionalExpenses;

    return {
      baseCost,
      marginRange,
      marginPercent,
      marginValue: Math.round(marginValue * 100) / 100,
      subtotalWithMargin: Math.round(subtotalWithMargin * 100) / 100,
      logisticsCost,
      categoryFees,
      additionalExpenses,
      finalB2BPrice: Math.round(finalB2BPrice * 100) / 100,
    };
  };

  return {
    useMarginRanges,
    useActiveMarginRanges,
    createMarginRange,
    updateMarginRange,
    deleteMarginRange,
    toggleMarginRangeActive,
    findMarginRangeForCost,
    calculateB2BPriceWithRanges,
  };
};
