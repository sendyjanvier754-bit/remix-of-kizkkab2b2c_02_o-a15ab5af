import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RateTier {
  id: string;
  template_id: string;
  min_kg: number;
  max_kg: number;
  rate: number;
  sort_order: number;
}

export interface RateTemplate {
  id: string;
  name: string;
  scope: "global" | "segment" | "individual";
  segment_key: string | null;
  pickup_point_id: string | null;
  extra_block_kg: number;
  extra_block_rate: number;
  currency: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  tiers: RateTier[];
}

export const useRateTemplates = () => {
  return useQuery({
    queryKey: ["pickup-rate-templates"],
    queryFn: async (): Promise<RateTemplate[]> => {
      const { data: templates, error } = await supabase
        .from("pickup_rate_templates")
        .select("*")
        .order("scope", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (templates ?? []).map((t) => t.id);
      let tiers: RateTier[] = [];
      if (ids.length) {
        const { data: tierRows, error: tierErr } = await supabase
          .from("pickup_rate_tiers")
          .select("*")
          .in("template_id", ids)
          .order("min_kg", { ascending: true });
        if (tierErr) throw tierErr;
        tiers = (tierRows ?? []) as RateTier[];
      }

      return (templates ?? []).map((t) => ({
        ...(t as unknown as RateTemplate),
        tiers: tiers.filter((tier) => tier.template_id === t.id),
      }));
    },
  });
};

export interface SaveTemplateInput {
  id?: string;
  name: string;
  scope: "global" | "segment" | "individual";
  segment_key?: string | null;
  pickup_point_id?: string | null;
  extra_block_kg: number;
  extra_block_rate: number;
  currency: string;
  is_active: boolean;
  tiers: Array<{ min_kg: number; max_kg: number; rate: number }>;
}

export const useSaveRateTemplate = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SaveTemplateInput) => {
      const payload = {
        name: input.name,
        scope: input.scope,
        segment_key: input.scope === "segment" ? input.segment_key || null : null,
        pickup_point_id: input.scope === "individual" ? input.pickup_point_id || null : null,
        extra_block_kg: input.extra_block_kg,
        extra_block_rate: input.extra_block_rate,
        currency: input.currency,
        is_active: input.is_active,
      };

      let templateId = input.id;
      if (templateId) {
        const { error } = await supabase.from("pickup_rate_templates").update(payload).eq("id", templateId);
        if (error) throw error;
        const { error: delErr } = await supabase.from("pickup_rate_tiers").delete().eq("template_id", templateId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from("pickup_rate_templates").insert(payload).select("id").single();
        if (error) throw error;
        templateId = data.id;
      }

      if (input.tiers.length) {
        const { error } = await supabase.from("pickup_rate_tiers").insert(
          input.tiers.map((tier, index) => ({
            template_id: templateId!,
            min_kg: tier.min_kg,
            max_kg: tier.max_kg,
            rate: tier.rate,
            sort_order: index + 1,
          })),
        );
        if (error) throw error;
      }
      return templateId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-rate-templates"] });
      toast({ title: "Matriz guardada" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

export const useDeleteRateTemplate = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pickup_rate_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-rate-templates"] });
      toast({ title: "Matriz eliminada" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

export const usePickupEarnings = (pickupPointId?: string) => {
  return useQuery({
    queryKey: ["pickup-point-earnings", pickupPointId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("pickup_point_earnings")
        .select("*, pickup_points(name, point_code)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (pickupPointId) query = query.eq("pickup_point_id", pickupPointId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
};

export interface CommissionPreview {
  commission: number;
  currency: string;
  template_id: string | null;
  template_name?: string;
  base_rate: number;
  extra_blocks: number;
  extra_amount: number;
  weight_kg: number;
}

export const usePreviewCommission = () => {
  return useMutation({
    mutationFn: async ({ pickupPointId, weightKg }: { pickupPointId: string; weightKg: number }) => {
      const { data, error } = await supabase.rpc("calculate_pickup_commission", {
        p_pickup_point_id: pickupPointId,
        p_weight_kg: weightKg,
      });
      if (error) throw error;
      return data as unknown as CommissionPreview;
    },
  });
};
