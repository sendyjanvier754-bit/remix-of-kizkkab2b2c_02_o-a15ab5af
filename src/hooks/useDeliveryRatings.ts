import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface DeliveryRating {
  id: string;
  order_delivery_id: string | null;
  order_id: string | null;
  order_type: string | null;
  customer_user_id: string;
  product_rating: number | null;
  product_comment: string | null;
  delivery_rating: number | null;
  delivery_comment: string | null;
  rated_at: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
}

export interface CreateRatingParams {
  orderDeliveryId?: string;
  orderId: string;
  orderType?: 'b2b' | 'b2c';
  productRating?: number;
  productComment?: string;
  deliveryRating?: number;
  deliveryComment?: string;
  isAnonymous?: boolean;
}

export interface RatingStats {
  avgProductRating: number;
  avgDeliveryRating: number;
  totalRatings: number;
  ratingDistribution: { rating: number; count: number }[];
}

/**
 * Hook para gestión de calificaciones de entregas
 */
export const useDeliveryRatings = (orderId?: string) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rating, setRating] = useState<DeliveryRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRating = async () => {
    if (!orderId || !user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('*')
        .eq('order_id', orderId)
        .eq('customer_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setRating(data);
    } catch (error: any) {
      console.error('Error fetching rating:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitRating = async (params: CreateRatingParams): Promise<boolean> => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe iniciar sesión para calificar',
      });
      return false;
    }

    try {
      setIsSubmitting(true);

      // Check if rating already exists
      const { data: existing } = await supabase
        .from('delivery_ratings')
        .select('id')
        .eq('order_id', params.orderId)
        .eq('customer_user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing rating
        const { error } = await supabase
          .from('delivery_ratings')
          .update({
            product_rating: params.productRating,
            product_comment: params.productComment,
            delivery_rating: params.deliveryRating,
            delivery_comment: params.deliveryComment,
            is_anonymous: params.isAnonymous ?? false,
            rated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new rating
        const { error } = await supabase
          .from('delivery_ratings')
          .insert({
            order_delivery_id: params.orderDeliveryId || null,
            order_id: params.orderId,
            order_type: params.orderType || 'b2c',
            customer_user_id: user.id,
            product_rating: params.productRating,
            product_comment: params.productComment,
            delivery_rating: params.deliveryRating,
            delivery_comment: params.deliveryComment,
            is_anonymous: params.isAnonymous ?? false,
            rated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: '⭐ ¡Gracias por tu calificación!',
        description: 'Tu opinión nos ayuda a mejorar',
      });

      await fetchRating();
      return true;
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar la calificación',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchRating();
  }, [orderId, user?.id]);

  return {
    rating,
    isLoading,
    isSubmitting,
    submitRating,
    refetch: fetchRating,
    hasRated: !!rating,
  };
};

/**
 * Hook para obtener estadísticas de calificaciones
 */
export const useRatingStats = (storeId?: string) => {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
      // Get all ratings (optionally filtered by store)
      let query = supabase
        .from('delivery_ratings')
        .select('product_rating, delivery_rating');

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        setStats({
          avgProductRating: 0,
          avgDeliveryRating: 0,
          totalRatings: 0,
          ratingDistribution: [],
        });
        return;
      }

      // Calculate stats
      const productRatings = data.filter(r => r.product_rating != null).map(r => r.product_rating!);
      const deliveryRatings = data.filter(r => r.delivery_rating != null).map(r => r.delivery_rating!);

      const avgProductRating = productRatings.length > 0
        ? productRatings.reduce((a, b) => a + b, 0) / productRatings.length
        : 0;

      const avgDeliveryRating = deliveryRatings.length > 0
        ? deliveryRatings.reduce((a, b) => a + b, 0) / deliveryRatings.length
        : 0;

      // Distribution for product ratings
      const distribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: productRatings.filter(r => r === rating).length,
      }));

      setStats({
        avgProductRating: Math.round(avgProductRating * 10) / 10,
        avgDeliveryRating: Math.round(avgDeliveryRating * 10) / 10,
        totalRatings: data.length,
        ratingDistribution: distribution,
      });
    } catch (error: any) {
      console.error('Error fetching rating stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [storeId]);

  return { stats, isLoading, refetch: fetchStats };
};
