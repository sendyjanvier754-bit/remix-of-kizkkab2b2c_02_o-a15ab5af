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
  store_id?: string;
  user_id?: string;
  rating: number;
  comment: string | null;
  is_anonymous?: boolean;
  created_at: string;
  updated_at?: string;
  photos?: string[];
  parent_review_id?: string | null;
  user_name?: string;
  user_avatar?: string | null;
  replies?: StoreReview[];
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
          const { data: reviews } = await (supabase as any)
            .from("store_reviews")
            .select("id, user_id, comment, created_at")
            .eq("store_id", store.id)
            .not("comment", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);

          // Get user name for review if not anonymous
          let recentReview: TrendingStore["recentReview"] = null;
          const reviewsArr = (reviews || []) as any[];
          if (reviewsArr.length > 0) {
            const review = reviewsArr[0];
            let authorName = "Usuario";
            
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

// Hook to manage store reviews (top-level only, with replies nested)
export const useStoreReviews = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ["store-reviews", storeId],
    queryFn: async () => {
      if (!storeId) return [];

      // Fetch all reviews (top-level and replies) for this store
      const { data, error } = await (supabase as any)
        .from("store_reviews")
        .select("id, store_id, user_id, rating, comment, photos, parent_review_id, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as StoreReview[];

      // Fetch profile names for non-anonymous reviews
      const userIds = [...new Set(rows.filter(r => r.user_id).map(r => r.user_id!))];
      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      // Enrich rows with user names
      const enriched = rows.map(r => ({
        ...r,
        photos: Array.isArray(r.photos) ? r.photos : [],
        parent_review_id: r.parent_review_id ?? null,
        user_name: profileMap[r.user_id!]?.full_name || "Usuario",
        user_avatar: profileMap[r.user_id!]?.avatar_url || null,
        replies: [],
      }));

      return enriched.reverse();
    },
    enabled: !!storeId,
  });
};

// Upload photos to product-images bucket, return public URLs
export const uploadReviewPhotos = async (files: File[], storeId: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `store-reviews/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
    if (error) { console.error('Photo upload error:', error); continue; }
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
    if (pub?.publicUrl) urls.push(pub.publicUrl);
  }
  return urls;
};

export const useSubmitReview = () => {
  const submitReview = async (
    storeId: string,
    userId: string,
    rating: number,
    comment?: string,
    _isAnonymous = false,
    photos: string[] = [],
    parentReviewId?: string
  ) => {
    // Replies are always inserts (minimal payload, no photos)
    if (parentReviewId) {
      const insertPayload = {
        store_id: storeId,
        user_id: userId,
        rating,
        comment: comment || null,
        parent_review_id: parentReviewId,
      };

      const { data, error } = await (supabase as any)
        .from("store_reviews")
        .insert(insertPayload)
        .select("id, store_id, user_id, rating, comment, created_at")
        .single();
      if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);
      return data;
    }

    // Always insert a new top-level review
    const insertPayload: Record<string, unknown> = {
      store_id: storeId,
      user_id: userId,
      rating,
      comment: comment || null,
    };
    if (photos.length > 0) insertPayload.photos = photos;

    const { data, error } = await (supabase as any)
      .from("store_reviews")
      .insert(insertPayload)
      .select("id, store_id, user_id, rating, comment, photos, created_at")
      .single();

    if (error) {
      console.error("Insert review error:", error);
      throw new Error(`No se pudo guardar la reseña: ${error.message}`);
    }
    return data;
  };

  return { submitReview };
};
