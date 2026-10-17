import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SellerCredit {
  id: string;
  user_id: string;
  credit_limit: number;
  balance_debt: number;
  max_cart_percentage: number;
  is_active: boolean;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditMovement {
  id: string;
  user_id: string;
  movement_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface MovementFilters {
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

export const useSellerCredits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credit, isLoading } = useQuery({
    queryKey: ['seller-credit', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('seller_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SellerCredit | null;
    },
    enabled: !!user?.id,
  });

  const availableCredit = credit ? credit.credit_limit - credit.balance_debt : 0;
  const hasActiveCredit = credit?.is_active ?? false;

  const calculateMaxCreditForCart = (cartTotal: number) => {
    if (!credit?.is_active) return 0;
    const maxByPercentage = (cartTotal * credit.max_cart_percentage) / 100;
    return Math.min(maxByPercentage, availableCredit);
  };

  return {
    credit,
    isLoading,
    availableCredit,
    hasActiveCredit,
    calculateMaxCreditForCart,
  };
};

// Hook for paginated movements with filters
export const useCreditMovements = (filters: MovementFilters = {}, pageSize = 10) => {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [allMovements, setAllMovements] = useState<CreditMovement[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['credit-movements', user?.id, filters, page],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('credit_movements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      // Apply filters
      if (filters.type && filters.type !== 'all') {
        query = query.eq('movement_type', filters.type);
      }
      
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CreditMovement[];
    },
    enabled: !!user?.id,
  });

  // Update allMovements when data changes
  useEffect(() => {
    if (data) {
      if (page === 0) {
        setAllMovements(data);
      } else {
        setAllMovements(prev => [...prev, ...data]);
      }
      setHasMore(data.length === pageSize);
    }
  }, [data, page, pageSize]);

  // Reset when filters change
  useEffect(() => {
    setPage(0);
    setAllMovements([]);
    setHasMore(true);
  }, [filters.type, filters.startDate?.getTime(), filters.endDate?.getTime()]);

  const loadMore = () => {
    if (hasMore && !isFetching) {
      setPage(p => p + 1);
    }
  };

  return {
    movements: allMovements,
    isLoading: isLoading && page === 0,
    isFetchingMore: isFetching && page > 0,
    hasMore,
    loadMore,
  };
};

// Admin hook for managing credits
export const useAdminCredits = () => {
  const queryClient = useQueryClient();

  const { data: allCredits, isLoading } = useQuery({
    queryKey: ['admin-credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_credits')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: totalDebt } = useQuery({
    queryKey: ['admin-total-debt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_credits')
        .select('balance_debt');
      
      if (error) throw error;
      return data.reduce((sum, c) => sum + Number(c.balance_debt), 0);
    },
  });

  const activateCredit = useMutation({
    mutationFn: async ({ 
      userId, 
      creditLimit, 
      maxCartPercentage 
    }: { 
      userId: string; 
      creditLimit: number; 
      maxCartPercentage: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('seller_credits')
        .upsert({
          user_id: userId,
          credit_limit: creditLimit,
          max_cart_percentage: maxCartPercentage,
          is_active: true,
          activated_at: new Date().toISOString(),
          activated_by: user?.id,
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] });
      toast.success('Crédito activado');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    }
  });

  const updateCreditLimit = useMutation({
    mutationFn: async ({ 
      userId, 
      newLimit 
    }: { 
      userId: string; 
      newLimit: number;
    }) => {
      const { error } = await supabase
        .from('seller_credits')
        .update({ credit_limit: newLimit })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] });
      toast.success('Límite actualizado');
    },
  });

  const registerPayment = useMutation({
    mutationFn: async ({ 
      userId, 
      amount,
      description 
    }: { 
      userId: string; 
      amount: number;
      description: string;
    }) => {
      // Get current credit info
      const { data: credit, error: creditError } = await supabase
        .from('seller_credits')
        .select('balance_debt')
        .eq('user_id', userId)
        .single();
      
      if (creditError) throw creditError;
      
      const newDebt = Math.max(0, Number(credit.balance_debt) - amount);
      
      // Update debt
      const { error: updateError } = await supabase
        .from('seller_credits')
        .update({ balance_debt: newDebt })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
      
      // Record movement
      const { error: movementError } = await supabase
        .from('credit_movements')
        .insert({
          user_id: userId,
          movement_type: 'payment',
          amount: -amount,
          balance_before: credit.balance_debt ?? 0,
          balance_after: newDebt,
          description,
        });
      
      if (movementError) throw movementError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-total-debt'] });
      toast.success('Pago registrado');
    },
  });

  return {
    allCredits,
    totalDebt,
    isLoading,
    activateCredit,
    updateCreditLimit,
    registerPayment,
  };
};
