import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreProfile {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  owner_user_id: string;
  slug: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata: any;
  country: string | null;
  city: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  tiktok: string | null;
  market_id: string | null;
  destination_country_id: string | null;
}

// Helper to check if string is a valid UUID
const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const useStore = (storeIdOrSlug: string | undefined) => {
  return useQuery({
    queryKey: ["store", storeIdOrSlug],
    queryFn: async () => {
      // Query by id if UUID, otherwise by slug
      const column = isUUID(storeIdOrSlug!) ? "id" : "slug";
      
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq(column, storeIdOrSlug!)
        .single();

      if (error) throw new Error(error.message);
      return data as StoreProfile;
    },
    enabled: !!storeIdOrSlug,
    staleTime: 1000 * 60 * 10,
  });
};

export const useStoreByOwner = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["store", "owner", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_user_id", userId!)
        .single();

      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return data as StoreProfile | null;
    },
    enabled: !!userId,
  });
};

export const useStoreProducts = (storeId: string | undefined, page = 0, limit = 12) => {
  return useQuery({
    queryKey: ["store", storeId, "products", page],
    queryFn: async () => {
      if (!storeId) return { products: [], total: 0 };

      const { data, error, count } = await supabase
        .from("seller_catalog")
        .select("*, product:products(*)", { count: "exact" })
        .eq("seller_store_id", storeId)
        .eq("is_active", true)
        .range(page * limit, (page + 1) * limit - 1)
        .order("imported_at", { ascending: false });

      if (error) throw new Error(error.message);
      return { products: data, total: count || 0 };
    },
    enabled: !!storeId,
  });
};

// Approximate exchange rates to USD (as of late 2024/early 2025)
const EXCHANGE_RATES: Record<string, number> = {
  "COP": 0.00025, // 1 USD = 4000 COP
  "MXN": 0.05,    // 1 USD = 20 MXN
  "ARS": 0.001,   // 1 USD = 1000 ARS (approx)
  "CLP": 0.00105, // 1 USD = 950 CLP
  "PEN": 0.27,    // 1 USD = 3.7 PEN
  "EUR": 1.05,    // 1 USD = 0.95 EUR
  "USD": 1
};

export const useStoreSales = (storeId: string | undefined) => {
  const { data: store } = useStore(storeId);

  return useQuery({
    queryKey: ["store", storeId, "sales"],
    queryFn: async () => {
      if (!store?.owner_user_id) return 0;

      // 1. Get seller ID from the owner_user_id
      const { data: seller, error: sellerError } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", store.owner_user_id)
        .single();

      if (sellerError || !seller) {
          return 0;
      }

      // 2. Get orders in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orders, error: ordersError } = await supabase
        .from("orders_b2b")
        .select("total_amount, currency")
        .eq("seller_id", seller.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (ordersError) {
          console.error("Error fetching orders", ordersError);
          return 0;
      }

      // 3. Calculate total in USD (approx)
      const totalUSD = orders.reduce((acc, order) => {
        let amount = Number(order.total_amount) || 0;
        const currency = order.currency || "USD"; // Default to USD if missing
        
        // Use exchange rate map
        const rate = EXCHANGE_RATES[currency] || 1; // Default 1:1 if unknown currency
        
        return acc + (amount * rate);
      }, 0);

      return totalUSD;
    },
    enabled: !!store?.owner_user_id,
  });
};
