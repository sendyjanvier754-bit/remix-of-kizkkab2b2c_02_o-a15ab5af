import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useGrossisteEarnings() {
  const { user } = useAuth();

  const { data: earnings = [], isLoading: loadingEarnings } = useQuery({
    queryKey: ['grossiste-earnings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grossiste_earnings' as any)
        .select('*')
        .eq('grossiste_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: settlements = [], isLoading: loadingSettlements } = useQuery({
    queryKey: ['grossiste-settlements', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grossiste_settlements' as any)
        .select('*')
        .eq('grossiste_user_id', user!.id)
        .order('period_end', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pendingTotal = earnings
    .filter((e: any) => e.status === 'pending')
    .reduce((sum: number, e: any) => sum + Number(e.net_amount || 0), 0);

  const settledTotal = earnings
    .filter((e: any) => e.status === 'settled')
    .reduce((sum: number, e: any) => sum + Number(e.net_amount || 0), 0);

  return {
    earnings,
    settlements,
    pendingTotal,
    settledTotal,
    isLoading: loadingEarnings || loadingSettlements,
  };
}
