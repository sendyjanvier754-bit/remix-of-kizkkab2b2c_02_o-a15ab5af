import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const AFFILIATE_REF_KEY = "kizkka_affiliate_ref";

export interface Affiliate {
  id: string;
  user_id: string;
  display_name: string;
  affiliate_code: string;
  commission_rate_tier1: number;
  commission_rate_tier2: number;
  tier1_purchases_limit: number;
  customer_discount_tier1: number;
  customer_discount_tier2: number;
  status: string;
  total_clicks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateOffer {
  affiliate_id: string;
  affiliate_code: string;
  display_name: string;
  tier: number;
  discount_percent: number;
  commission_rate: number;
  previous_purchases: number;
}

export interface AffiliateConversion {
  id: string;
  affiliate_id: string;
  order_id: string;
  customer_id: string | null;
  customer_purchase_number: number | null;
  tier: number | null;
  sale_amount: number;
  commission_rate: number;
  commission_earned: number;
  discount_applied: number;
  payout_status: string;
  paid_amount: number;
  paid_at: string | null;
  created_at: string;
}

export interface AffiliatePayoutMethod {
  id: string;
  name: string;
  code: string;
  processing_mode: "manual" | "automatic";
  is_active: boolean;
  sort_order: number;
}

export interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  amount: number;
  currency: string;
  paid_at: string;
  payment_method_id: string | null;
  payment_method_name: string;
  reference: string | null;
  notes: string | null;
  status: "processing" | "paid" | "failed" | "voided";
  void_reason: string | null;
  created_at: string;
}

/** Resolve the offer (tier, discount, commission) for a code + customer. */
export async function resolveAffiliateOffer(
  code: string,
  customerId: string,
): Promise<AffiliateOffer | null> {
  if (!code || !customerId) return null;
  const { data, error } = await supabase.rpc("get_affiliate_offer", {
    _code: code.trim().toUpperCase(),
    _customer_id: customerId,
  });
  if (error) {
    console.error("get_affiliate_offer error", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  return (row as AffiliateOffer) ?? null;
}

/** Register a click on an affiliate link (anonymous allowed). */
export async function registerAffiliateClick(code: string, landingPath?: string) {
  try {
    let visitorId = localStorage.getItem("kizkka_visitor_id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("kizkka_visitor_id", visitorId);
    }
    await supabase.rpc("register_affiliate_click", {
      _code: code.trim().toUpperCase(),
      _landing_path: landingPath ?? window.location.pathname,
      _referrer: document.referrer || null,
      _visitor_id: visitorId,
    });
  } catch (e) {
    console.warn("affiliate click not registered", e);
  }
}

export const useMyAffiliate = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-affiliate", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Affiliate) ?? null;
    },
    enabled: !!user?.id,
  });
};

export const useAffiliateConversions = (affiliateId?: string | null) => {
  return useQuery({
    queryKey: ["affiliate-conversions", affiliateId],
    queryFn: async () => {
      if (!affiliateId) return [] as AffiliateConversion[];
      const { data, error } = await supabase
        .from("affiliate_conversions")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AffiliateConversion[];
    },
    enabled: !!affiliateId,
  });
};

/** Admin: load every conversion for portfolio totals and payouts. */
export const useAllAffiliateConversions = () => {
  return useQuery({
    queryKey: ["all-affiliate-conversions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_conversions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AffiliateConversion[];
    },
  });
};

export const useAllAffiliates = () => {
  return useQuery({
    queryKey: ["all-affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Affiliate[];
    },
  });
};

export const useAffiliatePayoutMethods = (includeInactive = false) => useQuery({
  queryKey: ["affiliate-payout-methods", includeInactive],
  queryFn: async () => {
    let query = supabase.from("affiliate_payout_methods").select("*").order("sort_order");
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AffiliatePayoutMethod[];
  },
});

export const useAffiliatePayouts = (affiliateId?: string | null) => useQuery({
  queryKey: ["affiliate-payouts", affiliateId],
  queryFn: async () => {
    if (!affiliateId) return [] as AffiliatePayout[];
    const { data, error } = await supabase
      .from("affiliate_payouts")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AffiliatePayout[];
  },
  enabled: !!affiliateId,
});

export const useSaveAffiliatePayoutMethod = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (method: Partial<AffiliatePayoutMethod> & { name: string; code: string }) => {
      const payload = { ...method, code: method.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") };
      const { error } = method.id
        ? await supabase.from("affiliate_payout_methods").update(payload).eq("id", method.id)
        : await supabase.from("affiliate_payout_methods").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-payout-methods"] });
      toast.success("Método de pago guardado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar el método"),
  });
};

export interface RecordAffiliatePayoutInput {
  affiliateId: string;
  paymentMethodId: string;
  paidAt: string;
  reference?: string;
  notes?: string;
  allocations: { conversion_id: string; amount: number }[];
}

export const useRecordAffiliatePayout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordAffiliatePayoutInput) => {
      const { data, error } = await supabase.rpc("record_affiliate_payout", {
        _affiliate_id: input.affiliateId,
        _payment_method_id: input.paymentMethodId,
        _paid_at: new Date(input.paidAt).toISOString(),
        _allocations: input.allocations,
        _reference: input.reference || undefined,
        _notes: input.notes || undefined,
        _currency: "USD",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["all-affiliate-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate-payouts"] });
      
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo registrar el pago"),
  });
};

export const useVoidAffiliatePayout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payoutId, reason }: { payoutId: string; reason: string }) => {
      const { error } = await supabase.rpc("void_affiliate_payout", { _payout_id: payoutId, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["all-affiliate-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate-payouts"] });
      toast.success("Pago anulado y saldos restaurados");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo anular el pago"),
  });
};

export interface AffiliatePayoutRequest {
  id: string;
  affiliate_id: string;
  amount: number;
  currency: string;
  payment_method_id: string | null;
  payment_details: string | null;
  status: "pending" | "approved" | "paid" | "rejected";
  note: string | null;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** Payout claims made by an affiliate. */
export const useAffiliatePayoutRequests = (affiliateId?: string) =>
  useQuery({
    queryKey: ["affiliate-payout-requests", affiliateId],
    enabled: !!affiliateId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("affiliate_payout_requests")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AffiliatePayoutRequest[];
    },
  });

/** Affiliate: claim the pending commission balance. */
export const useRequestAffiliatePayout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      affiliateId: string;
      amount: number;
      paymentMethodId?: string | null;
      paymentDetails?: string;
      note?: string;
    }) => {
      const { error } = await (supabase as any).from("affiliate_payout_requests").insert({
        affiliate_id: input.affiliateId,
        amount: input.amount,
        payment_method_id: input.paymentMethodId || null,
        payment_details: input.paymentDetails?.trim() || null,
        note: input.note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-payout-requests"] });
      toast.success("Solicitud de pago enviada", {
        description: "El equipo la revisará y te avisará cuando se pague.",
      });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo enviar la solicitud"),
  });
};

/** Admin: change the status of a payout claim. */
export const useResolveAffiliatePayoutRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status: AffiliatePayoutRequest["status"]; adminNote?: string }) => {
      const { error } = await (supabase as any)
        .from("affiliate_payout_requests")
        .update({
          status,
          admin_note: adminNote?.trim() || null,
          resolved_at: status === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-payout-requests"] });
      toast.success("Solicitud actualizada");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo actualizar la solicitud"),
  });
};

export interface AffiliateApplication {
  display_name: string;
  affiliate_code: string;
  notes?: string;
}

/** Public application: creates the affiliate record with status 'pending'. */
export const useApplyAsAffiliate = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AffiliateApplication) => {
      if (!user?.id) throw new Error("Debes iniciar sesión");
      const code = payload.affiliate_code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 3) throw new Error("El código debe tener al menos 3 caracteres");

      const { data, error } = await supabase
        .from("affiliates")
        .insert({
          user_id: user.id,
          display_name: payload.display_name.trim(),
          affiliate_code: code,
          notes: payload.notes?.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          throw new Error("Ese código ya está en uso, elige otro");
        }
        throw error;
      }
      return data as Affiliate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-affiliate"] });
      queryClient.invalidateQueries({ queryKey: ["all-affiliates"] });
      toast.success("Solicitud enviada. Te avisaremos cuando sea aprobada.");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo enviar la solicitud"),
  });
};

/** Admin: create/update affiliate parameters. */
export const useSaveAffiliate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Affiliate> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("affiliates").update(rest as any).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("affiliates")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return (data as Affiliate).id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["my-affiliate"] });
      toast.success("Afiliado guardado");
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });
};

/** Admin: mark conversions as paid. */
export const useMarkConversionsPaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversionIds: string[]) => {
      const { error } = await supabase
        .from("affiliate_conversions")
        .update({ payout_status: "paid", paid_at: new Date().toISOString() })
        .in("id", conversionIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-conversions"] });
      queryClient.invalidateQueries({ queryKey: ["all-affiliate-conversions"] });
      toast.success("Comisiones marcadas como pagadas");
    },
    onError: (e: any) => toast.error(e.message || "Error al liquidar"),
  });
};
