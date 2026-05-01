import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PartnerApplicationType = "pickup_point" | "driver";

export interface SubmitApplicationPayload {
  application_type: PartnerApplicationType;
  full_name: string;
  email: string;
  phone: string;
  data: Record<string, unknown>;
}

export const useSubmitPartnerApplication = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: SubmitApplicationPayload) => {
      const { data, error } = await supabase.rpc("submit_partner_application", {
        p_application_type: payload.application_type,
        p_full_name: payload.full_name,
        p_email: payload.email,
        p_phone: payload.phone,
        p_data: payload.data as never,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { application_id: string; tracking_token: string };
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
};

export const usePartnerApplications = (status?: string) => {
  return useQuery({
    queryKey: ["partner-applications", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("partner_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useApprovePartnerApplication = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: {
      application_id: string;
      approved_user_id: string;
      pickup_point_id?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("approve_partner_application", {
        p_application_id: vars.application_id,
        p_approved_user_id: vars.approved_user_id,
        p_pickup_point_id: vars.pickup_point_id ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-applications"] });
      toast({ title: "Solicitud aprobada", description: "Se asignó el rol y se creó el perfil." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useRejectPartnerApplication = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { application_id: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_partner_application", {
        p_application_id: vars.application_id,
        p_reason: vars.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-applications"] });
      toast({ title: "Solicitud rechazada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDepartmentsAndCommunes = () => {
  const departments = useQuery({
    queryKey: ["public-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const communes = useQuery({
    queryKey: ["public-communes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communes")
        .select("id, name, code, department_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return { departments, communes };
};
