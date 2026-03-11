import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  is_anonymous: boolean;
  helpful_count: number;
  images: string[];
  created_at: string;
  updated_at: string;
  parent_review_id: string | null;
  // Joined data
  user_name?: string;
  user_avatar?: string;
  user_email?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>; // rating -> count
}

export const useProductReviews = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async (): Promise<ProductReview[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from("product_reviews")
        .select(`
          *,
          profile:profiles!product_reviews_user_id_fkey(full_name, avatar_url)
        `)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) {
        // If the join fails due to missing FK, fetch without join
        if (error.code === "PGRST200") {
          const { data: reviewsOnly, error: err2 } = await supabase
            .from("product_reviews")
            .select("*")
            .eq("product_id", productId)
            .order("created_at", { ascending: false });

      if (err2) throw err2;

          return (reviewsOnly || []).map((r: any) => ({
            ...r,
            images: Array.isArray(r.images) ? (r.images as string[]) : [],
            user_name: r.is_anonymous ? "Usuario Anónimo" : "Usuario",
            user_avatar: undefined,
          })) as ProductReview[];
        }
        throw error;
      }

      return (data || []).map((r: any) => ({
        ...r,
        images: Array.isArray(r.images) ? (r.images as string[]) : [],
        user_name: r.is_anonymous
          ? "Usuario Anónimo"
          : r.profile?.full_name || "Usuario",
        user_avatar: r.is_anonymous ? undefined : r.profile?.avatar_url,
      }));
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};

export const useReviewStats = (productId: string | undefined) => {
  const { data: reviews } = useProductReviews(productId);

  const stats: ReviewStats = {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  if (reviews && reviews.length > 0) {
    stats.totalReviews = reviews.length;
    let sum = 0;
    reviews.forEach((r) => {
      sum += r.rating;
      stats.distribution[r.rating] = (stats.distribution[r.rating] || 0) + 1;
    });
    stats.averageRating = sum / reviews.length;
  }

  return stats;
};

export const useAddReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (review: {
      product_id: string;
      rating: number;
      title?: string;
      comment?: string;
      is_anonymous?: boolean;
      parent_review_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión para dejar una reseña");

      const { data, error } = await supabase
        .from("product_reviews")
        .insert({
          product_id: review.product_id,
          user_id: user.id,
          rating: review.rating || null,
          title: review.title || null,
          comment: review.comment || null,
          is_anonymous: review.is_anonymous || false,
          parent_review_id: review.parent_review_id || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ya has dejado una reseña para este producto");
        }
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", variables.product_id] });
      toast.success("Reseña publicada", { description: "Gracias por tu opinión" });
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message });
    },
  });
};

export const useDeleteReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, productId }: { reviewId: string; productId: string }) => {
      const { error } = await supabase
        .from("product_reviews")
        .delete()
        .eq("id", reviewId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
      toast.success("Reseña eliminada");
    },
    onError: () => {
      toast.error("Error al eliminar la reseña");
    },
  });
};
