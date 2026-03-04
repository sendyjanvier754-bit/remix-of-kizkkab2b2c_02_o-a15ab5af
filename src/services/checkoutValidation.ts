/**
 * Checkout validation utilities
 * Provides functions to validate checkout form data
 */

export interface CheckoutValidationError {
  field: string;
  message: string;
}

export interface B2CCheckoutData {
  items: Array<{ id: string; quantity: number }>;
  selectedAddress: string | null;
  deliveryMethod: 'address' | 'pickup';
  selectedPickupPoint: string | null;
  paymentMethod: 'stripe' | 'moncash' | 'natcash' | 'transfer';
  paymentReference?: string;
}

export interface B2BCheckoutData {
  items: Array<{ id: string; quantity: number }>;
  selectedAddress: string | null;
  deliveryMethod: 'address' | 'pickup';
  selectedPickupPoint: string | null;
  paymentMethod: 'stripe' | 'moncash' | 'natcash' | 'transfer';
  paymentReference?: string;
}

/**
 * Validate B2C checkout form
 */
export const validateB2CCheckout = (data: B2CCheckoutData): CheckoutValidationError[] => {
  const errors: CheckoutValidationError[] = [];

  // Check cart items
  if (!data.items || data.items.length === 0) {
    errors.push({
      field: 'items',
      message: 'Tu carrito está vacío',
    });
  }

  // Check delivery method
  if (!data.deliveryMethod) {
    errors.push({
      field: 'deliveryMethod',
      message: 'Selecciona un método de entrega',
    });
  }

  // Check address for address delivery
  if (data.deliveryMethod === 'address' && !data.selectedAddress) {
    errors.push({
      field: 'selectedAddress',
      message: 'Selecciona una dirección de entrega',
    });
  }

  // Check pickup point for pickup delivery
  if (data.deliveryMethod === 'pickup' && !data.selectedPickupPoint) {
    errors.push({
      field: 'selectedPickupPoint',
      message: 'Selecciona un punto de recogida',
    });
  }

  // Check payment method
  if (!data.paymentMethod) {
    errors.push({
      field: 'paymentMethod',
      message: 'Selecciona un método de pago',
    });
  }

  // Payment reference is no longer required — sellers upload a proof (comprobante) from Mis Compras

  return errors;
};

/**
 * Validate B2B checkout form
 */
export const validateB2BCheckout = (data: B2BCheckoutData): CheckoutValidationError[] => {
  const errors: CheckoutValidationError[] = [];

  // Check cart items
  if (!data.items || data.items.length === 0) {
    errors.push({
      field: 'items',
      message: 'Tu pedido está vacío',
    });
  }

  // Check delivery method
  if (!data.deliveryMethod) {
    errors.push({
      field: 'deliveryMethod',
      message: 'Selecciona un método de entrega',
    });
  }

  // Check address for address delivery
  if (data.deliveryMethod === 'address' && !data.selectedAddress) {
    errors.push({
      field: 'selectedAddress',
      message: 'Selecciona una dirección de entrega',
    });
  }

  // Check pickup point for pickup delivery
  if (data.deliveryMethod === 'pickup' && !data.selectedPickupPoint) {
    errors.push({
      field: 'selectedPickupPoint',
      message: 'Selecciona un punto de recogida',
    });
  }

  // Check payment method
  if (!data.paymentMethod) {
    errors.push({
      field: 'paymentMethod',
      message: 'Selecciona un método de pago',
    });
  }

  // Payment reference is no longer required — sellers upload a proof (comprobante) from Mis Compras

  return errors;
};

/**
 * Get error message for a specific field
 */
export const getFieldError = (errors: CheckoutValidationError[], field: string): string | undefined => {
  return errors.find(e => e.field === field)?.message;
};

/**
 * Check if there are any errors for a specific field
 */
export const hasFieldError = (errors: CheckoutValidationError[], field: string): boolean => {
  return errors.some(e => e.field === field);
};
