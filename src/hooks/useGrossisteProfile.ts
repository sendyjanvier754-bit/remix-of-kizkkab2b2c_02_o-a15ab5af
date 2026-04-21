import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface GrossisteProfile {
  user_id: string;
  business_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  enable_b2c_storefront: boolean;
  b2c_store_id: string | null;
  commission_rate: number;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useGrossisteProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['grossiste-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grossiste_profiles' as any)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GrossisteProfile | null;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<GrossisteProfile>) => {
      const { error } = await supabase
        .from('grossiste_profiles' as any)
        .update(patch as any)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grossiste-profile', user?.id] });
      toast.success("Perfil actualizado");
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  return { profile, isLoading, update };
}
