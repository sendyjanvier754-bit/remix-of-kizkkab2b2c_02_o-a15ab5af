import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Department, Commune } from '@/hooks/useLogisticsEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommuneWithHub extends Commune {
  department_name: string;
  transit_hub_id: string | null;
  hub_name: string | null;
}

export interface LocalLogisticsCostResult {
  costo_local_usd: number;
  breakdown_json: {
    commune_id: string;
    commune_name: string;
    commune_code: string;
    department: string;
    peso_lb: number;
    rate_per_lb: number;
    costo_transporte: number;
    delivery_fee: number;
    operational_fee: number;
    costo_total_usd: number;
    formula: string;
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook para logística local en Haití.
 *
 * Provee:
 *  - Lista de departamentos activos
 *  - Lista de communes del departamento seleccionado (via DB function)
 *  - Costo local calculado para la commune + peso (via DB function)
 *
 * Uso en SellerCheckout:
 *  const {
 *    departments, communes,
 *    selectedDepartmentId, setSelectedDepartmentId,
 *    selectedCommuneId,   setSelectedCommuneId,
 *    localCost, costBreakdown,
 *    isLoadingCommunes, isCalculatingCost,
 *  } = useAvailableLocalRoutes(pesoFacturableLb);
 */
export const useAvailableLocalRoutes = (pesoFacturableLb?: number) => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);

  // ── 1. Departamentos activos ────────────────────────────────────────
  const {
    data: departments = [],
    isLoading: isLoadingDepartments,
  } = useQuery({
    queryKey: ['departments-local'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
    staleTime: 10 * 60 * 1000, // 10 min — datos casi estáticos
  });

  // ── 2. Communes del departamento seleccionado ──────────────────────
  const {
    data: communes = [],
    isLoading: isLoadingCommunes,
  } = useQuery({
    queryKey: ['communes-by-dept', selectedDepartmentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_communes_by_department', {
        p_department_id: selectedDepartmentId,
      });
      if (error) throw error;
      return (data ?? []) as CommuneWithHub[];
    },
    enabled: !!selectedDepartmentId,
    staleTime: 10 * 60 * 1000,
  });

  // ── 3. Costo local para la commune + peso ──────────────────────────
  const canCalculate =
    !!selectedCommuneId &&
    typeof pesoFacturableLb === 'number' &&
    pesoFacturableLb > 0;

  const {
    data: costData,
    isLoading: isCalculatingCost,
    error: costError,
  } = useQuery({
    queryKey: ['local-logistics-cost', selectedCommuneId, pesoFacturableLb],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_local_logistics_cost', {
        p_commune_id: selectedCommuneId,
        p_peso_facturable_lb: pesoFacturableLb,
      });
      if (error) throw error;
      const row = (data as LocalLogisticsCostResult[])?.[0];
      return row ?? null;
    },
    enabled: canCalculate,
    staleTime: 0, // el peso puede cambiar — siempre recalcular
  });

  // ── Helpers ────────────────────────────────────────────────────────
  const resetSelection = useCallback(() => {
    setSelectedDepartmentId(null);
    setSelectedCommuneId(null);
  }, []);

  const selectDepartment = useCallback((departmentId: string | null) => {
    setSelectedDepartmentId(departmentId);
    setSelectedCommuneId(null); // limpiar commune al cambiar departamento
  }, []);

  const selectedDepartment =
    departments.find((d) => d.id === selectedDepartmentId) ?? null;

  const selectedCommune =
    communes.find((c) => c.id === selectedCommuneId) ?? null;

  return {
    // Data
    departments,
    communes,
    selectedDepartment,
    selectedCommune,

    // Selection state
    selectedDepartmentId,
    selectedCommuneId,
    setSelectedDepartmentId: selectDepartment,
    setSelectedCommuneId,

    // Cost result
    localCost: costData?.costo_local_usd ?? null,
    costBreakdown: costData?.breakdown_json ?? null,

    // Loading states
    isLoadingDepartments,
    isLoadingCommunes,
    isCalculatingCost,

    // Error
    costError: costError ? String(costError) : null,

    // Utils
    resetSelection,
  };
};
