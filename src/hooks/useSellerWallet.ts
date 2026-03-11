import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface SellerWallet {
  id: string;
  seller_id: string;
  pending_balance: number;
  available_balance: number;
  commission_debt: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: string;
  status: string;
  amount: number;
  fee_amount: number;
  tax_amount: number;
  net_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: Json;
  release_at: string | null;
  released_at: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  currency: string;
  payment_method: string;
  bank_details: Json;
  status: string;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

export const useSellerWallet = (sellerId?: string) => {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = async () => {
    if (!sellerId) return;
    
    try {
      setIsLoading(true);
      
      const { data: walletData, error: walletError } = await supabase
        .from('seller_wallets')
        .select('*')
        .eq('seller_id', sellerId)
        .single();

      if (walletError && walletError.code !== 'PGRST116') throw walletError;
      
      setWallet(walletData);

      if (walletData) {
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(50);

        setTransactions((txData || []) as any[]);

        const { data: withdrawalData } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false });

        setWithdrawals((withdrawalData || []) as any[]);
      }
    } catch (error: any) {
      console.error('Error fetching wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestWithdrawal = async (
    amount: number, 
    paymentMethod: 'bank_transfer' | 'moncash',
    bankDetails?: Record<string, any>
  ) => {
    if (!wallet) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se encontró el wallet',
      });
      return false;
    }

    // Check available balance (after debts)
    const effectiveBalance = wallet.available_balance - wallet.commission_debt;
    
    if (amount > effectiveBalance) {
      toast({
        variant: 'destructive',
        title: 'Saldo insuficiente',
        description: `Saldo disponible después de deudas: $${effectiveBalance.toFixed(2)}`,
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          wallet_id: wallet.id,
          seller_id: sellerId,
          amount,
          fee_amount: 0,
          net_amount: amount,
          payment_method: paymentMethod,
          bank_details: bankDetails || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Solicitud enviada',
        description: 'Tu solicitud de retiro está pendiente de aprobación',
      });

      await fetchWallet();
      return true;
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear la solicitud de retiro',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [sellerId]);

  return {
    wallet,
    transactions,
    withdrawals,
    isLoading,
    requestWithdrawal,
    refetch: fetchWallet,
    effectiveBalance: wallet ? wallet.available_balance - wallet.commission_debt : 0,
  };
};

// Hook for admin to manage all wallets
export const useAdminWallets = () => {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<(SellerWallet & { seller_name?: string })[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setIsLoading(true);

      const { data: walletsData, error: walletsError } = await supabase
        .from('seller_wallets')
        .select(`
          *,
          sellers (
            name,
            business_name
          )
        `)
        .order('pending_balance', { ascending: false });

      if (walletsError) throw walletsError;

      const formattedWallets = (walletsData || []).map((w: any) => ({
        ...w,
        seller_name: w.sellers?.business_name || w.sellers?.name,
      }));

      setWallets(formattedWallets);

      const { data: withdrawalsData } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          sellers (
            name,
            business_name
          )
        `)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      setPendingWithdrawals((withdrawalsData || []) as any[]);
    } catch (error: any) {
      console.error('Error fetching admin wallets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processWithdrawal = async (
    withdrawalId: string, 
    action: 'approved' | 'rejected' | 'completed',
    notes?: string
  ) => {
    try {
      // Use secure server-side function for withdrawal processing
      const { data, error } = await supabase.rpc('process_withdrawal_completion', {
        p_withdrawal_id: withdrawalId,
        p_action: action,
        p_admin_notes: notes || null
      });

      if (error) throw error;

      toast({
        title: 'Retiro actualizado',
        description: `Estado cambiado a ${action}`,
      });

      await fetchAll();
      return true;
    } catch (error: any) {
      console.error('Error processing withdrawal:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo procesar el retiro',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return {
    wallets,
    pendingWithdrawals,
    isLoading,
    processWithdrawal,
    refetch: fetchAll,
    stats: {
      totalPending: wallets.reduce((sum, w) => sum + w.pending_balance, 0),
      totalAvailable: wallets.reduce((sum, w) => sum + w.available_balance, 0),
      totalDebt: wallets.reduce((sum, w) => sum + w.commission_debt, 0),
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmount: pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0),
    },
  };
};
