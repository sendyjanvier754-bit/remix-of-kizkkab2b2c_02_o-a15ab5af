import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface AppliedDiscount {
  type: 'code' | 'customer';
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  discountAmount: number;
  code?: string;
  discountId: string;
}

export interface ValidateDiscountResult {
  valid: boolean;
  discount?: AppliedDiscount;
  error?: string;
}

export const useApplyDiscount = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);

  const validateDiscountCode = useCallback(async (
    code: string, 
    subtotal: number,
    storeId?: string | null
  ): Promise<ValidateDiscountResult> => {
    if (!user) {
      return { valid: false, error: t('toasts.mustLogin') };
    }

    setIsValidating(true);
    try {
      // Get discount code
      const { data: discountCode, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!discountCode) {
        return { valid: false, error: 'Código no válido' };
      }

      // Check validity period
      const now = new Date();
      if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
        return { valid: false, error: 'Este código aún no está activo' };
      }
      if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
        return { valid: false, error: 'Este código ha expirado' };
      }

      // Check store restriction
      if (discountCode.store_id && storeId && discountCode.store_id !== storeId) {
        return { valid: false, error: 'Este código no aplica para esta tienda' };
      }

      // Check minimum purchase
      if (discountCode.min_purchase_amount && subtotal < discountCode.min_purchase_amount) {
        return { 
          valid: false, 
          error: `Monto mínimo de compra: $${discountCode.min_purchase_amount.toFixed(2)}` 
        };
      }

      // Check max uses total
      if (discountCode.max_uses && discountCode.used_count >= discountCode.max_uses) {
        return { valid: false, error: 'Este código ha alcanzado su límite de uso' };
      }

      // Check max uses per user
      if (discountCode.max_uses_per_user) {
        const { count } = await supabase
          .from('discount_code_uses')
          .select('*', { count: 'exact', head: true })
          .eq('discount_code_id', discountCode.id)
          .eq('user_id', user.id);

        if (count && count >= discountCode.max_uses_per_user) {
          return { valid: false, error: 'Ya has usado este código el máximo de veces permitido' };
        }
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (discountCode.discount_type === 'percentage') {
        discountAmount = (subtotal * discountCode.discount_value) / 100;
      } else {
        discountAmount = Math.min(discountCode.discount_value, subtotal);
      }

      const discount: AppliedDiscount = {
        type: 'code',
        discountType: discountCode.discount_type as 'percentage' | 'fixed_amount',
        discountValue: discountCode.discount_value,
        discountAmount,
        code: discountCode.code,
        discountId: discountCode.id,
      };

      return { valid: true, discount };
    } catch (error) {
      console.error('Error validating discount code:', error);
      return { valid: false, error: 'Error al validar código' };
    } finally {
      setIsValidating(false);
    }
  }, [user]);

  const checkCustomerDiscount = useCallback(async (
    subtotal: number,
    storeId?: string | null
  ): Promise<AppliedDiscount | null> => {
    if (!user) return null;

    try {
      let query = supabase
        .from('customer_discounts')
        .select('*')
        .eq('customer_user_id', user.id)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .order('discount_value', { ascending: false });

      // Filter by store if applicable
      if (storeId) {
        query = query.or(`store_id.is.null,store_id.eq.${storeId}`);
      }

      const { data, error } = await query.limit(1);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const customerDiscount = data[0];

      // Check validity
      if (customerDiscount.valid_until && new Date(customerDiscount.valid_until) < new Date()) {
        return null;
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (customerDiscount.discount_type === 'percentage') {
        discountAmount = (subtotal * customerDiscount.discount_value) / 100;
      } else {
        discountAmount = Math.min(customerDiscount.discount_value, subtotal);
      }

      return {
        type: 'customer',
        discountType: customerDiscount.discount_type as 'percentage' | 'fixed_amount',
        discountValue: customerDiscount.discount_value,
        discountAmount,
        discountId: customerDiscount.id,
      };
    } catch (error) {
      console.error('Error checking customer discount:', error);
      return null;
    }
  }, [user]);

  const applyDiscount = useCallback(async (
    code: string,
    subtotal: number,
    storeId?: string | null
  ) => {
    const result = await validateDiscountCode(code, subtotal, storeId);
    
    if (result.valid && result.discount) {
      setAppliedDiscount(result.discount);
      toast.success(`Descuento aplicado: -$${result.discount.discountAmount.toFixed(2)}`);
    } else if (result.error) {
      toast.error(result.error);
    }

    return result;
  }, [validateDiscountCode]);

  const removeDiscount = useCallback(() => {
    setAppliedDiscount(null);
    toast.info(t('toasts.discountRemoved'));
  }, []);

  const recordDiscountUse = useCallback(async (
    discountId: string,
    orderId: string,
    discountAmount: number
  ) => {
    if (!user) return false;

    try {
      // Record the use
      const { error: useError } = await supabase
        .from('discount_code_uses')
        .insert({
          discount_code_id: discountId,
          user_id: user.id,
          order_id: orderId,
          discount_applied: discountAmount,
        });

      if (useError) throw useError;

      // Get current count and increment
      const { data: currentCode } = await supabase
        .from('discount_codes')
        .select('used_count')
        .eq('id', discountId)
        .single();

      await supabase
        .from('discount_codes')
        .update({ used_count: (currentCode?.used_count || 0) + 1 })
        .eq('id', discountId);

      return true;
    } catch (error) {
      console.error('Error recording discount use:', error);
      return false;
    }
  }, [user]);

  return {
    isValidating,
    appliedDiscount,
    validateDiscountCode,
    checkCustomerDiscount,
    applyDiscount,
    removeDiscount,
    recordDiscountUse,
    setAppliedDiscount,
  };
};
