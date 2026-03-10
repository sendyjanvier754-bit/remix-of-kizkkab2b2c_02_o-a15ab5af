import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type VerificationStatus = 'unverified' | 'pending_verification' | 'verified' | 'rejected';

export interface KYCVerification {
  id: string;
  user_id: string;
  status: VerificationStatus;
  id_front_url: string | null;
  id_back_url: string | null;
  fiscal_document_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_comments: string | null;
  created_at: string;
  updated_at: string;
}

export const useKYC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: kyc, isLoading } = useQuery({
    queryKey: ['kyc', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as KYCVerification | null;
    },
    enabled: !!user?.id,
  });

  const uploadDocument = async (file: File, type: 'front' | 'back' | 'fiscal') => {
    if (!user?.id) throw new Error('User not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const submitKYC = useMutation({
    mutationFn: async ({ 
      idFrontUrl, 
      idBackUrl, 
      fiscalDocUrl 
    }: { 
      idFrontUrl: string; 
      idBackUrl: string; 
      fiscalDocUrl?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const kycData = {
        user_id: user.id,
        status: 'pending_verification' as VerificationStatus,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        fiscal_document_url: fiscalDocUrl || null,
        submitted_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('kyc_verifications')
        .upsert(kycData, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast.success('Documentos enviados para verificación');
    },
    onError: (error) => {
      toast.error('Error al enviar documentos: ' + error.message);
    }
  });

  const isVerified = kyc?.status === 'verified';
  const isPending = kyc?.status === 'pending_verification';
  const isRejected = kyc?.status === 'rejected';
  const isUnverified = !kyc || kyc.status === 'unverified';

  return {
    kyc,
    isLoading,
    isVerified,
    isPending,
    isRejected,
    isUnverified,
    uploadDocument,
    submitKYC,
  };
};

// Admin hook for managing KYC verifications
export const useAdminKYC = () => {
  const queryClient = useQueryClient();

  const { data: pendingVerifications, isLoading } = useQuery({
    queryKey: ['admin-kyc-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq('status', 'pending_verification')
        .order('submitted_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: allVerifications } = useQuery({
    queryKey: ['admin-kyc-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const reviewKYC = useMutation({
    mutationFn: async ({ 
      kycId, 
      status, 
      comments 
    }: { 
      kycId: string; 
      status: 'verified' | 'rejected'; 
      comments?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kyc_verifications')
        .update({
          status,
          admin_comments: comments,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', kycId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-all'] });
      toast.success('Verificación actualizada');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    }
  });

  return {
    pendingVerifications,
    allVerifications,
    isLoading,
    reviewKYC,
  };
};
