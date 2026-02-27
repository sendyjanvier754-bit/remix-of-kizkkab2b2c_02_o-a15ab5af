import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";import { generateStoreSlug } from '@/utils/storeSlugGenerator';import { toast } from "sonner";

// Local types that match what the code expects (DB enum may differ)
export type ApprovalRequestType = 'kyc_verification' | 'referral_bonus' | 'credit_limit_increase' | 'credit_activation' | 'seller_upgrade' | 'withdrawal' | 'refund' | 'credit_purchase' | 'kyc_review';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  requester_id: string;
  status: ApprovalStatus;
  metadata: Record<string, unknown>;
  amount: number | null;
  admin_comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export const useAdminApprovals = () => {
  const queryClient = useQueryClient();

  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ['admin-approvals-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data?.map(r => r.requester_id) ?? [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);
      
      // Use unknown first to avoid type conflicts with DB enum
      return data?.map(r => ({
        ...r,
        request_type: r.request_type as unknown as ApprovalRequestType,
        status: r.status as unknown as ApprovalStatus,
        profiles: profileMap.get(r.requester_id) || null,
      })) as ApprovalRequest[];
    },
  });

  const { data: allRequests } = useQuery({
    queryKey: ['admin-approvals-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_approval_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const userIds = data?.map(r => r.requester_id) ?? [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);
      
      return data?.map(r => ({
        ...r,
        request_type: r.request_type as unknown as ApprovalRequestType,
        status: r.status as unknown as ApprovalStatus,
        profiles: profileMap.get(r.requester_id) || null,
      })) as ApprovalRequest[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-approval-stats'],
    queryFn: async () => {
      const { data: pending, error: pendingError } = await supabase
        .from('admin_approval_requests')
        .select('request_type')
        .eq('status', 'pending');
      
      if (pendingError) throw pendingError;

      const { data: kycPending } = await supabase
        .from('kyc_verifications')
        .select('id')
        .eq('status', 'pending' as any); // Use 'pending' instead of 'pending_verification'

      const { data: totalDebt } = await supabase
        .from('seller_credits')
        .select('balance_debt');

      // Cast request_type to string for comparison since DB enum may differ
      const pendingTyped = pending?.map(p => ({ ...p, request_type: p.request_type as string })) ?? [];
      
      return {
        totalPending: (pending?.length ?? 0) + (kycPending?.length ?? 0),
        kycPending: kycPending?.length ?? 0,
        bonusPending: pendingTyped.filter(p => p.request_type === 'referral_bonus').length ?? 0,
        creditPending: pendingTyped.filter(p => p.request_type === 'credit_limit_increase' || p.request_type === 'credit_activation').length ?? 0,
        sellerUpgradePending: pendingTyped.filter(p => p.request_type === 'seller_upgrade').length ?? 0,
        totalDebt: totalDebt?.reduce((sum, c) => sum + Number((c as any).balance_debt || 0), 0) ?? 0,
      };
    },
  });

  const approveRequest = useMutation({
    mutationFn: async ({ 
      requestId, 
      comments 
    }: { 
      requestId: string; 
      comments?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get request details first
      const { data: request, error: fetchError } = await supabase
        .from('admin_approval_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (fetchError) throw fetchError;

      // Cast request_type to string for comparison since DB enum may differ
      const requestType = request.request_type as string;
      
      // Process based on request type
      if (requestType === 'referral_bonus') {
        // Apply bonus to referrer's debt
        const { data: credit } = await supabase
          .from('seller_credits')
          .select('balance_debt')
          .eq('user_id', request.requester_id)
          .single();

        if (credit) {
          const newDebt = Math.max(0, Number(credit.balance_debt) - Number(request.amount));
          
          await supabase
            .from('seller_credits')
            .update({ balance_debt: newDebt })
            .eq('user_id', request.requester_id);
          
          await supabase
            .from('credit_movements')
            .insert({
              user_id: request.requester_id,
              movement_type: 'referral_bonus',
              amount: -Number(request.amount),
              balance_before: credit.balance_debt,
              balance_after: newDebt,
              reference_id: requestId,
              description: 'Bono por referido aprobado',
            });
        }
        
        // Mark referral bonus as approved
        const metadata = request.metadata as Record<string, string>;
        if (metadata?.referral_id) {
          await supabase
            .from('referrals')
            .update({ bonus_approved: true })
            .eq('id', metadata.referral_id);
        }
      }

      if (requestType === 'credit_limit_increase') {
        const metadata = request.metadata as Record<string, number>;
        await supabase
          .from('seller_credits')
          .update({ credit_limit: metadata?.new_limit ?? 0 })
          .eq('user_id', request.requester_id);
      }

      // Handle seller upgrade approval
      if (requestType === 'seller_upgrade') {
        const metadata = request.metadata as Record<string, string>;
        
        // 1. Delete existing 'user' role (if exists)
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', request.requester_id)
          .eq('role', 'user');
        
        // 2. Assign 'seller' role (this should trigger auto-store creation via trigger)
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: request.requester_id,
            role: 'seller',
          });
        
        if (roleError && !roleError.message.includes('duplicate')) {
          throw roleError;
        }
        
        // 3. Wait for trigger to create store (with retries)
        let storeExists = false;
        let autoCreatedStore = false;
        
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('owner_user_id', request.requester_id)
            .maybeSingle();
          
          if (store) {
            storeExists = true;
            autoCreatedStore = true;
            console.log(`✅ Auto-created store detected for seller ${request.requester_id}`);
            break;
          }
        }
        
        // 4. If trigger didn't create store, create manually (fallback)
        if (!storeExists) {
          console.warn(`⚠️ Trigger didn't create store for ${request.requester_id}, creating manually...`);
          
          const storeName = metadata?.store_name || metadata?.user_name || 'Mi Tienda';
          
          // Generate unique slug with retry logic
          const slug = await generateUniqueStoreSlug(async (candidateSlug) => {
            const { data } = await supabase
              .from('stores')
              .select('id')
              .eq('slug', candidateSlug)
              .maybeSingle();
            return data === null; // true if doesn't exist (unique)
          });

          if (!slug) {
            console.error('Failed to generate unique slug, skipping store creation');
            // Continue without store - seller will be redirected to onboarding
          } else {
            const { error: storeError } = await supabase.from('stores').insert({
              owner_user_id: request.requester_id,
              name: storeName || "Mi Tienda",
              description: metadata?.store_description || `Tienda de ${storeName || 'vendedor'}`,
              slug: slug,
              is_active: true,
              is_accepting_orders: true,
              show_stock: true,
              country: 'Haiti',
            });
            
            if (storeError) {
              console.error('Error creating store manually:', storeError);
              // Don't throw - store creation is not critical
            } else {
              console.log(`✅ Manually created store for seller ${request.requester_id}`);
            }
          }
        }
        
        // 5. Create seller record if not exists
        const { data: existingSeller } = await supabase
          .from('sellers')
          .select('id')
          .eq('user_id', request.requester_id)
          .maybeSingle();
        
        if (!existingSeller) {
          await supabase.from('sellers').insert({
            user_id: request.requester_id,
            email: metadata?.user_email || '',
            name: metadata?.store_name || metadata?.user_name || 'Vendedor',
            business_name: metadata?.store_name || null,
            phone: metadata?.phone || null,
            is_verified: false,
          });
        }
      }

      // Update request status
      const { error } = await supabase
        .from('admin_approval_requests')
        .update({
          status: 'approved',
          admin_comments: comments,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approvals-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] });
      toast.success('Solicitud aprobada');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    }
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ 
      requestId, 
      comments 
    }: { 
      requestId: string; 
      comments: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('admin_approval_requests')
        .update({
          status: 'rejected',
          admin_comments: comments,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approvals-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-stats'] });
      toast.success('Solicitud rechazada');
    },
  });

  return {
    pendingRequests,
    allRequests,
    stats,
    isLoading,
    approveRequest,
    rejectRequest,
  };
};
