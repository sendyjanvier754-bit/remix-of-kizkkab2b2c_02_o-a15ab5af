import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingStoreProduct {
  id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  imagen: string | null;
}

export interface StoreReview {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  user_name?: string;
}

export interface TrendingStore {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  products: TrendingStoreProduct[];
  followers: number;
  salesCount: string;
  newProductsCount: number;
  recentReview: {
    author: string;
    text: string;
  } | null;
}

export const useTrendingStores = (limit = 5) => {
  return useQuery({
    queryKey: ["trending-stores", limit],
    queryFn: async () => {
      // Fetch active stores with their products
      const { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("id, name, slug, logo, owner_user_id")
        .eq("is_active", true)
        .limit(limit);

      if (storesError) throw new Error(storesError.message);

      // For each store, fetch their products, followers, reviews, and sales
      const storesWithData: TrendingStore[] = await Promise.all(
        (stores || []).map(async (store) => {
          // Fetch 4 most recent products
          const { data: products } = await supabase
            .from("seller_catalog")
            .select("id, sku, nombre, precio_venta, images, imported_at")
            .eq("seller_store_id", store.id)
            .eq("is_active", true)
            .order("imported_at", { ascending: false })
            .limit(4);

          // Fetch followers count
          const { count: followersCount } = await supabase
            .from("store_followers")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          // Fetch most recent review with user profile
          const { data: reviews } = await supabase
            .from("store_reviews")
            .select("id, user_id, comment, is_anonymous, created_at")
            .eq("store_id", store.id)
            .not("comment", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);

          // Get user name for review if not anonymous
          let recentReview: TrendingStore["recentReview"] = null;
          if (reviews && reviews.length > 0) {
            const review = reviews[0];
            let authorName = "Usuario";
            
            if (!review.is_anonymous) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", review.user_id)
                .single();
              
              if (profile?.full_name) {
                // Mask the name like "J***n"
                const name = profile.full_name;
                if (name.length > 2) {
                  authorName = `${name.charAt(0)}***${name.charAt(name.length - 1)}`;
                } else {
                  authorName = `${name.charAt(0)}***`;
                }
              }
            } else {
              authorName = "Anónimo";
            }

            recentReview = {
              author: authorName,
              text: review.comment || "",
            };
          }

          // Count new products (last 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const { count: newProductsCount } = await supabase
            .from("seller_catalog")
            .select("*", { count: "exact", head: true })
            .eq("seller_store_id", store.id)
            .eq("is_active", true)
            .gte("imported_at", sevenDaysAgo.toISOString());

          // Calculate real sales count from orders_b2b
          let salesCount = "0";
          try {
            // Get seller record for this store owner
            const { data: seller } = await supabase
              .from("sellers")
              .select("id")
              .eq("user_id", store.owner_user_id)
              .single();

            if (seller) {
              // Count total quantity sold from orders_b2b
              const { data: orders } = await supabase
                .from("orders_b2b")
                .select("total_quantity")
                .eq("seller_id", store.owner_user_id)
                .in("status", ["paid", "completed", "delivered"]);

              const totalSold = orders?.reduce((sum, order) => sum + (order.total_quantity || 0), 0) || 0;
              
              // Format the count
              if (totalSold >= 1000) {
                salesCount = `${(totalSold / 1000).toFixed(0)}K+`;
              } else if (totalSold > 0) {
                salesCount = `${totalSold}+`;
              } else {
                salesCount = "Nuevo";
              }
            }
          } catch (e) {
            salesCount = "Nuevo";
          }

          const formattedProducts: TrendingStoreProduct[] = (products || []).map(p => ({
            id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            precio_venta: p.precio_venta,
            imagen: p.images && typeof p.images === 'object' && Array.isArray(p.images) 
              ? (p.images as string[])[0] 
              : null,
          }));

          return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            logo: store.logo,
            products: formattedProducts,
            followers: followersCount || 0,
            salesCount,
            newProductsCount: newProductsCount || 0,
            recentReview,
          };
        })
      );

      // Return all stores (even without products for now)
      // Sort by followers and sales
      return storesWithData.sort((a, b) => b.followers - a.followers);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to follow/unfollow a store
export const useStoreFollow = () => {
  const followStore = async (storeId: string, userId: string) => {
    const { error } = await supabase
      .from("store_followers")
      .insert({ store_id: storeId, user_id: userId });
    
    if (error && error.code !== "23505") throw error; // Ignore duplicate key error
    return true;
  };

  const unfollowStore = async (storeId: string, userId: string) => {
    const { error } = await supabase
      .from("store_followers")
      .delete()
      .eq("store_id", storeId)
      .eq("user_id", userId);
    
    if (error) throw error;
    return true;
  };

  const checkIfFollowing = async (storeId: string, userId: string) => {
    const { data, error } = await supabase
      .from("store_followers")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .single();
    
    if (error && error.code !== "PGRST116") throw error;
    return !!data;
  };

  return { followStore, unfollowStore, checkIfFollowing };
};

// Hook to manage store reviews
export const useStoreReviews = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ["store-reviews", storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from("store_reviews")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StoreReview[];
    },
    enabled: !!storeId,
  });
};

export const useSubmitReview = () => {
  const submitReview = async (
    storeId: string,
    userId: string,
    rating: number,
    comment?: string,
    isAnonymous = false
  ) => {
    const { data, error } = await supabase
      .from("store_reviews")
      .upsert(
        {
          store_id: storeId,
          user_id: userId,
          rating,
          comment,
          is_anonymous: isAnonymous,
        },
        { onConflict: "store_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return { submitReview };
};
