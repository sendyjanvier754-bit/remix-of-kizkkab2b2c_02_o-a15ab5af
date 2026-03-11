/**
 * Siver Match Hook - B2B2C Ecosystem
 * Connects Investors with Gestors via Siver Market
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types
export type SiverMatchRole = 'investor' | 'gestor';
export type StockLotStatus = 'draft' | 'published' | 'assigned' | 'in_transit' | 'in_hub' | 'active' | 'depleted' | 'cancelled';
export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'cancelled';
export type MatchSaleStatus = 'pending_payment' | 'payment_confirmed' | 'ready_pickup' | 'picked_up' | 'delivered' | 'cancelled';

export interface SiverMatchProfile {
  id: string;
  user_id: string;
  role: SiverMatchRole;
  department_id?: string;
  commune_id?: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  total_sales_count: number;
  total_sales_amount: number;
  average_rating: number;
  total_reviews: number;
  max_pending_orders: number;
  current_pending_orders: number;
  is_verified: boolean;
  is_active: boolean;
  badges: string[];
  created_at: string;
  // Joined data
  department?: { name: string; code: string };
  commune?: { name: string; code: string };
}

export interface StockLot {
  id: string;
  investor_id: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  product_image?: string;
  sku?: string;
  color?: string;
  size?: string;
  total_quantity: number;
  available_quantity: number;
  sold_quantity: number;
  cost_per_unit: number;
  suggested_price: number;
  min_price?: number;
  gestor_commission_per_unit: number;
  china_tracking_number?: string;
  internal_tracking_id?: string;
  status: StockLotStatus;
  logistics_stage: string;
  arrived_at_hub_at?: string;
  notes?: string;
  created_at: string;
  // Joined (partial)
  investor?: Partial<SiverMatchProfile>;
}

export interface Assignment {
  id: string;
  stock_lot_id: string;
  gestor_id: string;
  investor_id: string;
  quantity_assigned: number;
  quantity_sold: number;
  quantity_available: number;
  initiated_by: SiverMatchRole;
  status: AssignmentStatus;
  requested_at: string;
  accepted_at?: string;
  gestor_notes?: string;
  investor_notes?: string;
  // Joined (partial)
  stock_lot?: Partial<StockLot>;
  gestor?: Partial<SiverMatchProfile>;
  investor?: Partial<SiverMatchProfile>;
}

export interface MatchSale {
  id: string;
  sale_number: string;
  assignment_id: string;
  stock_lot_id: string;
  gestor_id: string;
  investor_id: string;
  customer_user_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  department_id?: string;
  commune_id?: string;
  delivery_address?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  investor_amount: number;
  gestor_commission: number;
  siver_fee: number;
  payment_method?: string;
  payment_reference?: string;
  payment_status: string;
  payment_confirmed_at?: string;
  pickup_qr_code?: string;
  pickup_code?: string;
  status: MatchSaleStatus;
  picked_up_at?: string;
  delivered_at?: string;
  hybrid_tracking_id?: string;
  created_at: string;
  // Joined (partial)
  assignment?: Partial<Assignment>;
  gestor?: Partial<SiverMatchProfile>;
  investor?: Partial<SiverMatchProfile>;
  department?: { name: string };
  commune?: { name: string };
}

export interface MatchReview {
  id: string;
  sale_id: string;
  reviewer_profile_id: string;
  reviewed_profile_id: string;
  reviewer_role: SiverMatchRole;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  role?: SiverMatchRole;
  min_sales?: number;
  min_rating?: number;
  min_reviews?: number;
  color: string;
}

// Hook
export const useSiverMatch = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ========== PROFILES ==========

  // Get current user's profiles (can be both investor and gestor)
  const useMyProfiles = () => {
    return useQuery({
      queryKey: ['siver-match-my-profiles', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        
        const { data, error } = await supabase
          .from('siver_match_profiles')
          .select(`
            *,
            department:departments(name, code),
            commune:communes(name, code)
          `)
          .eq('user_id', user.id);
        
        if (error) throw error;
        return data as unknown as SiverMatchProfile[];
      },
      enabled: !!user?.id,
    });
  };

  // Get profile by role
  const useMyProfileByRole = (role: SiverMatchRole) => {
    return useQuery({
      queryKey: ['siver-match-profile', user?.id, role],
      queryFn: async () => {
        if (!user?.id) return null;
        
        const { data, error } = await supabase
          .from('siver_match_profiles')
          .select(`
            *,
            department:departments(name, code),
            commune:communes(name, code)
          `)
          .eq('user_id', user.id)
          .eq('role', role)
          .maybeSingle();
        
        if (error) throw error;
        return data as unknown as SiverMatchProfile | null;
      },
      enabled: !!user?.id,
    });
  };

  // Get public gestors (for investors to browse)
  const usePublicGestors = (departmentId?: string) => {
    return useQuery({
      queryKey: ['siver-match-gestors', departmentId],
      queryFn: async () => {
        let query = supabase
          .from('siver_match_profiles')
          .select(`
            *,
            department:departments(name, code),
            commune:communes(name, code)
          `)
          .eq('role', 'gestor')
          .eq('is_active', true)
          .order('average_rating', { ascending: false });
        
        if (departmentId) {
          query = query.eq('department_id', departmentId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data as unknown as SiverMatchProfile[];
      },
    });
  };

  // Create profile
  const createProfile = useMutation({
    mutationFn: async (profile: {
      role: SiverMatchRole;
      display_name: string;
      bio?: string;
      phone?: string;
      department_id?: string;
      commune_id?: string;
    }) => {
      if (!user?.id) throw new Error('No autenticado');
      
      const { data, error } = await supabase
        .from('siver_match_profiles')
        .insert({
          user_id: user.id,
          ...profile,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-my-profiles'] });
      toast.success('Perfil creado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear perfil', { description: error.message });
    },
  });

  // ========== STOCK LOTS ==========

  // Get my stock lots (as investor)
  const useMyStockLots = () => {
    const { data: investorProfile } = useMyProfileByRole('investor');
    
    return useQuery({
      queryKey: ['siver-match-my-lots', investorProfile?.id],
      queryFn: async () => {
        if (!investorProfile?.id) return [];
        
        const { data, error } = await supabase
          .from('siver_match_stock_lots')
          .select('*')
          .eq('investor_id', investorProfile.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as StockLot[];
      },
      enabled: !!investorProfile?.id,
    });
  };

  // Get available stock lots (for gestors to browse)
  const useAvailableStockLots = () => {
    return useQuery({
      queryKey: ['siver-match-available-lots'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('siver_match_stock_lots')
          .select(`
            *,
            investor:siver_match_profiles!siver_match_stock_lots_investor_id_fkey(
              id, display_name, avatar_url, average_rating, total_reviews
            )
          `)
          .in('status', ['published', 'in_hub', 'active'])
          .gt('available_quantity', 0)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as StockLot[];
      },
    });
  };

  // Create stock lot
  const createStockLot = useMutation({
    mutationFn: async (lot: {
      product_id?: string;
      variant_id?: string;
      product_name: string;
      product_image?: string;
      sku?: string;
      color?: string;
      size?: string;
      total_quantity: number;
      cost_per_unit: number;
      suggested_price: number;
      min_price?: number;
      gestor_commission_per_unit: number;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from('siver_match_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .eq('role', 'investor')
        .single();
      
      if (!profile) throw new Error('No tienes perfil de inversor');
      
      const { data, error } = await supabase
        .from('siver_match_stock_lots')
        .insert({
          investor_id: profile.id,
          available_quantity: lot.total_quantity,
          status: 'draft',
          ...lot,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-my-lots'] });
      toast.success('Lote creado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear lote', { description: error.message });
    },
  });

  // Publish stock lot
  const publishStockLot = useMutation({
    mutationFn: async (lotId: string) => {
      const { error } = await supabase
        .from('siver_match_stock_lots')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', lotId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-my-lots'] });
      queryClient.invalidateQueries({ queryKey: ['siver-match-available-lots'] });
      toast.success('Lote publicado');
    },
  });

  // Update lot tracking
  const updateLotTracking = useMutation({
    mutationFn: async ({ lotId, chinaTracking, logisticsStage }: {
      lotId: string;
      chinaTracking?: string;
      logisticsStage?: string;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (chinaTracking) updates.china_tracking_number = chinaTracking;
      if (logisticsStage) updates.logistics_stage = logisticsStage;
      if (logisticsStage === 'in_hub') updates.arrived_at_hub_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('siver_match_stock_lots')
        .update(updates)
        .eq('id', lotId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-my-lots'] });
      toast.success('Tracking actualizado');
    },
  });

  // ========== ASSIGNMENTS ==========

  // Get my assignments (as gestor or investor)
  const useMyAssignments = (role: SiverMatchRole) => {
    const { data: profile } = useMyProfileByRole(role);
    
    return useQuery({
      queryKey: ['siver-match-assignments', profile?.id, role],
      queryFn: async () => {
        if (!profile?.id) return [];
        
        const column = role === 'gestor' ? 'gestor_id' : 'investor_id';
        
        const { data, error } = await supabase
          .from('siver_match_assignments')
          .select(`
            *,
            stock_lot:siver_match_stock_lots(*),
            gestor:siver_match_profiles!siver_match_assignments_gestor_id_fkey(
              id, display_name, avatar_url, average_rating, phone
            ),
            investor:siver_match_profiles!siver_match_assignments_investor_id_fkey(
              id, display_name, avatar_url, average_rating
            )
          `)
          .eq(column, profile.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as Assignment[];
      },
      enabled: !!profile?.id,
    });
  };

  // Request assignment (gestor requests to sell investor's stock)
  const requestAssignment = useMutation({
    mutationFn: async ({ stockLotId, quantity, notes }: {
      stockLotId: string;
      quantity: number;
      notes?: string;
    }) => {
      const { data: gestorProfile } = await supabase
        .from('siver_match_profiles')
        .select('id, current_pending_orders, max_pending_orders')
        .eq('user_id', user?.id)
        .eq('role', 'gestor')
        .single();
      
      if (!gestorProfile) throw new Error('No tienes perfil de gestor');
      
      // Check capacity
      if (gestorProfile.current_pending_orders >= gestorProfile.max_pending_orders) {
        throw new Error('Has alcanzado tu límite de órdenes pendientes');
      }
      
      // Get stock lot
      const { data: lot } = await supabase
        .from('siver_match_stock_lots')
        .select('investor_id, available_quantity')
        .eq('id', stockLotId)
        .single();
      
      if (!lot) throw new Error('Lote no encontrado');
      if (quantity > lot.available_quantity) {
        throw new Error('Cantidad solicitada excede disponibilidad');
      }
      
      const { data, error } = await supabase
        .from('siver_match_assignments')
        .insert({
          stock_lot_id: stockLotId,
          gestor_id: gestorProfile.id,
          investor_id: lot.investor_id,
          quantity_assigned: quantity,
          quantity_available: quantity,
          initiated_by: 'gestor',
          gestor_notes: notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-assignments'] });
      toast.success('Solicitud enviada al inversor');
    },
    onError: (error: any) => {
      toast.error('Error', { description: error.message });
    },
  });

  // Accept/Reject assignment
  const respondToAssignment = useMutation({
    mutationFn: async ({ assignmentId, accept, notes }: {
      assignmentId: string;
      accept: boolean;
      notes?: string;
    }) => {
      const updates: any = {
        status: accept ? 'accepted' : 'rejected',
        updated_at: new Date().toISOString(),
      };
      
      if (accept) {
        updates.accepted_at = new Date().toISOString();
      }
      if (notes) {
        updates.investor_notes = notes;
      }
      
      const { error } = await supabase
        .from('siver_match_assignments')
        .update(updates)
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      // If accepted, update gestor pending count
      if (accept) {
        const { data: assignment } = await supabase
          .from('siver_match_assignments')
          .select('gestor_id')
          .eq('id', assignmentId)
          .single();
        
        // Update pending orders count - increment by 1
        if (assignment) {
          const { data: profile } = await supabase
            .from('siver_match_profiles')
            .select('current_pending_orders')
            .eq('id', assignment.gestor_id)
            .single();
          
          if (profile) {
            await supabase
              .from('siver_match_profiles')
              .update({ current_pending_orders: (profile.current_pending_orders || 0) + 1 })
              .eq('id', assignment.gestor_id);
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-assignments'] });
      toast.success(variables.accept ? 'Asignación aceptada' : 'Asignación rechazada');
    },
  });

  // ========== SALES ==========

  // Get my sales (as gestor)
  const useMySales = () => {
    const { data: gestorProfile } = useMyProfileByRole('gestor');
    
    return useQuery({
      queryKey: ['siver-match-sales', gestorProfile?.id],
      queryFn: async () => {
        if (!gestorProfile?.id) return [];
        
        const { data, error } = await supabase
          .from('siver_match_sales')
          .select(`
            *,
            department:departments(name),
            commune:communes(name)
          `)
          .eq('gestor_id', gestorProfile.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as MatchSale[];
      },
      enabled: !!gestorProfile?.id,
    });
  };

  // Get investor's sales (products sold by gestors)
  const useInvestorSales = () => {
    const { data: investorProfile } = useMyProfileByRole('investor');
    
    return useQuery({
      queryKey: ['siver-match-investor-sales', investorProfile?.id],
      queryFn: async () => {
        if (!investorProfile?.id) return [];
        
        const { data, error } = await supabase
          .from('siver_match_sales')
          .select(`
            *,
            gestor:siver_match_profiles!siver_match_sales_gestor_id_fkey(
              id, display_name, avatar_url, phone
            ),
            department:departments(name),
            commune:communes(name)
          `)
          .eq('investor_id', investorProfile.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as MatchSale[];
      },
      enabled: !!investorProfile?.id,
    });
  };

  // Create sale (gestor sells to customer)
  const createSale = useMutation({
    mutationFn: async (sale: {
      assignment_id: string;
      customer_name: string;
      customer_phone?: string;
      customer_email?: string;
      department_id?: string;
      commune_id?: string;
      delivery_address?: string;
      quantity: number;
      unit_price: number;
    }) => {
      // Get assignment details
      const { data: assignment } = await supabase
        .from('siver_match_assignments')
        .select(`
          *,
          stock_lot:siver_match_stock_lots(*)
        `)
        .eq('id', sale.assignment_id)
        .single();
      
      if (!assignment) throw new Error('Asignación no encontrada');
      if (sale.quantity > assignment.quantity_available) {
        throw new Error('Cantidad excede disponibilidad');
      }
      
      const stockLot = assignment.stock_lot as StockLot;
      
      // Calculate financial split
      const totalAmount = sale.quantity * sale.unit_price;
      const investorCost = sale.quantity * stockLot.cost_per_unit;
      const gestorCommission = sale.quantity * stockLot.gestor_commission_per_unit;
      const siverFee = totalAmount * 0.05; // 5% platform fee
      const investorAmount = totalAmount - gestorCommission - siverFee;
      
      // Generate sale number
      const { data: saleNumber } = await supabase.rpc('generate_match_sale_number');
      
      // Generate pickup code
      const { data: pickupCode } = await supabase.rpc('generate_pickup_code');
      
      const { data, error } = await supabase
        .from('siver_match_sales')
        .insert({
          sale_number: saleNumber,
          assignment_id: sale.assignment_id,
          stock_lot_id: assignment.stock_lot_id,
          gestor_id: assignment.gestor_id,
          investor_id: assignment.investor_id,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone,
          customer_email: sale.customer_email,
          customer_user_id: user?.id,
          department_id: sale.department_id,
          commune_id: sale.commune_id,
          delivery_address: sale.delivery_address,
          quantity: sale.quantity,
          unit_price: sale.unit_price,
          total_amount: totalAmount,
          investor_amount: investorAmount,
          gestor_commission: gestorCommission,
          siver_fee: siverFee,
          pickup_code: pickupCode,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update assignment quantities
      await supabase
        .from('siver_match_assignments')
        .update({
          quantity_sold: assignment.quantity_sold + sale.quantity,
          quantity_available: assignment.quantity_available - sale.quantity,
        })
        .eq('id', sale.assignment_id);
      
      // Update stock lot quantities
      await supabase
        .from('siver_match_stock_lots')
        .update({
          sold_quantity: stockLot.sold_quantity + sale.quantity,
          available_quantity: stockLot.available_quantity - sale.quantity,
        })
        .eq('id', assignment.stock_lot_id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      queryClient.invalidateQueries({ queryKey: ['siver-match-assignments'] });
      toast.success('Venta registrada');
    },
    onError: (error: any) => {
      toast.error('Error al crear venta', { description: error.message });
    },
  });

  // Confirm payment (admin action)
  const confirmPayment = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('siver_match_sales')
        .update({
          payment_status: 'confirmed',
          payment_confirmed_at: new Date().toISOString(),
          status: 'payment_confirmed',
          pickup_qr_code: `SIVER-PICKUP-${saleId}`,
          pickup_qr_generated_at: new Date().toISOString(),
        })
        .eq('id', saleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      toast.success('Pago confirmado - QR generado');
    },
  });

  // Confirm pickup (hub staff scans QR)
  const confirmPickup = useMutation({
    mutationFn: async ({ saleId, pickupCode }: { saleId: string; pickupCode: string }) => {
      // Verify pickup code
      const { data: sale } = await supabase
        .from('siver_match_sales')
        .select('pickup_code, payment_status')
        .eq('id', saleId)
        .single();
      
      if (!sale) throw new Error('Venta no encontrada');
      if (sale.payment_status !== 'confirmed') {
        throw new Error('El pago no ha sido confirmado. No se puede entregar.');
      }
      if (sale.pickup_code !== pickupCode) {
        throw new Error('Código de recogida inválido');
      }
      
      const { error } = await supabase
        .from('siver_match_sales')
        .update({
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
          picked_up_by: user?.id,
        })
        .eq('id', saleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      toast.success('Recogida confirmada');
    },
    onError: (error: any) => {
      toast.error('Error', { description: error.message });
    },
  });

  // Confirm delivery (triggers wallet split)
  const confirmDelivery = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('siver_match_sales')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', saleId);
      
      if (error) throw error;
      
      // Trigger wallet split
      await supabase.rpc('process_siver_match_wallet_split', { p_sale_id: saleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-sales'] });
      toast.success('Entrega confirmada - Fondos distribuidos');
    },
  });

  // ========== REVIEWS ==========

  // Check if review is pending
  const usePendingReviews = () => {
    return useQuery({
      queryKey: ['siver-match-pending-reviews', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        
        // Get my profiles
        const { data: profiles } = await supabase
          .from('siver_match_profiles')
          .select('id, role')
          .eq('user_id', user.id);
        
        if (!profiles?.length) return [];
        
        const profileIds = profiles.map(p => p.id);
        
        // Get delivered sales where I haven't reviewed yet
        const { data: sales } = await supabase
          .from('siver_match_sales')
          .select(`
            id, sale_number, gestor_id, investor_id, delivered_at,
            gestor:siver_match_profiles!siver_match_sales_gestor_id_fkey(display_name),
            investor:siver_match_profiles!siver_match_sales_investor_id_fkey(display_name)
          `)
          .eq('status', 'delivered')
          .or(`gestor_id.in.(${profileIds.join(',')}),investor_id.in.(${profileIds.join(',')})`);
        
        if (!sales?.length) return [];
        
        // Check which sales don't have my review
        const pending = [];
        for (const sale of sales) {
          const { data: existingReview } = await supabase
            .from('siver_match_reviews')
            .select('id')
            .eq('sale_id', sale.id)
            .in('reviewer_profile_id', profileIds)
            .maybeSingle();
          
          if (!existingReview) {
            pending.push(sale);
          }
        }
        
        return pending;
      },
      enabled: !!user?.id,
    });
  };

  // Submit review
  const submitReview = useMutation({
    mutationFn: async ({ saleId, rating, comment }: {
      saleId: string;
      rating: number;
      comment?: string;
    }) => {
      // Get sale and determine who I'm reviewing
      const { data: sale } = await supabase
        .from('siver_match_sales')
        .select('gestor_id, investor_id')
        .eq('id', saleId)
        .single();
      
      if (!sale) throw new Error('Venta no encontrada');
      
      // Get my profile
      const { data: profiles } = await supabase
        .from('siver_match_profiles')
        .select('id, role')
        .eq('user_id', user?.id);
      
      if (!profiles?.length) throw new Error('No tienes perfil');
      
      // Determine reviewer and reviewed
      let reviewerProfile = profiles[0];
      let reviewedId: string;
      
      if (profiles.some(p => p.id === sale.gestor_id)) {
        // I'm the gestor, reviewing investor
        reviewerProfile = profiles.find(p => p.id === sale.gestor_id)!;
        reviewedId = sale.investor_id;
      } else {
        // I'm the investor, reviewing gestor
        reviewerProfile = profiles.find(p => p.id === sale.investor_id)!;
        reviewedId = sale.gestor_id;
      }
      
      const { data, error } = await supabase
        .from('siver_match_reviews')
        .insert({
          sale_id: saleId,
          reviewer_profile_id: reviewerProfile.id,
          reviewed_profile_id: reviewedId,
          reviewer_role: reviewerProfile.role as SiverMatchRole,
          rating,
          comment,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siver-match-pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['siver-match'] });
      toast.success('Calificación enviada');
    },
    onError: (error: any) => {
      toast.error('Error', { description: error.message });
    },
  });

  // ========== BADGES ==========

  const useBadges = () => {
    return useQuery({
      queryKey: ['siver-match-badges'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('siver_match_badges')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        
        if (error) throw error;
        return data as Badge[];
      },
    });
  };

  return {
    // Profiles
    useMyProfiles,
    useMyProfileByRole,
    usePublicGestors,
    createProfile,
    
    // Stock Lots
    useMyStockLots,
    useAvailableStockLots,
    createStockLot,
    publishStockLot,
    updateLotTracking,
    
    // Assignments
    useMyAssignments,
    requestAssignment,
    respondToAssignment,
    
    // Sales
    useMySales,
    useInvestorSales,
    createSale,
    confirmPayment,
    confirmPickup,
    confirmDelivery,
    
    // Reviews
    usePendingReviews,
    submitReview,
    
    // Badges
    useBadges,
  };
};

export default useSiverMatch;
