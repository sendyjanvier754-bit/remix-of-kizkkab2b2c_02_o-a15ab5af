import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StoreWithSync {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  auto_sync_b2b: boolean;
  last_b2b_sync_at: string | null;
  is_active: boolean;
}

export interface SyncLog {
  id: string;
  store_id: string;
  action: string;
  details: Record<string, unknown>;
  products_added: number;
  products_updated: number;
  products_removed: number;
  created_at: string;
}

export const useStoresWithSync = () => {
  return useQuery({
    queryKey: ["stores-with-sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, owner_user_id, auto_sync_b2b, last_b2b_sync_at, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as unknown as StoreWithSync[];
    },
  });
};

export const useToggleAutoSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, enabled }: { storeId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("stores")
        .update({ auto_sync_b2b: enabled } as any)
        .eq("id", storeId);

      if (error) throw error;

      // If enabling, trigger immediate sync
      if (enabled) {
        const { data, error: rpcError } = await supabase.rpc(
          "sync_b2b_catalog_for_store" as any,
          { p_store_id: storeId } as any
        );
        if (rpcError) throw rpcError;
        return data;
      }
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["stores-with-sync"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-sync-logs"] });
      toast.success(
        enabled
          ? "Sincronización B2B activada. Los productos se están sincronizando..."
          : "Sincronización B2B desactivada"
      );
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};

export const useManualSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.rpc(
        "sync_b2b_catalog_for_store" as never,
        { p_store_id: storeId } as never
      );
      if (error) throw error;
      return data as unknown as { success: boolean; added: number; updated: number; removed: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stores-with-sync"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-sync-logs"] });
      if (data && typeof data === 'object' && 'success' in data) {
        toast.success(
          `Sincronización completada: ${data.added} agregados, ${data.updated} actualizados, ${data.removed} removidos`
        );
      }
    },
    onError: (error) => {
      toast.error(`Error en sincronización: ${error.message}`);
    },
  });
};

export const useSyncLogs = (storeId?: string) => {
  return useQuery({
    queryKey: ["b2b-sync-logs", storeId],
    queryFn: async () => {
      let query = supabase
        .from("b2b_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SyncLog[];
    },
  });
};
