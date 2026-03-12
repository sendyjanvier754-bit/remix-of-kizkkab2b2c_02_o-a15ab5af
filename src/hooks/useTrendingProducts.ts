import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrendingProduct {
  id: string;
  nombre: string;
  precio_b2b: number;
  precio_sugerido_venta: number | null;
  imagen_principal: string | null;
  categoria_id: string | null;
  sku_interno: string;
  stock_status: string;
  view_count: number;
}

export const useTrendingProducts = (daysBack: number = 7, limit: number = 20) => {
  return useQuery({
    queryKey: ["trending-products", daysBack, limit],
    queryFn: async (): Promise<TrendingProduct[]> => {
      const { data, error } = await (supabase as any).rpc("get_trending_products", {
        days_back: daysBack,
        limit_count: limit,
      });

      if (error) {
        console.error("Error fetching trending products:", error);
        // Fallback to recent products if no trending data
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("v_productos_con_precio_b2b")
          .select("id, nombre, precio_b2b, precio_sugerido_venta, imagen_principal, categoria_id, sku_interno, stock_status")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (fallbackError) throw fallbackError;
        return (fallbackData || []).map((p) => ({ ...p, view_count: 0 }));
      }

      const trendingData = data as any[];

      // If no trending data, fallback to recent products
      if (!trendingData || trendingData.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("v_productos_con_precio_b2b")
          .select("id, nombre, precio_b2b, precio_sugerido_venta, imagen_principal, categoria_id, sku_interno, stock_status")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (fallbackError) throw fallbackError;
        return (fallbackData || []).map((p) => ({ ...p, view_count: 0 }));
      }

      return trendingData.map((item: any) => {
        const productData = item.product_data as TrendingProduct;
        return {
          ...productData,
          view_count: Number(item.view_count),
        };
      });
    },
  });
};

// Hook to track product view
export const useTrackProductView = () => {
  const trackView = async (productId: string, source: string = "direct") => {
    const sessionId = getOrCreateSessionId();
    
    await supabase.from("product_views").insert({
      product_id: productId,
      session_id: sessionId,
      source,
    });
  };

  return { trackView };
};

// Helper to get or create session ID
const getOrCreateSessionId = (): string => {
  const key = "siver_session_id";
  let sessionId = sessionStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  
  return sessionId;
};
