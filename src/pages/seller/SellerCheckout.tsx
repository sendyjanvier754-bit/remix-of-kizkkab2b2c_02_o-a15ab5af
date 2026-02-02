import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useB2BCartItems } from '@/hooks/useB2BCartItems';
import { useCartSelectionStore } from '@/stores/useCartSelectionStore';
import { useKYC } from '@/hooks/useKYC';
import { useSellerCredits } from '@/hooks/useSellerCredits';
import { useAddresses, Address } from '@/hooks/useAddresses';
import { usePickupPoints } from '@/hooks/usePickupPoints';
import { useCompleteB2BCart } from '@/hooks/useBuyerOrders';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngine';
import { validateB2BCheckout, getFieldError, hasFieldError, type CheckoutValidationError } from '@/services/checkoutValidation';
import { useApplyDiscount, AppliedDiscount } from '@/hooks/useApplyDiscount';
import { useAdminPaymentMethods } from '@/hooks/usePaymentMethods';
import { useB2BPricingEngineV2 } from '@/hooks/useB2BPricingEngineV2';
import { SellerLayout } from '@/components/seller/SellerLayout';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { B2BShippingSelector } from '@/components/checkout/B2BShippingSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Smartphone,
  Building2,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Copy,
  Wallet,
  Info,
  MapPin,
  Plus,
  ChevronDown,
  ChevronUp,
  Truck,
  Store,
  Tag,
  X,
  User,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'stripe' | 'moncash' | 'transfer';
type DeliveryMethod = 'address' | 'pickup';

const SellerCheckout = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { items: allItems, isLoading: cartLoading } = useB2BCartItems();
  const { b2bSelectedIds } = useCartSelectionStore();
  
  // Filter only selected items for checkout
  const items = useMemo(() => 
    allItems.filter(item => b2bSelectedIds.has(item.id)), 
    [allItems, b2bSelectedIds]
  );
  const { isVerified } = useKYC();
  const { credit, availableCredit, hasActiveCredit, calculateMaxCreditForCart } = useSellerCredits();
  const { addresses, isLoading: addressesLoading, createAddress } = useAddresses();
  const { pickupPoints, isLoading: pickupPointsLoading } = usePickupPoints();
  const completeCart = useCompleteB2BCart();
  const { methods: adminPaymentMethods, isLoading: paymentMethodsLoading } = useAdminPaymentMethods();
  
  // Get admin payment details from database
  const adminBankMethod = adminPaymentMethods.find(m => m.method_type === 'bank');
  const adminMoncashMethod = adminPaymentMethods.find(m => m.method_type === 'moncash');
  
  // Discount code hook
  const { 
    isValidating: isValidatingDiscount, 
    appliedDiscount, 
    applyDiscount, 
    removeDiscount,
    recordDiscountUse,
    checkCustomerDiscount,
    setAppliedDiscount 
  } = useApplyDiscount();

  // B2B Pricing Engine for shipping options
  const pricingEngine = useB2BPricingEngineV2();

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('address');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [useSiverCredit, setUseSiverCredit] = useState(false);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<CheckoutValidationError[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [expandedPickupId, setExpandedPickupId] = useState<string | null>(null);
  
  // B2B Shipping tier selection
  const [selectedTier, setSelectedTier] = useState<'standard' | 'express'>('standard');
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [loadingShipping, setLoadingShipping] = useState(false);
  
  // Calcular totales desde items de BD
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.cantidad, 0);
  const discountAmount = appliedDiscount?.discountAmount || 0;
  
  // Check for customer-specific discounts on mount
  useEffect(() => {
    const checkDiscount = async () => {
      if (user && subtotal > 0 && !appliedDiscount) {
        const customerDiscount = await checkCustomerDiscount(subtotal);
        if (customerDiscount) {
          setAppliedDiscount(customerDiscount);
        }
      }
    };
    checkDiscount();
  }, [user, subtotal]);

  const handleApplyDiscountCode = async () => {
    if (!discountCode.trim()) return;
    await applyDiscount(discountCode.trim(), subtotal);
    setDiscountCode('');
  };
  
  // Create order from BD cart
  const createOrder = async (
    paymentMethod: 'stripe' | 'moncash' | 'transfer',
    shippingAddress?: {
      id: string;
      full_name: string;
      phone?: string;
      street_address: string;
      city: string;
      state?: string;
      postal_code?: string;
      country: string;
      notes?: string;
    },
    deliveryMethod?: DeliveryMethod,
    pickupPointId?: string
  ) => {
    if (!user?.id || items.length === 0) {
      toast.error('Carrito vacío o usuario no autenticado');
      return null;
    }

    try {
      // Create metadata object
      const metadata: Record<string, any> = {};
      
      // Mark this as a B2B order
      metadata.order_type = 'b2b';
      
      if (shippingAddress) {
        metadata.shipping_address = shippingAddress;
      }

      if (deliveryMethod) {
        metadata.delivery_method = deliveryMethod;
      }

      if (pickupPointId) {
        metadata.pickup_point_id = pickupPointId;
      }

      // Create order with shipping address and delivery info in metadata
      const orderSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const orderTotalQuantity = items.reduce((sum, item) => sum + item.cantidad, 0);
      
      // Determine payment_status based on payment method
      const paymentStatus = paymentMethod === 'stripe' 
        ? 'pending' 
        : 'pending_validation';
      
      const { data: order, error: orderError } = await supabase
        .from('orders_b2b')
        .insert({
          seller_id: user.id,
          buyer_id: user.id,
          total_amount: orderSubtotal,
          total_quantity: orderTotalQuantity,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          status: 'placed',
          currency: 'USD',
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items (only include columns that exist in order_items_b2b table)
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId || null,
        sku: item.sku,
        nombre: item.name,
        cantidad: item.cantidad,
        precio_unitario: item.precioB2B,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('order_items_b2b')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear pedido');
      return null;
    }
  };

  // Shipping address states
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Negocio',
    full_name: '',
    phone: '',
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Haití',
    notes: '',
    is_default: false,
  });
  
  // Separate state for department/commune selection (not saved to addresses table)
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedComm, setSelectedComm] = useState('');

  // Get logistics engine for departments/communes
  const logisticsEngine = useLogisticsEngine();
  
  // Get departments query
  const departmentsQuery = logisticsEngine.useDepartments();
  const departments = departmentsQuery.data || [];
  
  // Get communes based on selected department - always call the hook
  const communesQuery = logisticsEngine.useCommunes(selectedDept || undefined);
  const communes = communesQuery.data || [];

  // Set default address on load
  useState(() => {
    const defaultAddress = addresses.find(a => a.is_default);
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress.id);
    }
  });

  // Load shipping options when address is selected
  useEffect(() => {
    const loadShippingOptions = async () => {
      if (!selectedAddressId || deliveryMethod !== 'address') {
        console.log('🔍 No se carga selector:', { selectedAddressId, deliveryMethod });
        setShippingOptions([]);
        return;
      }

      console.log('🚀 Cargando opciones de envío para dirección:', selectedAddressId);
      setLoadingShipping(true);
      try {
        const response = await pricingEngine.getShippingOptions(selectedAddressId);
        console.log('📦 Respuesta de shipping options:', response);
        
        if (response && response.valid && response.options) {
          console.log('✅ Opciones cargadas:', response.options);
          setShippingOptions(response.options);
          // Si solo hay una opción, seleccionarla automáticamente
          if (response.options.length === 1) {
            setSelectedTier(response.options[0].tier_type as 'standard' | 'express');
          }
        } else {
          console.log('⚠️ Sin opciones o respuesta inválida:', response?.error);
          setShippingOptions([]);
        }
      } catch (error) {
        console.error('❌ Error loading shipping options:', error);
        setShippingOptions([]);
      } finally {
        setLoadingShipping(false);
      }
    };

    loadShippingOptions();
  }, [selectedAddressId, deliveryMethod]);

  // Calculate max credit for current cart (never 100% - max is what admin configured, typically less)
  const maxCreditAmount = calculateMaxCreditForCart(subtotal);
  const remainingToPay = subtotal - creditAmount - discountAmount;

  // Can use credit only if verified and has active credit
  const canUseCredit = isVerified && hasActiveCredit && maxCreditAmount > 0;

  // Payment method details (no siver_credit as standalone)
  const paymentMethods = [
    {
      id: 'stripe' as PaymentMethod,
      name: 'Tarjeta de Débito/Crédito',
      description: 'Visa, Mastercard, American Express',
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'moncash' as PaymentMethod,
      name: 'MonCash',
      description: 'Billetera digital haitiana',
      icon: Smartphone,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      id: 'transfer' as PaymentMethod,
      name: 'Transferencia Bancaria',
      description: 'Transferencia directa a nuestra cuenta',
      icon: Building2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  // Bank details for transfer
  const bankDetails = {
    bank: 'Banco Nacional de Haití',
    account: '001-234567-89',
    beneficiary: 'Siver Market 509 SRL',
    swift: 'BNHAHTHX',
  };

  // MonCash details
  const moncashDetails = {
    number: '+509 3XXX XXXX',
    name: 'Siver Market 509',
  };

  const isLoading = authLoading || cartLoading || addressesLoading || pickupPointsLoading;

  // Get selected address
  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  // Handle saving new address
  const handleSaveNewAddress = async () => {
    if (!newAddress.full_name || !newAddress.street_address || !newAddress.city) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    
    try {
      const result = await createAddress.mutateAsync({
        ...newAddress,
        is_default: addresses.length === 0,
      });
      setSelectedAddressId(result.id);
      setShowNewAddressForm(false);
      setNewAddress({
        label: 'Negocio',
        full_name: '',
        phone: '',
        street_address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Haití',
        notes: '',
        is_default: false,
      });
      setSelectedDept('');
      setSelectedComm('');
    } catch (error) {
      console.error('Error creating address:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !orderPlaced) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container mx-auto px-4 pb-8">
            <div className="max-w-2xl mx-auto">
              <Card className="p-8 text-center">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-4">Carrito Vacío</h1>
                <p className="text-muted-foreground mb-8">
                  No tienes productos en tu carrito. Vuelve al catálogo para continuar comprando.
                </p>
                <Button asChild>
                  <Link to="/seller/adquisicion-lotes">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Catálogo
                  </Link>
                </Button>
              </Card>
            </div>
          </main>
          <Footer />
        </div>
      </SellerLayout>
    );
  }

  if (orderPlaced) {
    return (
      <SellerLayout>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container mx-auto px-4 pb-8">
            <div className="max-w-2xl mx-auto">
              <Card className="p-8 text-center">
                <div className="mb-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold mb-2">¡Pedido Confirmado!</h1>
                <p className="text-muted-foreground mb-4">
                  Tu pedido ha sido creado exitosamente.
                </p>
                {orderId && (
                  <div className="bg-muted p-4 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground">ID del Pedido</p>
                    <p className="font-mono font-bold">{orderId.slice(0, 8).toUpperCase()}</p>
                  </div>
                )}
                
                {paymentMethod !== 'stripe' && (
                  <div className="text-left bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-800">Pendiente de Verificación</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Tu pedido está pendiente de verificación de pago. 
                          Los productos serán agregados a tu catálogo una vez confirmado el pago.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild variant="outline">
                    <Link to="/seller/catalogo">Ver Mi Catálogo</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/seller/adquisicion-lotes">Continuar Comprando</Link>
                  </Button>
                </div>
              </Card>
            </div>
          </main>
          <Footer />
        </div>
      </SellerLayout>
    );
  }

  const handlePlaceOrder = async () => {
    // Validate form using centralized validation service
    const errors = validateB2BCheckout({
      items: items.map(item => ({ id: item.id, quantity: item.cantidad })),
      selectedAddress: deliveryMethod === 'address' ? selectedAddressId : null,
      deliveryMethod,
      selectedPickupPoint: deliveryMethod === 'pickup' ? selectedPickupPoint : null,
      paymentMethod,
      paymentReference,
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(errors[0].message);
      return;
    }

    // Clear validation errors if all checks pass
    setValidationErrors([]);

    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    // Validate that remaining amount is positive (credit can't cover 100%)
    if (useSiverCredit && creditAmount > 0 && remainingToPay <= 0) {
      toast.error('El crédito no puede cubrir el 100% del pedido');
      return;
    }

    setIsProcessing(true);

    try {
      // Create the order with the primary payment method and shipping address
      const order = await createOrder(paymentMethod, selectedAddress ? {
        id: selectedAddress.id,
        full_name: selectedAddress.full_name,
        phone: selectedAddress.phone || undefined,
        street_address: selectedAddress.street_address,
        city: selectedAddress.city,
        state: selectedAddress.state || undefined,
        postal_code: selectedAddress.postal_code || undefined,
        country: selectedAddress.country,
        notes: selectedAddress.notes || undefined,
      } : undefined, deliveryMethod, deliveryMethod === 'pickup' ? selectedPickupPoint : undefined);

      if (!order) {
        throw new Error('Error al crear el pedido');
      }

      setOrderId(order.id);

      // Handle Siver Credit as complement (if used)
      if (useSiverCredit && creditAmount > 0) {
        const { data: currentCredit } = await supabase
          .from('seller_credits')
          .select('balance_debt')
          .eq('user_id', user.id)
          .single();

        if (currentCredit) {
          const newDebt = Number(currentCredit.balance_debt) + creditAmount;
          
          // Update debt
          await supabase
            .from('seller_credits')
            .update({ balance_debt: newDebt })
            .eq('user_id', user.id);
          
          // Record movement
          await supabase
            .from('credit_movements')
            .insert({
              user_id: user.id,
              movement_type: 'purchase',
              amount: creditAmount,
              balance_before: currentCredit.balance_debt,
              balance_after: newDebt,
              reference_id: order.id,
              description: `Crédito aplicado - Pedido ${order.id.slice(0, 8).toUpperCase()} (Pago combinado)`,
            });
        }
      }

      // Handle payment completion based on method
      if (paymentMethod === 'stripe') {
        // For Stripe, mark order as paid (payment confirmed immediately)
        const { error: updateError } = await supabase
          .from('orders_b2b')
          .update({ 
            payment_status: 'paid',
            status: 'paid'
          })
          .eq('id', order.id);
        
        if (!updateError) {
          toast.success(useSiverCredit && creditAmount > 0 
            ? 'Pago procesado con crédito combinado' 
            : 'Pago procesado correctamente');
        }
      } else {
        // For MonCash/Transfer, order stays pending_validation until admin verifies and updates payment_status
        toast.success(useSiverCredit && creditAmount > 0
          ? 'Pedido creado con crédito aplicado. Pago restante pendiente de verificación.'
          : 'Pedido creado. Pendiente de verificación de pago.');
      }

      setOrderPlaced(true);
      
      // Clear the B2B cart by marking it as completed
      try {
        console.log('Clearing B2B cart for user:', user.id);
        // Get the seller's open cart
        const { data: carts } = await supabase
          .from('b2b_carts')
          .select('id')
          .eq('buyer_user_id', user.id)
          .eq('status', 'open')
          .limit(1);
        
        if (carts && carts.length > 0) {
          console.log('Marking B2B cart as completed:', carts[0].id);
          // This will automatically invalidate queries and clear cache
          await completeCart.mutateAsync(carts[0].id);
          console.log('B2B cart completion mutation finished');
        }
      } catch (cartError) {
        console.error('Error clearing B2B cart:', cartError);
        // Don't fail the order if cart clearing fails
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Error al procesar el pedido');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  return (
    <SellerLayout>
      <div className="min-h-screen bg-background">
        <Header />

        {/* Fixed Checkout Header */}
        <div className="fixed top-24 left-0 right-0 z-40 bg-white border-b border-border flex items-center">
          <div className="container mx-auto px-4 py-0 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="px-3 py-1.5 rounded-lg bg-[#071d7f]">
                <span className="text-sm font-semibold text-white">Checkout B2B</span>
              </div>
            </div>
            
            {/* Items Counter Badge */}
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
              <ShoppingBag className="h-4 w-4 text-[#071d7f]" />
              <span className="text-sm font-semibold text-[#071d7f]">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 pb-8 pt-14 space-y-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Buyer Info */}
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#071d7f]" />
                      <p className="font-semibold text-foreground">{user?.name || 'N/A'}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowAddressModal(true)}
                      className="text-[#071d7f] hover:bg-[#071d7f]/10"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#071d7f]" />
                      <p className="text-sm text-foreground">
                        {selectedAddress?.street_address || 'Selecciona una dirección'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Delivery Method Selection */}
              <Card className={`p-0 ${
                hasFieldError(validationErrors, 'deliveryMethod') || 
                hasFieldError(validationErrors, 'selectedAddress') || 
                hasFieldError(validationErrors, 'selectedPickupPoint') 
                  ? 'border-red-500 border-2' : ''
              }`}>
                <div className="bg-gray-200 px-4 py-3">
                  <h2 className="text-lg font-bold">
                    Opción de Entrega
                  </h2>
                </div>
                <div className="p-4">
                {/* Show validation warning for delivery method */}
                {(hasFieldError(validationErrors, 'deliveryMethod') || 
                  hasFieldError(validationErrors, 'selectedAddress') || 
                  hasFieldError(validationErrors, 'selectedPickupPoint')) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">
                      {getFieldError(validationErrors, 'deliveryMethod') || 
                       getFieldError(validationErrors, 'selectedAddress') || 
                       getFieldError(validationErrors, 'selectedPickupPoint')}
                    </p>
                  </div>
                )}
                
                <RadioGroup 
                  value={deliveryMethod} 
                  onValueChange={(value) => {
                    setDeliveryMethod(value as DeliveryMethod);
                    setSelectedAddressId(null);
                    setSelectedPickupPoint(null);
                  }}
                  className="space-y-2"
                >
                  {/* Address Delivery Option */}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deliveryMethod === 'address' && selectedAddressId
                        ? 'border-[#071d7f] bg-[#071d7f]/5'
                        : deliveryMethod === 'address' && !selectedAddressId
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => {
                      setDeliveryMethod('address');
                      setSelectedPickupPoint(null);
                      setTimeout(() => setShowAddressModal(true), 0);
                    }}
                  >
                    <RadioGroupItem value="address" id="delivery-address" />
                    <div className="flex items-center gap-2 flex-1">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold text-sm">Envío a Domicilio</p>
                    </div>
                    {deliveryMethod === 'address' && selectedAddress ? (
                      <p className="text-xs text-muted-foreground">{selectedAddress.full_name}</p>
                    ) : deliveryMethod === 'address' && !selectedAddressId ? (
                      <span className="text-xs text-orange-600 font-medium">Seleccionar</span>
                    ) : null}
                  </div>

                  {/* Pickup Point Option */}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      deliveryMethod === 'pickup' && selectedPickupPoint
                        ? 'border-[#071d7f] bg-[#071d7f]/5'
                        : deliveryMethod === 'pickup' && !selectedPickupPoint
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => {
                      setDeliveryMethod('pickup');
                      setSelectedAddressId(null);
                      setTimeout(() => setShowPickupModal(true), 0);
                    }}
                  >
                    <RadioGroupItem value="pickup" id="delivery-pickup" />
                    <div className="flex items-center gap-2 flex-1">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold text-sm">Retiro en Punto</p>
                    </div>
                    {deliveryMethod === 'pickup' && selectedPickupPoint && pickupPoints.find(p => p.id === selectedPickupPoint) ? (
                      <p className="text-xs text-muted-foreground">{pickupPoints.find(p => p.id === selectedPickupPoint)?.name}</p>
                    ) : deliveryMethod === 'pickup' && !selectedPickupPoint ? (
                      <span className="text-xs text-orange-600 font-medium">Seleccionar</span>
                    ) : null}
                  </div>
                </RadioGroup>
                </div>
              </Card>

              {/* B2B Shipping Type Selector - Only for address delivery */}
              {deliveryMethod === 'address' && selectedAddressId && (
                <>
                  {shippingOptions.length > 0 ? (
                    <Card className="p-6">
                      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Tipo de Envío
                      </h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        Selecciona el tipo de envío para tu pedido
                      </p>
                      <B2BShippingSelector
                        options={shippingOptions}
                        selectedTier={selectedTier}
                        onTierChange={setSelectedTier}
                        hasOversizeProducts={false}
                        loading={loadingShipping}
                      />
                    </Card>
                  ) : loadingShipping ? (
                    <Card className="p-6">
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="text-muted-foreground">Cargando opciones de envío...</p>
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-6 bg-orange-50 dark:bg-orange-950/20 border-orange-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                            Sin opciones de envío configuradas
                          </h3>
                          <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                            No hay tipos de envío (Standard/Express) disponibles para esta dirección.
                          </p>
                          <p className="text-xs text-orange-700 dark:text-orange-300">
                            <strong>Para solucionar:</strong> El administrador debe configurar rutas y tipos de envío en 
                            <code className="mx-1 px-1 py-0.5 bg-orange-100 dark:bg-orange-900 rounded">/admin/logistica/rutas</code>
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* Products Section - Max 4 visible with scroll */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-3">
                  Productos ({items.length})
                </h2>
                <div className={`space-y-3 ${items.length > 4 ? 'max-h-[340px] overflow-y-auto pr-2' : ''}`}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 pb-4 border-b last:border-b-0"
                    >
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold line-clamp-1">{item.name}</p>
                        {/* Variant badges */}
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {item.color && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                              {item.color}
                            </span>
                          )}
                          {item.size && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                              {item.size}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Cant: {item.cantidad}</span>
                          <span className="font-semibold text-primary">
                            ${item.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Payment Method */}
              <Card className={`p-6 ${hasFieldError(validationErrors, 'paymentMethod') ? 'border-red-500' : ''}`}>
                <h2 className="text-xl font-bold mb-3">Forma de pago</h2>

                {hasFieldError(validationErrors, 'paymentMethod') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{getFieldError(validationErrors, 'paymentMethod')}</p>
                  </div>
                )}
                
                {!isVerified && (
                  <Alert className="mb-3 border-purple-300 bg-purple-50 dark:bg-purple-950/30">
                    <Info className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-purple-700 dark:text-purple-300">
                      <span className="font-semibold">¿Quieres pagar con crédito?</span>{' '}
                      <Link to="/seller/cuenta" className="underline">Verifica tu identidad</Link> para acceder al Crédito Siver.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;

                    return (
                      <div
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#071d7f] bg-[#071d7f]/5'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${method.bgColor}`}>
                          <Icon className={`h-4 w-4 ${method.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{method.name}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            isSelected
                              ? 'border-[#071d7f] bg-[#071d7f]'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-full w-full text-primary-foreground p-0.5" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Siver Credit Section - Always visible for verified users */}
                {canUseCredit && (
                  <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-purple-600" />
                        Complementar con Crédito Siver
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          Opcional
                        </Badge>
                      </h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSiverCredit}
                          onChange={(e) => {
                            setUseSiverCredit(e.target.checked);
                            if (!e.target.checked) setCreditAmount(0);
                          }}
                          className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm">Usar crédito</span>
                      </label>
                    </div>
                    
                    {useSiverCredit && (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Crédito disponible:</span>
                            <span className="font-medium">${availableCredit.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-4">
                            <span className="text-muted-foreground">Máximo para este pedido ({credit?.max_cart_percentage}%):</span>
                            <span className="font-medium">${maxCreditAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">Monto de crédito a usar: ${creditAmount.toFixed(2)}</Label>
                          <Slider
                            value={[creditAmount]}
                            onValueChange={(values) => setCreditAmount(values[0])}
                            max={maxCreditAmount}
                            step={1}
                            className="mt-2"
                          />
                        </div>

                        {creditAmount > 0 && (
                          <div className="pt-3 border-t border-purple-200">
                            <div className="flex justify-between text-sm">
                              <span>Total del pedido:</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-purple-600">
                              <span>Crédito Siver aplicado:</span>
                              <span>-${creditAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold mt-2 pt-2 border-t text-primary">
                              <span>A pagar con {paymentMethods.find(m => m.id === paymentMethod)?.name}:</span>
                              <span>${remainingToPay.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              El crédito usado se agregará a tu deuda. El resto debe pagarse con el método seleccionado.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!useSiverCredit && (
                      <p className="text-sm text-muted-foreground">
                        Activa esta opción para usar parte de tu crédito disponible (${availableCredit.toFixed(2)}) y reducir el monto a pagar.
                      </p>
                    )}
                  </div>
                )}

                {/* Payment Instructions */}
                {paymentMethod === 'transfer' && adminBankMethod && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-3">Datos para Transferencia</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Banco:</span>
                        <span className="font-medium">{adminBankMethod.bank_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cuenta:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{adminBankMethod.account_number}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(adminBankMethod.account_number || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Beneficiario:</span>
                        <span className="font-medium">{adminBankMethod.account_holder}</span>
                      </div>
                      {adminBankMethod.bank_swift && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">SWIFT:</span>
                          <span className="font-mono font-medium">{adminBankMethod.bank_swift}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {paymentMethod === 'moncash' && adminMoncashMethod && (
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(148, 17, 31, 0.1)' }}>
                    <h3 className="font-semibold mb-3" style={{ color: '#94111f' }}>Datos MonCash</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Número:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{adminMoncashMethod.phone_number}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(adminMoncashMethod.phone_number || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Nombre:</span>
                        <span className="font-medium">{adminMoncashMethod.holder_name}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Reference (for non-Stripe methods) */}
                {paymentMethod !== 'stripe' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <Label htmlFor="payment-reference">
                        Referencia de Pago *
                      </Label>
                      <Input
                        id="payment-reference"
                        placeholder="Ej: Número de transacción o confirmación"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className={`mt-1 ${hasFieldError(validationErrors, 'paymentReference') ? 'border-red-500' : ''}`}
                      />
                      {hasFieldError(validationErrors, 'paymentReference') && (
                        <p className="text-sm text-red-600 mt-1">{getFieldError(validationErrors, 'paymentReference')}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="payment-notes">Notas (opcional)</Label>
                      <Textarea
                        id="payment-notes"
                        placeholder="Información adicional sobre el pago"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-8">
                <h3 className="text-lg font-bold mb-3">Resumen del Pedido</h3>

                {/* Items List with Images - Max 2 visible with scroll */}
                <div className="space-y-2 max-h-[140px] overflow-y-auto mb-3 pb-3 border-b pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 pb-3 border-b last:border-b-0">
                      <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                        {/* Variant badges instead of SKU */}
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {item.color && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                              {item.color}
                            </span>
                          )}
                          {item.size && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                              {item.size}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">Cant: {item.cantidad}</span>
                          <span className="text-sm font-semibold">${item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 mb-4 pb-4 border-b">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Unidades:</span>
                    <span className="font-semibold text-foreground">
                      {totalQuantity}
                    </span>
                  </div>
                  
                  {/* Discount Code Section */}
                  <div className="pt-3">
                    {appliedDiscount ? (
                      <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-800">
                              {appliedDiscount.code || 'Descuento Cliente'}
                            </p>
                            <p className="text-xs text-green-600">
                              {appliedDiscount.discountType === 'percentage' 
                                ? `${appliedDiscount.discountValue}% de descuento`
                                : `$${appliedDiscount.discountValue.toFixed(2)} de descuento`
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeDiscount}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Código de descuento</Label>
                        <div className="flex gap-2">
                          <Input
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                            placeholder="Ingresa código"
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleApplyDiscountCode}
                            disabled={isValidatingDiscount || !discountCode.trim()}
                          >
                            {isValidatingDiscount ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Aplicar'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Applied discounts */}
                {appliedDiscount && (
                  <div className="space-y-2 mb-4 pb-4 border-b">
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuento:</span>
                      <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {useSiverCredit && creditAmount > 0 && (
                  <div className="space-y-2 mb-4 pb-4 border-b">
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Crédito Siver:</span>
                      <span className="font-medium">-${creditAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-xl font-bold mb-4">
                  <span>Total a Pagar:</span>
                  <span className="text-primary">
                    ${remainingToPay.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={
                    isProcessing || 
                    items.length === 0 ||
                    (deliveryMethod === 'address' && !selectedAddressId) ||
                    (deliveryMethod === 'pickup' && !selectedPickupPoint)
                  }
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Confirmar Pedido'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Al confirmar, aceptas los términos de servicio
                </p>

                {useSiverCredit && creditAmount > 0 && (
                  <Badge variant="outline" className="w-full justify-center mt-4 border-purple-300 text-purple-600">
                    Pago combinado con crédito
                  </Badge>
                )}

                {paymentMethod !== 'stripe' && (
                  <Badge variant="outline" className="w-full justify-center mt-4">
                    Verificación manual requerida
                  </Badge>
                )}
              </Card>
            </div>
          </div>
        </main>

        <Footer />

        {/* Address Modal - Fixed for mobile keyboard */}
        <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto border-2 border-gray-300 pb-8">
            <DialogHeader className="border-b-2 pb-3 -mx-6 px-6 border-gray-300 sticky top-0 bg-background z-10">
              <DialogTitle className="text-lg font-bold">
                {showNewAddressForm ? 'Agregar Nueva Dirección' : 'Seleccionar Dirección'}
              </DialogTitle>
            </DialogHeader>
            
            {!showNewAddressForm ? (
              <div className="space-y-3">
                <RadioGroup value={selectedAddressId || ''} onValueChange={(id) => {
                  setSelectedAddressId(id);
                  setShowAddressModal(false);
                }} className="space-y-3">
                  {addresses.length > 0 ? (
                    addresses.map((address) => (
                      <div
                        key={address.id}
                        className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                          selectedAddressId === address.id
                            ? 'border-[#071d7f] bg-[#071d7f]/5'
                            : 'border-border hover:border-[#071d7f]'
                        }`}
                      >
                        <div
                          className="p-4 flex items-center justify-between gap-3"
                          onClick={() => {
                            setSelectedAddressId(address.id);
                            setShowAddressModal(false);
                          }}
                        >
                          <RadioGroupItem 
                            value={address.id} 
                            id={`address-${address.id}`}
                            className="mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{address.full_name}</p>
                              {address.is_default && (
                                <Badge variant="secondary" className="text-xs">Predeterminada</Badge>
                              )}
                              <Badge variant="outline" className="text-xs">{address.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{address.street_address}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAddressId(expandedAddressId === address.id ? null : address.id);
                            }}
                            className="p-2 hover:bg-muted rounded-lg flex-shrink-0"
                          >
                            {expandedAddressId === address.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {expandedAddressId === address.id && (
                          <div className="border-t p-4 bg-muted/50 text-sm space-y-3">
                            <div className="space-y-1">
                              <p><span className="font-semibold">Calle:</span> {address.street_address}</p>
                              <p><span className="font-semibold">Ciudad:</span> {address.city}</p>
                              {address.state && <p><span className="font-semibold">Estado:</span> {address.state}</p>}
                              {address.postal_code && <p><span className="font-semibold">Código Postal:</span> {address.postal_code}</p>}
                              <p><span className="font-semibold">País:</span> {address.country}</p>
                              {address.phone && <p><span className="font-semibold">Teléfono:</span> {address.phone}</p>}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-[#071d7f]"
                              onClick={() => {
                                // Aquí iría la lógica para editar la dirección
                              }}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No hay direcciones guardadas</p>
                  )}
                </RadioGroup>
                <Button 
                  onClick={() => setShowNewAddressForm(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Nueva Dirección
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewAddressForm(false)}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a direcciones
                </Button>
                
                {/* Form with extra bottom padding for mobile keyboard */}
                <div className="space-y-3 pb-16">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="modal_address_name">Nombre completo *</Label>
                      <Input
                        id="modal_address_name"
                        placeholder="Nombre del destinatario"
                        value={newAddress.full_name}
                        onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal_address_phone">Teléfono</Label>
                      <Input
                        id="modal_address_phone"
                        placeholder="+509 XXXX XXXX"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="modal_address_street">Dirección *</Label>
                    <Input
                      id="modal_address_street"
                      placeholder="Calle, número, local..."
                      value={newAddress.street_address}
                      onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="modal_address_city">Ciudad *</Label>
                      <Input
                        id="modal_address_city"
                        placeholder="Ciudad"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal_address_postal">Código Postal</Label>
                      <Input
                        id="modal_address_postal"
                        placeholder="Código postal"
                        value={newAddress.postal_code}
                        onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={async () => {
                      try {
                        const address = await createAddress.mutateAsync(newAddress);
                        setSelectedAddressId(address.id);
                        setShowAddressModal(false);
                        setShowNewAddressForm(false);
                        setNewAddress({
                          full_name: '',
                          street_address: '',
                          city: '',
                          state: '',
                          postal_code: '',
                          phone: '',
                          country: 'Haití',
                          label: 'Negocio',
                          notes: '',
                          is_default: false,
                        });
                      } catch (error) {
                        console.error('Error adding address:', error);
                        toast.error('Error al agregar dirección');
                      }
                    }}
                    className="w-full"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Guardar Dirección
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Pickup Points Modal */}
        <Dialog open={showPickupModal} onOpenChange={setShowPickupModal}>
          <DialogContent className="max-w-sm border-2 border-gray-300">
            <DialogHeader className="border-b-2 pb-3 -mx-6 px-6 border-gray-300">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Store className="h-5 w-5" />
                Puntos de Retiro
              </DialogTitle>
            </DialogHeader>
            
            {pickupPoints.length === 0 ? (
              <div className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No hay puntos de retiro disponibles</p>
              </div>
            ) : (
              <RadioGroup value={selectedPickupPoint || ''} onValueChange={(id) => {
                setSelectedPickupPoint(id);
                setShowPickupModal(false);
              }} className="space-y-2 max-h-96 overflow-y-auto">
                {pickupPoints.map((point) => (
                  <div
                    key={point.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPickupPoint === point.id
                        ? 'border-[#071d7f] bg-[#071d7f]/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div
                      onClick={() => {
                        setSelectedPickupPoint(point.id);
                        setShowPickupModal(false);
                      }}
                      className="flex items-start justify-between gap-3"
                    >
                      <RadioGroupItem 
                        value={point.id} 
                        id={`pickup-${point.id}`}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{point.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{point.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {point.city}, {point.country}
                        </p>
                        {point.phone && (
                          <p className="text-xs text-muted-foreground mt-1">Tel: {point.phone}</p>
                        )}
                      </div>
                      {point.is_active && (
                        <Badge variant="outline" className="text-green-600 text-xs ml-2 flex-shrink-0">
                          Activo
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SellerLayout>
  );
};

export default SellerCheckout;
