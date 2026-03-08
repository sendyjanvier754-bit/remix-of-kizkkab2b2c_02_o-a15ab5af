import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import GlobalHeader from '@/components/layout/GlobalHeader';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useB2CCartItems } from '@/hooks/useB2CCartItems';
import { useCartSelectionStore } from '@/stores/useCartSelectionStore';
import { useAddresses, Address } from '@/hooks/useAddresses';
import { usePickupPoints } from '@/hooks/usePickupPoints';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCreateB2COrder, useCompleteB2CCart, useActiveB2COrder, useConfirmB2CPayment, useCancelB2COrder } from '@/hooks/useB2COrders';
import { B2CPaymentStateOverlay } from '@/components/checkout/B2CPaymentStateOverlay';
import { validateB2CCheckout, getFieldError, hasFieldError, CheckoutValidationError } from '@/services/checkoutValidation';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngine';
import { LocationSelector } from '@/components/checkout/LocationSelector';
import { useApplyDiscount, AppliedDiscount } from '@/hooks/useApplyDiscount';
import { useStorePaymentMethodsReadOnly, useAdminPaymentMethodsReadOnly } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AddressesDialog } from '@/components/account/AddressesDialog';
import { UserRole } from '@/types/auth';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Smartphone,
  Building2,
  Loader2,
  ShoppingBag,
  MapPin,
  Plus,
  Package,
  Star,
  Pencil,
  Truck,
  Store,
  AlertCircle,
  Plane,
  Shield,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'stripe' | 'moncash' | 'natcash' | 'transfer';
type PaymentMode = 'manual' | 'automatic';
type DeliveryMethod = 'address' | 'pickup';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, role, isLoading: authLoading } = useAuth();
  const { items: allItems, isLoading: cartLoading } = useB2CCartItems();
  const { b2cSelectedIds } = useCartSelectionStore();
  
  // Filter only selected items for checkout
  const items = useMemo(() => 
    allItems.filter(item => b2cSelectedIds.has(item.id)), 
    [allItems, b2cSelectedIds]
  );
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { pickupPoints, isLoading: pickupPointsLoading } = usePickupPoints();
  const isMobile = useIsMobile();
  const createOrder = useCreateB2COrder();
  const completeCart = useCompleteB2CCart();
  const { activeOrder, isCartLocked, refreshActiveOrder } = useActiveB2COrder();
  const confirmPayment = useConfirmB2CPayment();
  const cancelOrder = useCancelB2COrder();
  
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

  // Redirect sellers/admins to B2B checkout
  const isB2BUser = role === UserRole.SELLER || role === UserRole.ADMIN;
  
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('address');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CheckoutValidationError[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  
  // Logistics state
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  
  // Logistics hooks
  const {
    useCommunes,
    useShippingRates,
    useCategoryShippingRates,
    calculateShipping,
    getRateValue,
  } = useLogisticsEngine();
  
  const { data: communes } = useCommunes(selectedDepartment || undefined);
  const { data: shippingRates } = useShippingRates();
  const { data: categoryRates } = useCategoryShippingRates();

  // Redirect after hooks are called
  if (isB2BUser && !authLoading) {
    return <Navigate to="/seller/checkout" replace />;
  }

  // Auto-select default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      const defaultAddr = addresses.find(a => a.is_default);
      setSelectedAddress(defaultAddr?.id || addresses[0].id);
    }
  }, [addresses, selectedAddress]);


  const selectedAddressData = addresses.find(a => a.id === selectedAddress);

  const paymentMethods = [
    {
      id: 'stripe' as PaymentMethod,
      name: t('payments.creditCard'),
      description: t('checkout.creditCardDesc'),
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'moncash' as PaymentMethod,
      name: 'MonCash',
      description: t('checkout.moncashDesc'),
      icon: Smartphone,
      color: 'text-[#94111f]',
      bgColor: 'bg-[#94111f]/10',
    },
    {
      id: 'natcash' as PaymentMethod,
      name: 'NatCash',
      description: t('checkout.natcashDesc'),
      icon: Smartphone,
      color: 'text-[#071d7f]',
      bgColor: 'bg-[#071d7f]/10',
    },
    {
      id: 'transfer' as PaymentMethod,
      name: t('payments.bankTransfer'),
      description: t('checkout.bankTransferDesc'),
      icon: Building2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  // Get first store ID from cart items
  const firstStoreId = useMemo(() => {
    for (const item of items) {
      if (item.storeId) return item.storeId;
    }
    return undefined;
  }, [items]);

  const firstStoreName = useMemo(() => {
    for (const item of items) {
      if (item.storeName) return item.storeName;
    }
    return 'Vendedor';
  }, [items]);

  // Fetch SELLER payment methods (for manual payments - direct to seller)
  const { 
    bankMethod: storeBank,
    moncashMethod: storeMoncash,
    natcashMethod: storeNatcash,
    isLoading: paymentMethodsLoading 
  } = useStorePaymentMethodsReadOnly(firstStoreId);

  // Fetch ADMIN payment methods (for automatic payments - via platform API)
  const {
    moncashMethod: adminMoncash,
    natcashMethod: adminNatcash,
    isLoading: adminPaymentMethodsLoading
  } = useAdminPaymentMethodsReadOnly();

  // Check if automatic payment is available for each method
  const moncashAutoAvailable = adminMoncash?.automatic_enabled && adminMoncash?.is_active;
  const natcashAutoAvailable = adminNatcash?.automatic_enabled && adminNatcash?.is_active;
  
  // Check if manual payment is available (seller has configured their payment details)
  const moncashManualAvailable = !!storeMoncash?.phone_number;
  const natcashManualAvailable = !!storeNatcash?.phone_number;

  // Auto-select payment mode based on availability when payment method changes
  useEffect(() => {
    if (paymentMethod === 'moncash') {
      if (moncashAutoAvailable && !moncashManualAvailable) {
        setPaymentMode('automatic');
      } else if (!moncashAutoAvailable && moncashManualAvailable) {
        setPaymentMode('manual');
      }
    } else if (paymentMethod === 'natcash') {
      if (natcashAutoAvailable && !natcashManualAvailable) {
        setPaymentMode('automatic');
      } else if (!natcashAutoAvailable && natcashManualAvailable) {
        setPaymentMode('manual');
      }
    } else {
      // For other methods, default to manual
      setPaymentMode('manual');
    }
  }, [paymentMethod, moncashAutoAvailable, moncashManualAvailable, natcashAutoAvailable, natcashManualAvailable]);

  // Build seller payment info from database (for manual payments)
  const sellerPaymentInfo = useMemo(() => {
    return {
      storeName: firstStoreName,
      moncash: storeMoncash ? {
        phone_number: storeMoncash.phone_number || '',
        name: storeMoncash.holder_name || '',
      } : null,
      natcash: storeNatcash ? {
        phone_number: storeNatcash.phone_number || '',
        name: storeNatcash.holder_name || '',
      } : null,
      bank: storeBank ? {
        bank_name: storeBank.bank_name || '',
        account_number: storeBank.account_number || '',
        account_holder: storeBank.account_holder || '',
        account_type: storeBank.account_type || '',
      } : null,
    };
  }, [firstStoreName, storeBank, storeMoncash, storeNatcash]);

  // Helper to mask phone/account numbers
  const maskNumber = (num: string | undefined) => {
    if (!num) return '****';
    return num.length > 4 ? '****' + num.slice(-4) : num;
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate total weight from items (assuming weight in grams is available)
  const totalWeightGrams = items.reduce((sum, item) => {
    // Use item weight if available, otherwise estimate 200g per item
    const itemWeight = (item as any).weight_grams || 200;
    return sum + (itemWeight * item.quantity);
  }, 0);
  
  // Calculate shipping cost based on selected location
  const shippingCalculation = useMemo(() => {
    if (!selectedCommune || deliveryMethod !== 'address') {
      return null;
    }
    
    return calculateShipping({
      weightGrams: totalWeightGrams,
      referencePrice: subtotal,
      communeId: selectedCommune,
      rates: shippingRates,
      communes: communes,
      categoryRates: categoryRates,
    });
  }, [selectedCommune, totalWeightGrams, subtotal, shippingRates, communes, categoryRates, deliveryMethod, calculateShipping]);
  
  const shippingCost = shippingCalculation?.totalShippingCost || 0;
  const discountAmount = appliedDiscount?.discountAmount || 0;
  const totalWithShipping = subtotal + shippingCost - discountAmount;

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

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    await applyDiscount(discountCode.trim(), subtotal);
    setDiscountCode('');
  };

  if (authLoading || cartLoading || addressesLoading || pickupPointsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-[#071d7f]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 container mx-auto px-4 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">{t('checkout.loginRequired')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('checkout.loginMessage')}
            </p>
            <Button asChild className="w-full bg-[#071d7f] hover:bg-[#0a2a9f]">
              <Link to="/login">{t('auth.login')}</Link>
            </Button>
          </Card>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 container mx-auto px-4 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">{t('checkout.emptyCartTitle')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('checkout.emptyCartMessage')}
            </p>
            <Button asChild className="bg-[#071d7f] hover:bg-[#0a2a9f]">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('checkout.goShopping')}
              </Link>
            </Button>
          </Card>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  // Show payment state overlay if there's an active order in pending state
  if (activeOrder && (activeOrder.payment_status === 'pending' || activeOrder.payment_status === 'pending_validation' || activeOrder.payment_status === 'paid')) {
    const handleConfirmPayment = async () => {
      await confirmPayment.mutateAsync(activeOrder.id);
      await refreshActiveOrder();
    };

    const handleCancelOrder = async () => {
      await cancelOrder.mutateAsync(activeOrder.id);
      await refreshActiveOrder();
    };

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <B2CPaymentStateOverlay 
              order={activeOrder}
              onConfirmPayment={handleConfirmPayment}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {!isMobile && <GlobalHeader />}
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">{t('checkout.orderSent')}</h1>
              <p className="text-muted-foreground mb-4">
                {t('checkout.orderReceivedMessage')}
              </p>
              {orderId && (
                <div className="bg-muted p-4 rounded-lg mb-6">
                  <p className="text-sm text-muted-foreground">{t('checkout.orderNumberLabel')}</p>
                  <p className="font-mono font-bold text-lg">{orderId}</p>
                </div>
              )}
              
              {selectedAddressData && (
                <div className="text-left bg-blue-50 p-4 rounded-lg mb-6">
                  <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t('checkout.shippingAddress')}
                  </p>
                  <p className="text-sm">{selectedAddressData.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAddressData.street_address}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAddressData.city}, {selectedAddressData.country}
                  </p>
                </div>
              )}

              {paymentMethod !== 'stripe' && (
                <div className="text-left bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                  <p className="font-semibold text-yellow-800">{t('checkout.pendingVerification')}</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {t('checkout.pendingVerificationMessage')}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild variant="outline">
                  <Link to="/mis-compras">{t('checkout.viewMyOrders')}</Link>
                </Button>
                <Button asChild className="bg-[#071d7f] hover:bg-[#0a2a9f]">
                  <Link to="/">{t('checkout.continueShopping')}</Link>
                </Button>
              </div>
            </Card>
          </div>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    // Validate checkout form
    const errors = validateB2CCheckout({
      items: items.map(item => ({ id: item.id, quantity: item.quantity })),
      selectedAddress,
      deliveryMethod,
      selectedPickupPoint,
      paymentMethod,
      paymentReference,
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      // Show first error as toast
      const firstError = errors[0];
      toast.error(firstError.message);
      return;
    }

    // Clear validation errors on successful validation
    setValidationErrors([]);

    if (items.length === 0) {
      toast.error(t('errors.emptyCart'));
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare order items from cart
      const orderItems = items.map(item => ({
        sku: item.sku,
        nombre: item.name,
        cantidad: item.quantity,
        precio_unitario: item.price,
        subtotal: item.price * item.quantity,
        image: item.image,
        store_id: item.storeId,
        store_name: item.storeName,
        seller_catalog_id: item.sellerCatalogId,
      }));

      // Prepare shipping address (for address delivery)
      const shippingAddress = deliveryMethod === 'address' && selectedAddressData ? {
        id: selectedAddressData.id,
        full_name: selectedAddressData.full_name,
        phone: selectedAddressData.phone || undefined,
        street_address: selectedAddressData.street_address,
        city: selectedAddressData.city,
        state: selectedAddressData.state || undefined,
        postal_code: selectedAddressData.postal_code || undefined,
        country: selectedAddressData.country,
        notes: selectedAddressData.notes || undefined,
      } : undefined;

      // Create the order in database
      const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const order = await createOrder.mutateAsync({
        items: orderItems,
        total_amount: totalPrice,
        total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
        notes: orderNotes || undefined,
        shipping_address: shippingAddress,
        delivery_method: deliveryMethod,
        pickup_point_id: deliveryMethod === 'pickup' ? selectedPickupPoint : undefined,
      });

      if (order) {
        setOrderId(order.id.slice(0, 8).toUpperCase());
        
        // Complete the cart by marking it as completed
        try {
          // Get the cart ID from the first item
          const { data: cartData } = await supabase
            .from('b2c_carts')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .limit(1)
            .single();
          
          if (cartData?.id) {
            console.log('Completing cart:', cartData.id);
            // This will automatically invalidate queries and clear cache
            await completeCart.mutateAsync(cartData.id);
            console.log('Cart completion mutation finished');
          }
        } catch (cartError) {
          console.error('Error completing cart:', cartError);
          // Don't fail the order if cart completion fails
        }
        
        setOrderPlaced(true);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(t('errors.orderError'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isMobile && <GlobalHeader />}
      
      <main className={`flex-1 container mx-auto px-4 py-6 ${isMobile ? 'pb-24' : 'pb-8'}`}>
        <div className="mb-6">
          <Link to="/carrito" className="flex items-center gap-2 text-[#071d7f] hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" />
            {t('checkout.backToCart')}
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{t('checkout.title')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Method Selection */}
            <Card className={`p-6 ${hasFieldError(validationErrors, 'deliveryMethod') ? 'border-red-500 border-2' : ''}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#071d7f]" />
                {t('checkout.deliveryOption')}
              </h2>
              {hasFieldError(validationErrors, 'deliveryMethod') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{getFieldError(validationErrors, 'deliveryMethod')}</p>
                </div>
              )}
              
              <RadioGroup 
                value={deliveryMethod} 
                onValueChange={(value) => {
                  setDeliveryMethod(value as DeliveryMethod);
                  setSelectedAddress(null);
                  setSelectedPickupPoint(null);
                }}
                className="space-y-3"
              >
                <div
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    deliveryMethod === 'address'
                      ? 'border-[#071d7f] bg-blue-50/50'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                  onClick={() => {
                    setDeliveryMethod('address');
                    setSelectedAddress(null);
                    setSelectedPickupPoint(null);
                  }}
                >
                  <RadioGroupItem value="address" id="delivery-address" />
                  <div className="flex items-center gap-3 flex-1">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{t('checkout.homeDelivery')}</p>
                      <p className="text-sm text-muted-foreground">{t('checkout.homeDeliveryDesc')}</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    deliveryMethod === 'pickup'
                      ? 'border-[#071d7f] bg-blue-50/50'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                  onClick={() => {
                    setDeliveryMethod('pickup');
                    setSelectedAddress(null);
                    setSelectedPickupPoint(null);
                  }}
                >
                  <RadioGroupItem value="pickup" id="delivery-pickup" />
                  <div className="flex items-center gap-3 flex-1">
                    <Store className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{t('checkout.pickupPoint')}</p>
                      <p className="text-sm text-muted-foreground">{t('checkout.pickupPointDesc')}</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </Card>

            {/* Location Selector - Department/Commune */}
            {deliveryMethod === 'address' && (
              <Card className="p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#071d7f]" />
                  {t('checkout.deliveryZone')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('checkout.selectDeptCommune')}
                </p>
                <LocationSelector
                  departmentId={selectedDepartment}
                  communeId={selectedCommune}
                  onDepartmentChange={setSelectedDepartment}
                  onCommuneChange={setSelectedCommune}
                />
                
                {/* Shipping cost preview */}
                {shippingCalculation && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-blue-500" />
                        China → USA ({shippingCalculation.weightKg.toFixed(2)} kg)
                      </span>
                      <span>${shippingCalculation.chinaUsaCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-green-500" />
                        USA → Haití ({shippingCalculation.weightLb.toFixed(2)} lb)
                      </span>
                      <span>${shippingCalculation.usaHaitiCost.toFixed(2)}</span>
                    </div>
                    {shippingCalculation.insuranceCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-purple-500" />
                           {t('checkout.insurance')}
                        </span>
                        <span>${shippingCalculation.insuranceCost.toFixed(2)}</span>
                      </div>
                    )}
                    {(shippingCalculation.deliveryFee > 0 || shippingCalculation.operationalFee > 0) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('checkout.localCharges')}</span>
                        <span>${(shippingCalculation.deliveryFee + shippingCalculation.operationalFee).toFixed(2)}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>{t('checkout.totalShipping')}</span>
                      <span className="text-primary">${shippingCalculation.totalShippingCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Shipping Address */}
            {deliveryMethod === 'address' && (
              <Card className={`p-6 ${hasFieldError(validationErrors, 'selectedAddress') ? 'border-red-500 border-2' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#071d7f]" />
                    {t('checkout.shippingAddress')}
                  </h2>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddressDialog(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    {t('checkout.manage')}
                  </Button>
                </div>

                {hasFieldError(validationErrors, 'selectedAddress') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{getFieldError(validationErrors, 'selectedAddress')}</p>
                  </div>
                )}

                {addresses.length === 0 ? (
                  <div className="text-center py-6 bg-muted/50 rounded-lg">
                    <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-3">{t('checkout.noAddresses')}</p>
                    <Button 
                      onClick={() => setShowAddressDialog(true)}
                      className="bg-[#071d7f] hover:bg-[#0a2a9f]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('checkout.addAddress')}
                    </Button>
                  </div>
                ) : (
                  <RadioGroup 
                    value={selectedAddress || ''} 
                    onValueChange={setSelectedAddress}
                    className="space-y-3"
                  >
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedAddress === address.id
                            ? 'border-[#071d7f] bg-blue-50/50'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                        onClick={() => setSelectedAddress(address.id)}
                      >
                        <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{address.label}</span>
                            {address.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                 <Star className="h-3 w-3 mr-1" />
                                {t('checkout.default')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{address.full_name}</p>
                          <p className="text-sm text-muted-foreground">{address.street_address}</p>
                          <p className="text-sm text-muted-foreground">
                            {address.city}{address.state ? `, ${address.state}` : ''} - {address.country}
                          </p>
                          {address.phone && (
                            <p className="text-sm text-muted-foreground">Tel: {address.phone}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </Card>
            )}

            {/* Pickup Points */}
            {deliveryMethod === 'pickup' && (
              <Card className="p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#071d7f]" />
                  {t('checkout.pickupPointTitle')}
                </h2>

                {pickupPoints.length === 0 ? (
                  <div className="text-center py-6 bg-muted/50 rounded-lg">
                    <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">{t('checkout.noPickupPoints')}</p>
                  </div>
                ) : (
                  <RadioGroup 
                    value={selectedPickupPoint || ''} 
                    onValueChange={setSelectedPickupPoint}
                    className="space-y-3"
                  >
                    {pickupPoints.map((point) => (
                      <div
                        key={point.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPickupPoint === point.id
                            ? 'border-[#071d7f] bg-blue-50/50'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                        onClick={() => setSelectedPickupPoint(point.id)}
                      >
                        <RadioGroupItem value={point.id} id={`pickup-${point.id}`} className="mt-1" />
                        <div className="flex-1">
                          <p className="font-semibold">{point.name}</p>
                          <p className="text-sm text-muted-foreground">{point.address}</p>
                          <p className="text-sm text-muted-foreground">
                            {point.city}, {point.country}
                          </p>
                          {point.phone && (
                            <p className="text-sm text-muted-foreground">Tel: {point.phone}</p>
                          )}
                        </div>
                        {point.is_active && (
                          <Badge variant="outline" className="text-green-600">
                            Activo
                          </Badge>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </Card>
            )}

            {/* Order Items */}
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#071d7f]" />
                {t('common.orderSummary')} ({totalItems} {t('common.products')})
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-b-0">
                    <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{item.name}</p>
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
                        <span className="text-xs text-muted-foreground">{item.quantity} x ${item.price.toFixed(2)}</span>
                      </div>
                    </div>
                    <p className="font-semibold text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payment Method */}
            <Card className={`p-6 ${hasFieldError(validationErrors, 'paymentMethod') ? 'border-red-500 border-2' : ''}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#071d7f]" />
                {t('checkout.paymentMethod')}
              </h2>
              
              {hasFieldError(validationErrors, 'paymentMethod') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{getFieldError(validationErrors, 'paymentMethod')}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;

                  return (
                    <div
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#071d7f] bg-blue-50/50'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${method.bgColor}`}>
                        <Icon className={`h-5 w-5 ${method.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{method.name}</p>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 ${
                          isSelected ? 'border-[#071d7f] bg-[#071d7f]' : 'border-muted-foreground'
                        }`}
                      >
                        {isSelected && <Check className="h-full w-full text-white p-0.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment Details */}
              {paymentMethod === 'transfer' && sellerPaymentInfo?.bank && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Datos Bancarios - {sellerPaymentInfo.storeName}</h4>
                  <div className="space-y-1 text-sm text-green-700">
                    <p><span className="font-medium">Banco:</span> {sellerPaymentInfo.bank.bank_name || 'No configurado'}</p>
                    <p><span className="font-medium">Tipo:</span> {sellerPaymentInfo.bank.account_type || 'No configurado'}</p>
                    <p><span className="font-medium">Cuenta:</span> {maskNumber(sellerPaymentInfo.bank.account_number)}</p>
                    <p><span className="font-medium">Beneficiario:</span> {sellerPaymentInfo.bank.account_holder || 'No configurado'}</p>
                  </div>
                  <div className="mt-3">
                    <Label>Referencia de Transferencia *</Label>
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Número de referencia"
                      className={`mt-1 ${hasFieldError(validationErrors, 'paymentReference') ? 'border-red-500' : ''}`}
                    />
                    {hasFieldError(validationErrors, 'paymentReference') && (
                      <p className="text-sm text-red-600 mt-1">{getFieldError(validationErrors, 'paymentReference')}</p>
                    )}
                  </div>
                </div>
              )}

              {paymentMethod === 'transfer' && !sellerPaymentInfo?.bank && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">El vendedor no ha configurado datos bancarios.</p>
                </div>
              )}

              {/* MonCash Payment Section */}
              {paymentMethod === 'moncash' && (
                <div className="mt-4 space-y-4">
                  {/* Mode selector when both available */}
                  {moncashAutoAvailable && moncashManualAvailable && (
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <Label className="font-medium">¿Cómo desea pagar?</Label>
                      <div className="grid gap-2">
                        <div 
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer ${
                            paymentMode === 'automatic' ? 'border-yellow-400 bg-yellow-50/50' : ''
                          }`}
                          onClick={() => setPaymentMode('automatic')}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === 'automatic' ? 'border-yellow-500 bg-yellow-500' : 'border-muted-foreground'
                          }`}>
                            {paymentMode === 'automatic' && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-yellow-500" />
                              Pago Automático
                            </span>
                            <p className="text-xs text-muted-foreground">
                              Pago instantáneo vía API, confirmación automática
                            </p>
                          </div>
                        </div>
                        <div 
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer ${
                            paymentMode === 'manual' ? 'border-gray-400 bg-gray-50/50' : ''
                          }`}
                          onClick={() => setPaymentMode('manual')}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === 'manual' ? 'border-gray-500 bg-gray-500' : 'border-muted-foreground'
                          }`}>
                            {paymentMode === 'manual' && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Pago Manual al Vendedor</span>
                            <p className="text-xs text-muted-foreground">
                              Pague directamente al vendedor y proporcione el código
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Automatic mode - API payment */}
                  {paymentMode === 'automatic' && moncashAutoAvailable && (
                    <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="h-5 w-5 text-[#94111f]" />
                        <h4 className="font-semibold text-[#94111f]">Pago Automático MonCash</h4>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Al confirmar, será redirigido a MonCash para completar el pago de forma segura.
                        La confirmación será automática una vez procesado.
                      </p>
                    </div>
                  )}

                  {/* Manual mode - seller details */}
                  {paymentMode === 'manual' && moncashManualAvailable && sellerPaymentInfo?.moncash && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#94111f20' }}>
                      <h4 className="font-semibold mb-2" style={{ color: '#94111f' }}>
                        Datos MonCash - {sellerPaymentInfo.storeName}
                      </h4>
                      <div className="space-y-1 text-sm" style={{ color: '#94111f' }}>
                        <p><span className="font-medium">Número:</span> {sellerPaymentInfo.moncash.phone_number || 'No configurado'}</p>
                        <p><span className="font-medium">Nombre:</span> {sellerPaymentInfo.moncash.name || 'No configurado'}</p>
                      </div>
                      <div className="mt-3">
                        <Label>Código de Transacción *</Label>
                        <Input
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Código de transacción MonCash"
                          className={`mt-1 ${hasFieldError(validationErrors, 'paymentReference') ? 'border-red-500' : ''}`}
                        />
                        {hasFieldError(validationErrors, 'paymentReference') && (
                          <p className="text-sm text-red-600 mt-1">{getFieldError(validationErrors, 'paymentReference')}</p>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Neither available */}
                  {!moncashAutoAvailable && !moncashManualAvailable && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">MonCash no está disponible para este vendedor.</p>
                    </div>
                  )}
                </div>
              )}

              {/* NatCash Payment Section */}
              {paymentMethod === 'natcash' && (
                <div className="mt-4 space-y-4">
                  {/* Mode selector when both available */}
                  {natcashAutoAvailable && natcashManualAvailable && (
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <Label className="font-medium">¿Cómo desea pagar?</Label>
                      <div className="grid gap-2">
                        <div 
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer ${
                            paymentMode === 'automatic' ? 'border-yellow-400 bg-yellow-50/50' : ''
                          }`}
                          onClick={() => setPaymentMode('automatic')}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === 'automatic' ? 'border-yellow-500 bg-yellow-500' : 'border-muted-foreground'
                          }`}>
                            {paymentMode === 'automatic' && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-yellow-500" />
                              Pago Automático
                            </span>
                            <p className="text-xs text-muted-foreground">
                              Pago instantáneo vía API, confirmación automática
                            </p>
                          </div>
                        </div>
                        <div 
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer ${
                            paymentMode === 'manual' ? 'border-gray-400 bg-gray-50/50' : ''
                          }`}
                          onClick={() => setPaymentMode('manual')}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === 'manual' ? 'border-gray-500 bg-gray-500' : 'border-muted-foreground'
                          }`}>
                            {paymentMode === 'manual' && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Pago Manual al Vendedor</span>
                            <p className="text-xs text-muted-foreground">
                              Pague directamente al vendedor y proporcione el código
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Automatic mode - API payment */}
                  {paymentMode === 'automatic' && natcashAutoAvailable && (
                    <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="h-5 w-5 text-[#071d7f]" />
                        <h4 className="font-semibold text-[#071d7f]">Pago Automático NatCash</h4>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Al confirmar, será redirigido a NatCash para completar el pago de forma segura.
                        La confirmación será automática una vez procesado.
                      </p>
                    </div>
                  )}

                  {/* Manual mode - seller details */}
                  {paymentMode === 'manual' && natcashManualAvailable && sellerPaymentInfo?.natcash && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#071d7f20' }}>
                      <h4 className="font-semibold mb-2" style={{ color: '#071d7f' }}>
                        Datos NatCash - {sellerPaymentInfo.storeName}
                      </h4>
                      <div className="space-y-1 text-sm" style={{ color: '#071d7f' }}>
                        <p><span className="font-medium">Número:</span> {sellerPaymentInfo.natcash.phone_number || 'No configurado'}</p>
                        <p><span className="font-medium">Nombre:</span> {sellerPaymentInfo.natcash.name || 'No configurado'}</p>
                      </div>
                      <div className="mt-3">
                        <Label>Código de Transacción *</Label>
                        <Input
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Código de transacción NatCash"
                          className={`mt-1 ${hasFieldError(validationErrors, 'paymentReference') ? 'border-red-500' : ''}`}
                        />
                        {hasFieldError(validationErrors, 'paymentReference') && (
                          <p className="text-sm text-red-600 mt-1">{getFieldError(validationErrors, 'paymentReference')}</p>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Neither available */}
                  {!natcashAutoAvailable && !natcashManualAvailable && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">NatCash no está disponible para este vendedor.</p>
                    </div>
                  )}
                </div>
              )}

            </Card>

            {/* Order Notes */}
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">{t('checkout.orderNotes')}</h2>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={t('checkout.orderNotesPlaceholder')}
                rows={3}
              />
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-4">{t('common.orderSummary')}</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('common.subtotal')} ({totalItems} {t('common.products')})</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                
                {/* Shipping cost breakdown */}
                {shippingCalculation ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('shipping.cost')} (China → USA)</span>
                      <span>${shippingCalculation.chinaUsaCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('shipping.cost')} (USA → Haití)</span>
                      <span>${shippingCalculation.usaHaitiCost.toFixed(2)}</span>
                    </div>
                    {shippingCalculation.insuranceCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('checkout.insurance')}</span>
                        <span>${shippingCalculation.insuranceCost.toFixed(2)}</span>
                      </div>
                    )}
                    {(shippingCalculation.deliveryFee + shippingCalculation.operationalFee) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('checkout.localCharges')}</span>
                        <span>${(shippingCalculation.deliveryFee + shippingCalculation.operationalFee).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('shipping.cost')}</span>
                    <span className="text-muted-foreground italic text-xs">
                      {deliveryMethod === 'pickup' ? t('cart.freeShipping') : t('checkout.deliveryZone')}
                    </span>
                  </div>
                )}
                
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
                      <Label className="text-xs text-muted-foreground">{t('checkout.discountCode')}</Label>
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
                          onClick={handleApplyDiscount}
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
                
                <Separator className="my-3" />
                
                {/* Show discount in summary */}
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#071d7f]">${totalWithShipping.toFixed(2)}</span>
                </div>
              </div>

              {deliveryMethod === 'address' && selectedAddressData && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Enviar a:</p>
                  <p className="text-sm font-medium">{selectedAddressData.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedAddressData.city}, {selectedAddressData.country}</p>
                </div>
              )}

              {deliveryMethod === 'pickup' && pickupPoints.find(p => p.id === selectedPickupPoint) && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Retiro en:</p>
                  <p className="text-sm font-medium">{pickupPoints.find(p => p.id === selectedPickupPoint)?.name}</p>
                  <p className="text-xs text-muted-foreground">{pickupPoints.find(p => p.id === selectedPickupPoint)?.city}</p>
                </div>
              )}

              <Button
                onClick={handlePlaceOrder}
                disabled={
                  isProcessing || 
                  (deliveryMethod === 'address' && (!selectedAddress || addresses.length === 0 || !selectedCommune)) ||
                  (deliveryMethod === 'pickup' && (!selectedPickupPoint || pickupPoints.length === 0))
                }
                className="w-full mt-6 bg-[#071d7f] hover:bg-[#0a2a9f]"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar Pedido
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-3">
                Al confirmar, aceptas nuestros términos y condiciones
              </p>
            </Card>
          </div>
        </div>
      </main>

      {!isMobile && <Footer />}
      
      <AddressesDialog open={showAddressDialog} onOpenChange={setShowAddressDialog} />
    </div>
  );
};

export default CheckoutPage;
