import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FeaturedTrendingStore {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  owner_user_id: string;
}

export interface FeaturedTrendingMetrics {
  productCount: number;
  purchaseCount: number;
  purchaseQuantity: number;
  totalsByCurrency: Record<string, number>;
}

export interface TrendingStoreSelection {
  id?: string;
  storeId: string | null;
  isEnabled: boolean;
  expiresAt: string | null;
}

const COMPLETED_STATUSES = new Set(["paid", "completed", "delivered"]);

export const useFeaturedTrendingStore = () => {
  const queryClient = useQueryClient();

  const storesQuery = useQuery({
    queryKey: ["featured-trending-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, logo, owner_user_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as FeaturedTrendingStore[];
    },
  });

  const selectionQuery = useQuery({
    queryKey: ["featured-trending-store-selection"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trending_store_selection")
        .select("id, store_id, is_enabled, expires_at");
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        storeId: row.store_id,
        isEnabled: row.is_enabled !== false,
        expiresAt: row.expires_at || null,
      })) as TrendingStoreSelection[];
    },
  });

  const activeSelections = (selectionQuery.data || []).filter((selection) =>
    selection.isEnabled &&
    (!selection.expiresAt || new Date(selection.expiresAt) > new Date()),
  );
  const activeStoreIds = new Set(activeSelections.map((selection) => selection.storeId));
  const selectedStore = storesQuery.data?.find((store) => activeStoreIds.has(store.id)) || null;
  const isSelectionActive = activeSelections.some((selection) => selection.storeId === selectedStore?.id);

  const metricsQuery = useQuery({
    queryKey: ["featured-trending-store-metrics", selectedStore?.id],
    enabled: !!selectedStore && isSelectionActive,
    queryFn: async (): Promise<FeaturedTrendingMetrics> => {
      if (!selectedStore) {
        return { productCount: 0, purchaseCount: 0, purchaseQuantity: 0, totalsByCurrency: {} };
      }

      const [catalogResult, ordersResult] = await Promise.all([
        supabase
          .from("seller_catalog")
          .select("id", { count: "exact", head: true })
          .eq("seller_store_id", selectedStore.id)
          .eq("is_active", true),
        supabase
          .from("orders_b2b")
          .select("id, total_amount, total_quantity, status, payment_status, currency")
          .eq("seller_id", selectedStore.owner_user_id),
      ]);

      if (catalogResult.error) throw catalogResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const completedOrders = (ordersResult.data || []).filter((order) =>
        COMPLETED_STATUSES.has(order.status) || COMPLETED_STATUSES.has(order.payment_status),
      );
      const totalsByCurrency = completedOrders.reduce<Record<string, number>>((totals, order) => {
        const currency = order.currency || "USD";
        totals[currency] = (totals[currency] || 0) + Number(order.total_amount || 0);
        return totals;
      }, {});

      return {
        productCount: catalogResult.count || 0,
        purchaseCount: completedOrders.length,
        purchaseQuantity: completedOrders.reduce(
          (total, order) => total + Number(order.total_quantity || 0),
          0,
        ),
        totalsByCurrency,
      };
    },
  });

  const selectStore = useMutation({
    mutationFn: async ({ storeId, enabled, durationMinutes }: { storeId: string; enabled: boolean; durationMinutes: number | null }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const query = (supabase as any).from("trending_store_selection");
      const values = {
        store_id: storeId,
        is_enabled: enabled,
        expires_at: enabled && durationMinutes
          ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
          : null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };
      let result;

      if (enabled) {
        const { data: existing, error: lookupError } = await query
          .select("id")
          .eq("store_id", storeId)
          .maybeSingle();
        if (lookupError) throw lookupError;

        result = existing
          ? await query.update(values).eq("store_id", storeId)
          : await query.insert(values);
      } else {
        result = await query.update(values).eq("store_id", storeId);
      }
      const { error } = result;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-trending-store-selection"] });
      queryClient.invalidateQueries({ queryKey: ["featured-trending-store-metrics"] });
    },
    onError: (error: Error) => {
      toast.error(`No se pudo actualizar la tienda destacada: ${error.message}`);
    },
  });

  return {
    stores: storesQuery.data || [],
    selectedStore,
    selections: selectionQuery.data || [],
    activeSelections,
    isSelectionActive,
    metrics: metricsQuery.data,
    isLoading: storesQuery.isLoading || selectionQuery.isLoading,
    metricsLoading: metricsQuery.isLoading,
    error: storesQuery.error || selectionQuery.error || metricsQuery.error,
    selectStore,
  };
};
