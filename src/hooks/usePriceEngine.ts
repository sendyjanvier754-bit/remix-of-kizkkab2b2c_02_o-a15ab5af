import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PriceSetting {
  id: string;
  key: string;
  value: number;
  description: string | null;
}

export interface DynamicExpense {
  id: string;
  nombre_gasto: string;
  valor: number;
  tipo: 'fijo' | 'porcentual';
  operacion: 'suma' | 'resta';
  is_active: boolean;
  sort_order: number;
}

export interface PriceCalculation {
  costoBase: number;
  gastosAplicados: { nombre: string; valor: number; resultado: number }[];
  subtotalConGastos: number;
  margenPorcentaje: number;
  margenValor: number;
  precioFinal: number;
}

export const usePriceEngine = () => {
  const queryClient = useQueryClient();

  // Fetch price settings
  const usePriceSettings = () => useQuery({
    queryKey: ['price-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_settings')
        .select('*');
      if (error) throw error;
      return data as PriceSetting[];
    },
  });

  // Fetch dynamic expenses
  const useDynamicExpenses = () => useQuery({
    queryKey: ['dynamic-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dynamic_expenses')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as DynamicExpense[];
    },
  });

  // Get profit margin
  const getProfitMargin = (settings: PriceSetting[] | undefined) => {
    const marginSetting = settings?.find(s => s.key === 'profit_margin');
    return marginSetting?.value ?? 30;
  };

  // Update price setting
  const updatePriceSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase
        .from('price_settings')
        .update({ value })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-settings'] });
      toast.success('Configuración actualizada');
    },
    onError: () => toast.error('Error al actualizar configuración'),
  });

  // Create dynamic expense
  const createExpense = useMutation({
    mutationFn: async (expense: Omit<DynamicExpense, 'id' | 'sort_order'>) => {
      const { error } = await supabase
        .from('dynamic_expenses')
        .insert(expense as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-expenses'] });
      toast.success('Gasto creado');
    },
    onError: () => toast.error('Error al crear gasto'),
  });

  // Update dynamic expense
  const updateExpense = useMutation({
    mutationFn: async ({ id, ...data }: Partial<DynamicExpense> & { id: string }) => {
      const { error } = await supabase
        .from('dynamic_expenses')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-expenses'] });
      toast.success('Gasto actualizado');
    },
    onError: () => toast.error('Error al actualizar gasto'),
  });

  // Delete dynamic expense
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dynamic_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-expenses'] });
      toast.success('Gasto eliminado');
    },
    onError: () => toast.error('Error al eliminar gasto'),
  });

  // Toggle expense active status
  const toggleExpenseActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('dynamic_expenses')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-expenses'] });
    },
    onError: () => toast.error('Error al cambiar estado'),
  });

  // Calculate B2B price from base cost
  const calculateB2BPrice = (
    costoBase: number,
    expenses: DynamicExpense[] | undefined,
    profitMargin: number
  ): PriceCalculation => {
    const activeExpenses = expenses?.filter(e => e.is_active) || [];
    let subtotal = costoBase;
    const gastosAplicados: PriceCalculation['gastosAplicados'] = [];

    // Apply each expense
    for (const expense of activeExpenses) {
      let valorAplicado: number;
      
      if (expense.tipo === 'fijo') {
        valorAplicado = expense.valor;
      } else {
        // Porcentual: calcular sobre el subtotal actual
        valorAplicado = (subtotal * expense.valor) / 100;
      }

      if (expense.operacion === 'suma') {
        subtotal += valorAplicado;
      } else {
        subtotal -= valorAplicado;
      }

      gastosAplicados.push({
        nombre: expense.nombre_gasto,
        valor: expense.valor,
        resultado: expense.operacion === 'suma' ? valorAplicado : -valorAplicado,
      });
    }

    // Apply profit margin
    const margenValor = (subtotal * profitMargin) / 100;
    const precioFinal = subtotal + margenValor;

    return {
      costoBase,
      gastosAplicados,
      subtotalConGastos: subtotal,
      margenPorcentaje: profitMargin,
      margenValor,
      precioFinal: Math.round(precioFinal * 100) / 100, // Round to 2 decimals
    };
  };

  return {
    usePriceSettings,
    useDynamicExpenses,
    getProfitMargin,
    updatePriceSetting,
    createExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseActive,
    calculateB2BPrice,
  };
};
