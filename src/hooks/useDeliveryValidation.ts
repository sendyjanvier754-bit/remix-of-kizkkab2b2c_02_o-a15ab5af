import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DeliveryValidationResult {
  success: boolean;
  message: string;
  delivery_id?: string;
  hybrid_tracking_id?: string;
  order_id?: string;
  pickup_point_name?: string;
  escrow_release_at?: string;
}

export interface DeliverySecurityCodes {
  customer_qr_code: string;
  security_pin: string;
  hybrid_tracking_id?: string;
}

/**
 * Hook para validación de entregas con seguridad dual
 * - Flujo Triple Ciego para couriers externos
 * - Flujo con PIN físico para puntos de entrega oficiales
 */
export const useDeliveryValidation = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DeliveryValidationResult | null>(null);

  /**
   * Validar entrega para courier externo (Flujo Triple Ciego)
   * Escanea QR del cliente -> Ingresa PIN del manifiesto -> Revela tracking híbrido
   */
  const validateCourierDelivery = async (
    qrCode: string,
    securityPin: string
  ): Promise<DeliveryValidationResult> => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const { data, error } = await (supabase.rpc as any)('validate_courier_delivery', {
        p_qr_code: qrCode.toUpperCase(),
        p_security_pin: securityPin
      });

      if (error) throw error;

      const result = data?.[0] || { success: false, message: 'Sin respuesta del servidor' };
      
      setValidationResult(result);

      if (result.success) {
        toast({
          title: '✅ Validación exitosa',
          description: `Tracking: ${result.hybrid_tracking_id}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Validación fallida',
          description: result.message,
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error validating courier delivery:', error);
      const result = { success: false, message: error.message || 'Error de validación' };
      setValidationResult(result);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
      return result;
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Confirmar entrega en punto de recogida oficial
   * Escanea QR del cliente -> Ingresa PIN de la caja física -> Confirma entrega
   */
  const confirmPickupPointDelivery = async (
    qrCode: string,
    physicalPin: string
  ): Promise<DeliveryValidationResult> => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Debe iniciar sesión para confirmar entregas');
      }

      const { data, error } = await (supabase.rpc as any)('confirm_pickup_point_delivery', {
        p_qr_code: qrCode.toUpperCase(),
        p_physical_pin: physicalPin,
        p_operator_id: user.id
      });

      if (error) throw error;

      const result = data?.[0] || { success: false, message: 'Sin respuesta del servidor' };
      
      setValidationResult(result);

      if (result.success) {
        toast({
          title: '📦 Entrega confirmada',
          description: `Fondos se liberarán: ${new Date(result.escrow_release_at).toLocaleString()}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Confirmación fallida',
          description: result.message,
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error confirming pickup delivery:', error);
      const result = { success: false, message: error.message || 'Error de confirmación' };
      setValidationResult(result);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
      return result;
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Obtener códigos de seguridad de una entrega
   */
  const getDeliverySecurityCodes = async (
    orderId: string
  ): Promise<DeliverySecurityCodes | null> => {
    try {
      const { data, error } = await supabase
        .from('order_deliveries')
        .select(`
          customer_qr_code,
          security_pin,
          order_id
        `)
        .eq('order_id', orderId)
        .single();

      if (error) throw error;

      // Get hybrid tracking ID
      const { data: tracking } = await supabase
        .from('shipment_tracking')
        .select('hybrid_tracking_id')
        .eq('order_id', orderId)
        .single();

      return {
        customer_qr_code: data.customer_qr_code,
        security_pin: data.security_pin,
        hybrid_tracking_id: tracking?.hybrid_tracking_id
      };
    } catch (error: any) {
      console.error('Error getting security codes:', error);
      return null;
    }
  };

  /**
   * Crear una entrega con asignación automática de punto
   */
  const createDeliveryWithAssignment = async (
    orderId: string,
    orderType: 'b2b' | 'b2c' = 'b2c',
    deliveryMethod: 'pickup_point' | 'courier' = 'pickup_point',
    customerCommuneId?: string,
    preferredPickupPointId?: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await (supabase.rpc as any)('create_order_delivery_with_assignment', {
        p_order_id: orderId,
        p_order_type: orderType,
        p_delivery_method: deliveryMethod,
        p_customer_commune_id: customerCommuneId || null,
        p_preferred_pickup_point_id: preferredPickupPointId || null
      });

      if (error) throw error;

      toast({
        title: 'Entrega creada',
        description: 'Se asignó punto de recogida automáticamente',
      });

      return data as string;
    } catch (error: any) {
      console.error('Error creating delivery:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear la entrega',
      });
      return null;
    }
  };

  const clearResult = () => setValidationResult(null);

  return {
    isValidating,
    validationResult,
    validateCourierDelivery,
    confirmPickupPointDelivery,
    getDeliverySecurityCodes,
    createDeliveryWithAssignment,
    clearResult,
  };
};
