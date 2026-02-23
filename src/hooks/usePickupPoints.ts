import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string | null;
  commune_id: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  manager_user_id: string | null;
  is_active: boolean | null;
  operating_hours: Json;
  metadata: Json;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrderDelivery {
  id: string;
  order_id: string;
  order_type: string;
  pickup_point_id: string | null;
  delivery_code: string;
  qr_code_data: string | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  escrow_release_at: string | null;
  funds_released: boolean;
  funds_released_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const usePickupPoints = () => {
  const { toast } = useToast();
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPickupPoints = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .order('name');

      if (error) throw error;
      setPickupPoints(data || []);
    } catch (error: any) {
      console.error('Error fetching pickup points:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createPickupPoint = async (point: {
    name: string;
    address: string;
    city: string;
    country?: string;
    phone?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('pickup_points')
        .insert(point);

      if (error) throw error;

      toast({
        title: 'Punto de recogida creado',
      });

      await fetchPickupPoints();
      return true;
    } catch (error: any) {
      console.error('Error creating pickup point:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el punto de recogida',
      });
      return false;
    }
  };

  const updatePickupPoint = async (id: string, updates: Partial<PickupPoint>) => {
    try {
      const { error } = await supabase
        .from('pickup_points')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Punto actualizado',
      });

      await fetchPickupPoints();
      return true;
    } catch (error: any) {
      console.error('Error updating pickup point:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPickupPoints();
  }, []);

  return {
    pickupPoints,
    isLoading,
    createPickupPoint,
    updatePickupPoint,
    refetch: fetchPickupPoints,
  };
};

/**
 * Fetches active pickup points for a given commune (or all active if no communeId).
 * Uses TanStack Query for caching.
 */
export const usePickupPointsByCommune = (communeId?: string) => {
  return useQuery({
    queryKey: ['pickup-points', 'by-commune', communeId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('pickup_points')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (communeId) {
        query = query.eq('commune_id', communeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PickupPoint[];
    },
  });
};

// Hook for staff to manage deliveries at their pickup point
export const useDeliveryScanner = (pickupPointId?: string) => {
  const { toast } = useToast();
  const [pendingDeliveries, setPendingDeliveries] = useState<OrderDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingDeliveries = async () => {
    if (!pickupPointId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('order_deliveries')
        .select('*')
        .eq('pickup_point_id', pickupPointId)
        .in('status', ['pending', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPendingDeliveries(data || []);
    } catch (error: any) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const findDeliveryByCode = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('order_deliveries')
        .select('*')
        .eq('delivery_code', code.toUpperCase())
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error finding delivery:', error);
      return null;
    }
  };

  const confirmDelivery = async (deliveryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get platform settings for escrow hours
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'escrow_release_hours')
        .single();

      const escrowHours = settings?.value || 48;
      const releaseAt = new Date();
      releaseAt.setHours(releaseAt.getHours() + escrowHours);

      const { error } = await supabase
        .from('order_deliveries')
        .update({
          status: 'picked_up',
          confirmed_by: user?.id,
          confirmed_at: new Date().toISOString(),
          escrow_release_at: releaseAt.toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;

      toast({
        title: 'Entrega confirmada',
        description: `Fondos se liberarán en ${escrowHours}h`,
      });

      await fetchPendingDeliveries();
      return true;
    } catch (error: any) {
      console.error('Error confirming delivery:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo confirmar la entrega',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPendingDeliveries();
  }, [pickupPointId]);

  return {
    pendingDeliveries,
    isLoading,
    findDeliveryByCode,
    confirmDelivery,
    refetch: fetchPendingDeliveries,
  };
};
