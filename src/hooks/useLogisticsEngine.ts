import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface Department {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Commune {
  id: string;
  department_id: string;
  code: string;
  name: string;
  rate_per_lb: number;
  extra_department_fee: number;
  delivery_fee: number;
  operational_fee: number;
  is_active: boolean;
}

export interface ShippingRate {
  id: string;
  key: string;
  value: number;
  description: string | null;
}

export interface CategoryShippingRate {
  id: string;
  category_id: string;
  fixed_fee: number;
  percentage_fee: number;
  description: string | null;
  is_active: boolean;
}

export interface ShipmentTracking {
  id: string;
  hybrid_tracking_id: string;
  china_tracking_number: string;
  order_id: string | null;
  order_type: string;
  department_id: string | null;
  commune_id: string | null;
  pickup_point_id: string | null;
  unit_count: number;
  customer_name: string | null;
  customer_phone: string | null;
  weight_grams: number | null;
  reference_price: number | null;
  shipping_cost_china_usa: number | null;
  shipping_cost_usa_haiti: number | null;
  category_fees: number | null;
  total_shipping_cost: number | null;
  status: string;
  label_printed_at: string | null;
  created_at: string;
}

export interface ShippingCalculation {
  weightGrams: number;
  weightKg: number;
  weightLb: number;
  chinaUsaCost: number;
  usaHaitiCost: number;
  categoryFixedFee: number;
  categoryPercentageFee: number;
  extraDepartmentFee: number;
  deliveryFee: number;
  operationalFee: number;
  totalShippingCost: number;
  insuranceCost: number;
  finalPrice: number;
}

// Constants for conversion
const GRAMS_TO_KG = 1000;
const GRAMS_TO_LB = 0.00220462;

export const useLogisticsEngine = () => {
  const queryClient = useQueryClient();

  // Fetch departments
  const useDepartments = () => useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
  });

  // Fetch departments that have at least 1 active commune
  const useDepartmentsWithCommunes = () => useQuery({
    queryKey: ['departments-with-communes'],
    queryFn: async () => {
      // Get all department_ids that have active communes
      const { data: communeData, error: communeError } = await supabase
        .from('communes')
        .select('department_id')
        .eq('is_active', true);
      if (communeError) throw communeError;

      const deptIds = [...new Set((communeData || []).map(c => c.department_id))];
      if (deptIds.length === 0) return [] as Department[];

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .in('id', deptIds)
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
  });

  // Fetch communes by department
  const useCommunes = (departmentId?: string) => useQuery({
    queryKey: ['communes', departmentId],
    queryFn: async () => {
      let query = supabase
        .from('communes')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Commune[];
    },
    enabled: !!departmentId || departmentId === undefined,
  });

  // Fetch all communes (for admin)
  const useAllCommunes = () => useQuery({
    queryKey: ['communes', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communes')
        .select('*, departments(code, name)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipping rates
  const useShippingRates = () => useQuery({
    queryKey: ['shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_rates')
        .select('*');
      if (error) throw error;
      return data as ShippingRate[];
    },
  });

  // Fetch category shipping rates
  const useCategoryShippingRates = () => useQuery({
    queryKey: ['category-shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_shipping_rates')
        .select('*, categories(name)')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipment tracking records
  const useShipmentTracking = () => useQuery({
    queryKey: ['shipment-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_tracking')
        .select('*, departments(code, name), communes(code, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get rate value by key
  const getRateValue = (rates: ShippingRate[] | undefined, key: string): number => {
    return rates?.find(r => r.key === key)?.value ?? 0;
  };

  // Calculate shipping cost
  const calculateShipping = (params: {
    weightGrams: number;
    referencePrice: number;
    categoryId?: string;
    communeId?: string;
    rates?: ShippingRate[];
    communes?: Commune[];
    categoryRates?: CategoryShippingRate[];
  }): ShippingCalculation => {
    const { weightGrams, referencePrice, categoryId, communeId, rates, communes, categoryRates } = params;

    // Weight conversions
    const weightKg = weightGrams / GRAMS_TO_KG;
    const weightLb = weightGrams * GRAMS_TO_LB;

    // China-USA rate (per KG)
    const chinaUsaRatePerKg = getRateValue(rates, 'china_usa_rate_per_kg');
    const chinaUsaCost = weightKg * chinaUsaRatePerKg;

    // USA-Haiti rate (per LB) - from commune
    const commune = communes?.find(c => c.id === communeId);
    const usaHaitiCost = commune ? weightLb * commune.rate_per_lb : 0;

    // Category fees
    const categoryRate = categoryRates?.find(cr => cr.category_id === categoryId);
    const categoryFixedFee = categoryRate?.fixed_fee ?? 0;
    const categoryPercentageFee = categoryRate ? (referencePrice * categoryRate.percentage_fee / 100) : 0;

    // Extra fees from commune
    const extraDepartmentFee = commune?.extra_department_fee ?? 0;
    const deliveryFee = commune?.delivery_fee ?? 0;
    const operationalFee = commune?.operational_fee ?? 0;

    // Insurance cost
    const insurancePercent = getRateValue(rates, 'default_insurance_percent');
    const insuranceCost = referencePrice * (insurancePercent / 100);

    // Total shipping cost
    const totalShippingCost = 
      chinaUsaCost + 
      usaHaitiCost + 
      categoryFixedFee + 
      categoryPercentageFee + 
      extraDepartmentFee + 
      deliveryFee + 
      operationalFee +
      insuranceCost;

    // Final price = Reference Price + Total Shipping
    const finalPrice = referencePrice + totalShippingCost;

    return {
      weightGrams,
      weightKg,
      weightLb,
      chinaUsaCost,
      usaHaitiCost,
      categoryFixedFee,
      categoryPercentageFee,
      extraDepartmentFee,
      deliveryFee,
      operationalFee,
      totalShippingCost,
      insuranceCost,
      finalPrice,
    };
  };

  // Generate hybrid tracking ID
  const generateHybridTrackingId = (
    deptCode: string,
    communeCode: string,
    pointCode: string | null,
    unitCount: number,
    chinaTracking: string
  ): string => {
    const pointPart = pointCode || 'XX';
    const unitPart = unitCount.toString().padStart(2, '0');
    return `${deptCode.toUpperCase()}-${communeCode.toUpperCase()}-${pointPart.toUpperCase()}-${unitPart}-${chinaTracking}`;
  };

  // Mutations
  const updateShippingRate = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase
        .from('shipping_rates')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates'] });
      toast.success('Tarifa actualizada');
    },
    onError: () => toast.error('Error al actualizar tarifa'),
  });

  const createDepartment = useMutation({
    mutationFn: async (dept: Omit<Department, 'id'>) => {
      const { error } = await supabase.from('departments').insert(dept);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Departamento creado');
    },
    onError: () => toast.error('Error al crear departamento'),
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Department> & { id: string }) => {
      const { error } = await supabase
        .from('departments')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Departamento actualizado');
    },
    onError: () => toast.error('Error al actualizar departamento'),
  });

  const createCommune = useMutation({
    mutationFn: async (commune: Omit<Commune, 'id'>) => {
      const { error } = await supabase.from('communes').insert(commune);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communes'] });
      toast.success('Comuna creada');
    },
    onError: () => toast.error('Error al crear comuna'),
  });

  const updateCommune = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Commune> & { id: string }) => {
      const { error } = await supabase
        .from('communes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communes'] });
      toast.success('Comuna actualizada');
    },
    onError: () => toast.error('Error al actualizar comuna'),
  });

  const createCategoryShippingRate = useMutation({
    mutationFn: async (rate: Omit<CategoryShippingRate, 'id'>) => {
      const { error } = await supabase.from('category_shipping_rates').insert(rate);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-shipping-rates'] });
      toast.success('Tarifa de categoría creada');
    },
    onError: () => toast.error('Error al crear tarifa de categoría'),
  });

  const updateCategoryShippingRate = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CategoryShippingRate> & { id: string }) => {
      const { error } = await supabase
        .from('category_shipping_rates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-shipping-rates'] });
      toast.success('Tarifa de categoría actualizada');
    },
    onError: () => toast.error('Error al actualizar tarifa de categoría'),
  });

  const createShipmentTracking = useMutation({
    mutationFn: async (tracking: Omit<ShipmentTracking, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('shipment_tracking')
        .insert(tracking)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-tracking'] });
      toast.success('Seguimiento creado');
    },
    onError: () => toast.error('Error al crear seguimiento'),
  });

  const updateShipmentStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('shipment_tracking')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-tracking'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  const markLabelPrinted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipment_tracking')
        .update({ label_printed_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-tracking'] });
    },
  });

  return {
    // Queries
    useDepartments,
    useDepartmentsWithCommunes,
    useCommunes,
    useAllCommunes,
    useShippingRates,
    useCategoryShippingRates,
    useShipmentTracking,
    // Utilities
    getRateValue,
    calculateShipping,
    generateHybridTrackingId,
    // Mutations
    updateShippingRate,
    createDepartment,
    updateDepartment,
    createCommune,
    updateCommune,
    createCategoryShippingRate,
    updateCategoryShippingRate,
    createShipmentTracking,
    updateShipmentStatus,
    markLabelPrinted,
  };
};
