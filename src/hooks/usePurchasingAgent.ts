/**
 * Hook for Purchasing Agent Portal
 * Manages agent assignments, purchases, QC, and shipments
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface PurchasingAgent {
  id: string;
  user_id: string;
  agent_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string;
  country_name: string | null;
  warehouse_address: Record<string, any> | null;
  status: 'active' | 'inactive' | 'suspended';
  specializations: string[];
  max_concurrent_pos: number;
  current_active_pos: number;
  avg_dispatch_hours: number;
  total_pos_completed: number;
  total_items_processed: number;
  quality_score: number;
  created_at: string;
}

export interface POAssignment {
  id: string;
  po_id: string;
  agent_id: string;
  assigned_at: string;
  assignment_type: 'auto' | 'manual';
  status: 'assigned' | 'in_progress' | 'completed' | 'rejected';
  started_at: string | null;
  completed_at: string | null;
  dispatch_hours: number | null;
  po?: {
    id: string;
    po_number: string;
    status: string;
    market_id: string;
    total_orders: number;
    total_quantity: number;
    total_amount: number;
  };
}

export interface POPurchase {
  id: string;
  po_id: string;
  agent_id: string;
  purchase_number: string;
  source_platform: '1688' | 'alibaba' | 'taobao' | 'other';
  supplier_order_id: string | null;
  supplier_link: string | null;
  payment_link: string | null;
  expected_cost_usd: number;
  actual_cost_usd: number;
  cart_screencast_url: string | null;
  cart_validated: boolean;
  payment_status: 'pending' | 'awaiting_validation' | 'paid' | 'rejected';
  status: string;
  items_count: number;
  items?: POPurchaseItem[];
}

export interface POPurchaseItem {
  id: string;
  purchase_id: string;
  order_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  nombre: string;
  quantity: number;
  unit_price_cny: number | null;
  unit_price_usd: number | null;
  expected_unit_cost_usd: number | null;
  total_price_usd: number | null;
  qc_status: 'pending' | 'received' | 'approved' | 'rejected';
  qc_photos: string[];
  qc_videos: string[];
  qc_notes: string | null;
  rejection_reason: string | null;
  requires_rebuy: boolean;
  hybrid_tracking_id: string | null;
}

export interface POShipment {
  id: string;
  po_id: string;
  agent_id: string;
  shipment_number: string;
  actual_weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  volumetric_weight_kg: number;
  billable_weight_kg: number;
  scale_photo_url: string | null;
  dimensions_photo_url: string | null;
  package_photos: string[];
  expected_shipping_cost_usd: number | null;
  actual_shipping_cost_usd: number | null;
  freight_payment_link: string | null;
  freight_payment_status: 'pending' | 'awaiting_validation' | 'paid' | 'rejected';
  international_tracking: string | null;
  carrier_name: string | null;
  status: string;
}

export interface POReconciliation {
  id: string;
  po_id: string;
  items_requested: number;
  items_purchased: number;
  items_received: number;
  items_qc_approved: number;
  items_qc_rejected: number;
  items_pending_rebuy: number;
  purchase_completion_percent: number;
  qc_approval_percent: number;
  reconciliation_percent: number;
  total_expected_product_cost_usd: number;
  total_actual_product_cost_usd: number;
  total_expected_shipping_cost_usd: number;
  total_actual_shipping_cost_usd: number;
  total_variance_usd: number;
  is_fully_reconciled: boolean;
  can_generate_shipment: boolean;
}

export function usePurchasingAgent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get current agent profile
  const useAgentProfile = () => useQuery({
    queryKey: ['purchasing-agent-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('purchasing_agents')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as PurchasingAgent | null;
    },
    enabled: !!user?.id,
  });

  // Get agent assignments
  const useAgentAssignments = (agentId: string | null) => useQuery({
    queryKey: ['agent-assignments', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('po_agent_assignments')
        .select(`
          *,
          po:master_purchase_orders(id, po_number, status, market_id, total_orders, total_quantity, total_amount)
        `)
        .eq('agent_id', agentId)
        .in('status', ['assigned', 'in_progress'])
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as POAssignment[];
    },
    enabled: !!agentId,
    refetchInterval: 30000,
  });

  // Get purchases for a PO
  const usePOPurchases = (poId: string | null) => useQuery({
    queryKey: ['po-purchases', poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data, error } = await supabase
        .from('po_purchases')
        .select(`
          *,
          items:po_purchase_items(*)
        `)
        .eq('po_id', poId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as POPurchase[];
    },
    enabled: !!poId,
  });

  // Get reconciliation for a PO
  const usePOReconciliation = (poId: string | null) => useQuery({
    queryKey: ['po-reconciliation', poId],
    queryFn: async () => {
      if (!poId) return null;
      const { data, error } = await supabase
        .from('po_reconciliation')
        .select('*')
        .eq('po_id', poId)
        .maybeSingle();
      if (error) throw error;
      return data as POReconciliation | null;
    },
    enabled: !!poId,
  });

  // Get shipments for a PO
  const usePOShipments = (poId: string | null) => useQuery({
    queryKey: ['po-shipments', poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data, error } = await supabase
        .from('po_shipments')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as POShipment[];
    },
    enabled: !!poId,
  });

  // Start working on an assignment
  const startAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('po_agent_assignments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] });
      toast.success('Asignación iniciada');
    },
    onError: () => toast.error('Error al iniciar asignación'),
  });

  // Create a new purchase for a PO
  const createPurchase = useMutation({
    mutationFn: async ({
      poId,
      agentId,
      sourcePlatform,
    }: {
      poId: string;
      agentId: string;
      sourcePlatform: '1688' | 'alibaba' | 'taobao' | 'other';
    }) => {
      // Get current purchase count to generate number
      const { count } = await supabase
        .from('po_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('po_id', poId);
      
      const purchaseNumber = `P${(count || 0) + 1}`;
      
      // Get PO number for full purchase number
      const { data: po } = await supabase
        .from('master_purchase_orders')
        .select('po_number')
        .eq('id', poId)
        .single();
      
      const fullPurchaseNumber = `${po?.po_number || 'PO'}-${purchaseNumber}`;
      
      const { data, error } = await supabase
        .from('po_purchases')
        .insert({
          po_id: poId,
          agent_id: agentId,
          purchase_number: fullPurchaseNumber,
          source_platform: sourcePlatform,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-purchases'] });
      toast.success('Compra creada');
    },
    onError: () => toast.error('Error al crear compra'),
  });

  // Update purchase with cart video and link
  const updatePurchaseCart = useMutation({
    mutationFn: async ({
      purchaseId,
      cartScreencastUrl,
      paymentLink,
      actualCostUsd,
    }: {
      purchaseId: string;
      cartScreencastUrl: string;
      paymentLink: string;
      actualCostUsd: number;
    }) => {
      const { error } = await supabase
        .from('po_purchases')
        .update({
          cart_screencast_url: cartScreencastUrl,
          cart_screencast_uploaded_at: new Date().toISOString(),
          payment_link: paymentLink,
          actual_cost_usd: actualCostUsd,
          status: 'cart_submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-purchases'] });
      toast.success('Carrito enviado para validación');
    },
    onError: () => toast.error('Error al enviar carrito'),
  });

  // Update purchase item QC
  const updateItemQC = useMutation({
    mutationFn: async ({
      itemId,
      qcStatus,
      qcPhotos,
      qcVideos,
      qcNotes,
      rejectionReason,
    }: {
      itemId: string;
      qcStatus: 'received' | 'approved' | 'rejected';
      qcPhotos?: string[];
      qcVideos?: string[];
      qcNotes?: string;
      rejectionReason?: string;
    }) => {
      const updateData: Record<string, any> = {
        qc_status: qcStatus,
        qc_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (qcPhotos) updateData.qc_photos = qcPhotos;
      if (qcVideos) updateData.qc_videos = qcVideos;
      if (qcNotes) updateData.qc_notes = qcNotes;
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
        updateData.requires_rebuy = true;
      }
      
      const { error } = await supabase
        .from('po_purchase_items')
        .update(updateData)
        .eq('id', itemId);
      if (error) throw error;
      
      // Update reconciliation
      const { data: item } = await supabase
        .from('po_purchase_items')
        .select('purchase_id')
        .eq('id', itemId)
        .single();
      
      if (item) {
        const { data: purchase } = await supabase
          .from('po_purchases')
          .select('po_id')
          .eq('id', item.purchase_id)
          .single();
        
        if (purchase) {
          await supabase.rpc('update_po_reconciliation', { p_po_id: purchase.po_id });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['po-reconciliation'] });
      toast.success('QC actualizado');
    },
    onError: () => toast.error('Error al actualizar QC'),
  });

  // Create shipment
  const createShipment = useMutation({
    mutationFn: async ({
      poId,
      agentId,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      scalePhotoUrl,
      dimensionsPhotoUrl,
    }: {
      poId: string;
      agentId: string;
      weightKg: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
      scalePhotoUrl: string;
      dimensionsPhotoUrl: string;
    }) => {
      // Get PO number for shipment number
      const { data: po } = await supabase
        .from('master_purchase_orders')
        .select('po_number')
        .eq('id', poId)
        .single();
      
      const volumetricWeight = (lengthCm * widthCm * heightCm) / 5000;
      const billableWeight = Math.max(weightKg, volumetricWeight);
      
      const { data, error } = await supabase
        .from('po_shipments')
        .insert({
          po_id: poId,
          agent_id: agentId,
          shipment_number: `${po?.po_number || 'SHP'}-SHIP-001`,
          actual_weight_kg: weightKg,
          length_cm: lengthCm,
          width_cm: widthCm,
          height_cm: heightCm,
          volumetric_weight_kg: volumetricWeight,
          billable_weight_kg: billableWeight,
          scale_photo_url: scalePhotoUrl,
          dimensions_photo_url: dimensionsPhotoUrl,
          status: 'preparing',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-shipments'] });
      toast.success('Envío creado');
    },
    onError: () => toast.error('Error al crear envío'),
  });

  // Update shipment freight
  const updateShipmentFreight = useMutation({
    mutationFn: async ({
      shipmentId,
      freightPaymentLink,
      actualShippingCostUsd,
    }: {
      shipmentId: string;
      freightPaymentLink: string;
      actualShippingCostUsd: number;
    }) => {
      const { error } = await supabase
        .from('po_shipments')
        .update({
          freight_payment_link: freightPaymentLink,
          actual_shipping_cost_usd: actualShippingCostUsd,
          freight_payment_status: 'awaiting_validation',
          status: 'freight_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-shipments'] });
      toast.success('Flete enviado para validación');
    },
    onError: () => toast.error('Error al enviar flete'),
  });

  // Upload tracking (only after freight is paid)
  const uploadTracking = useMutation({
    mutationFn: async ({
      shipmentId,
      internationalTracking,
      carrierName,
    }: {
      shipmentId: string;
      internationalTracking: string;
      carrierName: string;
    }) => {
      const { error } = await supabase
        .from('po_shipments')
        .update({
          international_tracking: internationalTracking,
          tracking_uploaded_at: new Date().toISOString(),
          carrier_name: carrierName,
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-shipments'] });
      toast.success('Tracking cargado');
    },
    onError: () => toast.error('Error al cargar tracking'),
  });

  // Upload file to storage
  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('agent-media')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('agent-media')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  return {
    useAgentProfile,
    useAgentAssignments,
    usePOPurchases,
    usePOReconciliation,
    usePOShipments,
    startAssignment,
    createPurchase,
    updatePurchaseCart,
    updateItemQC,
    createShipment,
    updateShipmentFreight,
    uploadTracking,
    uploadFile,
  };
}

// Admin hook for managing agents and validations
export function usePurchasingAgentAdmin() {
  const queryClient = useQueryClient();

  // Get all agents
  const useAllAgents = () => useQuery({
    queryKey: ['all-purchasing-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchasing_agents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PurchasingAgent[];
    },
  });

  // Get all unassigned POs
  const useUnassignedPOs = () => useQuery({
    queryKey: ['unassigned-pos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_purchase_orders')
        .select('*')
        .eq('status', 'closed')
        .is('assigned_agent_id', null)
        .order('closed_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Get pending validations
  const usePendingValidations = () => useQuery({
    queryKey: ['pending-validations'],
    queryFn: async () => {
      // Cart validations
      const { data: cartValidations } = await supabase
        .from('po_purchases')
        .select(`
          *,
          agent:purchasing_agents(id, full_name, agent_code),
          po:master_purchase_orders(id, po_number)
        `)
        .eq('status', 'cart_submitted')
        .eq('cart_validated', false);

      // Payment validations
      const { data: paymentValidations } = await supabase
        .from('po_purchases')
        .select(`
          *,
          agent:purchasing_agents(id, full_name, agent_code),
          po:master_purchase_orders(id, po_number)
        `)
        .eq('payment_status', 'awaiting_validation');

      // Freight validations
      const { data: freightValidations } = await supabase
        .from('po_shipments')
        .select(`
          *,
          agent:purchasing_agents(id, full_name, agent_code),
          po:master_purchase_orders(id, po_number)
        `)
        .eq('freight_payment_status', 'awaiting_validation');

      return {
        cartValidations: cartValidations || [],
        paymentValidations: paymentValidations || [],
        freightValidations: freightValidations || [],
      };
    },
    refetchInterval: 30000,
  });

  // Auto-assign PO to agent
  const autoAssignPO = useMutation({
    mutationFn: async (poId: string) => {
      const { data, error } = await supabase.rpc('auto_assign_po_to_agent', {
        p_po_id: poId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-pos'] });
      queryClient.invalidateQueries({ queryKey: ['all-purchasing-agents'] });
      if (data?.success) {
        toast.success(`PO asignada a ${data.agent_name}`);
      } else {
        toast.error(data?.error || 'Error al asignar');
      }
    },
    onError: () => toast.error('Error al asignar PO'),
  });

  // Validate cart
  const validateCart = useMutation({
    mutationFn: async ({
      purchaseId,
      approved,
      notes,
    }: {
      purchaseId: string;
      approved: boolean;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('po_purchases')
        .update({
          cart_validated: approved,
          cart_validated_at: new Date().toISOString(),
          status: approved ? 'payment_pending' : 'draft',
          notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['po-purchases'] });
      toast.success('Carrito validado');
    },
    onError: () => toast.error('Error al validar carrito'),
  });

  // Validate payment
  const validatePayment = useMutation({
    mutationFn: async ({
      purchaseId,
      approved,
    }: {
      purchaseId: string;
      approved: boolean;
    }) => {
      const { error } = await supabase
        .from('po_purchases')
        .update({
          payment_status: approved ? 'paid' : 'rejected',
          payment_validated_at: new Date().toISOString(),
          status: approved ? 'paid' : 'payment_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['po-purchases'] });
      toast.success('Pago validado');
    },
    onError: () => toast.error('Error al validar pago'),
  });

  // Validate freight
  const validateFreight = useMutation({
    mutationFn: async ({
      shipmentId,
      approved,
    }: {
      shipmentId: string;
      approved: boolean;
    }) => {
      const { error } = await supabase
        .from('po_shipments')
        .update({
          freight_payment_status: approved ? 'paid' : 'rejected',
          freight_validated_at: new Date().toISOString(),
          status: approved ? 'ready_to_ship' : 'freight_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] });
      queryClient.invalidateQueries({ queryKey: ['po-shipments'] });
      toast.success('Flete validado');
    },
    onError: () => toast.error('Error al validar flete'),
  });

  // Create new agent
  const createAgent = useMutation({
    mutationFn: async (agent: Partial<PurchasingAgent> & { user_id: string; full_name: string }) => {
      const agentCode = `AGT-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from('purchasing_agents')
        .insert({
          ...agent,
          agent_code: agentCode,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchasing-agents'] });
      toast.success('Agente creado');
    },
    onError: () => toast.error('Error al crear agente'),
  });

  return {
    useAllAgents,
    useUnassignedPOs,
    usePendingValidations,
    autoAssignPO,
    validateCart,
    validatePayment,
    validateFreight,
    createAgent,
  };
}
