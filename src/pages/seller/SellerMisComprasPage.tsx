import { useState, useEffect, useMemo } from 'react';
import { OpenChatButton } from '@/components/chat/OpenChatButton';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useBuyerB2BOrders, useCancelBuyerOrder, BuyerOrder, BuyerOrderStatus, RefundStatus, BuyerOrderItem, PaymentStatus } from '@/hooks/useBuyerOrders';
import { usePackageTracking } from '@/hooks/usePackageTracking';
import { TrackingWidget } from '@/components/tracking/TrackingWidget';
import { useOrdersPOInfo, OrderPOInfo } from '@/hooks/useOrderPOInfo';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/services/pdfGenerators';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';
import { useCreateReturnRequest } from '@/hooks/useOrderReturnRequests';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  XCircle, 
  Search, 
  Loader2,
  Eye,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  ExternalLink,
  MapPin,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Ban,
  ChevronRight,
  Printer,
  FileText,
  RotateCcw,
  Boxes,
  Ship,
  Plane,
  Warehouse,
  PackageCheck,
  Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const statusConfig: Record<BuyerOrderStatus, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
  draft: { label: 'Borrador', color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-100' },
  placed: { label: 'Procesando', color: 'text-blue-600', icon: Package, bgColor: 'bg-blue-100' },
  paid: { label: 'Pagado', color: 'text-green-600', icon: CheckCircle, bgColor: 'bg-green-100' },
  preparing: { label: 'En Preparación', color: 'text-amber-600', icon: Package, bgColor: 'bg-amber-100' },
  in_transit: { label: 'En Tránsito', color: 'text-blue-600', icon: Truck, bgColor: 'bg-blue-100' },
  shipped: { label: 'En camino', color: 'text-purple-600', icon: Truck, bgColor: 'bg-purple-100' },
  delivered: { label: 'Entregado', color: 'text-green-600', icon: CheckCircle, bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-100' },
};

const defaultStatusConfig = { label: 'Desconocido', color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-100' };

// Payment status configuration
const paymentStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
  draft: { label: 'Borrador', color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-100' },
  pending: { label: 'Pago Pendiente', color: 'text-amber-600', icon: Clock, bgColor: 'bg-amber-100' },
  pending_validation: { label: 'Verificando Pago', color: 'text-orange-600', icon: AlertCircle, bgColor: 'bg-orange-100' },
  paid: { label: 'Pagado', color: 'text-green-600', icon: CheckCircle, bgColor: 'bg-green-100' },
  failed: { label: 'Pago Fallido', color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-100' },
  expired: { label: 'Expirado', color: 'text-red-600', icon: Clock, bgColor: 'bg-red-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-100' },
};

const refundStatusConfig: Record<RefundStatus, { label: string; color: string; bgColor: string }> = {
  none: { label: 'Sin reembolso', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  requested: { label: 'Solicitado', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  processing: { label: 'En proceso', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  completed: { label: 'Completado', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rechazado', color: 'text-red-600', bgColor: 'bg-red-100' },
};

const carrierUrls: Record<string, string> = {
  "DHL": "https://www.dhl.com/en/express/tracking.html?AWB=",
  "FedEx": "https://www.fedex.com/fedextrack/?trknbr=",
  "UPS": "https://www.ups.com/track?tracknum=",
  "USPS": "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
};

const SellerMisComprasPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BuyerOrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  const [selectedItem, setSelectedItem] = useState<BuyerOrderItem | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [requestRefund, setRequestRefund] = useState(false);

  // Always fetch all orders; filter client-side so stats/tab badges are always accurate
  const { data: rawOrders, isLoading } = useBuyerB2BOrders();
  const orders = statusFilter === 'all'
    ? rawOrders
    : statusFilter === 'preparing'
      ? rawOrders?.filter(o => o.status === 'preparing' || o.status === 'in_transit')
      : rawOrders?.filter(o => o.status === statusFilter);
  const cancelOrder = useCancelBuyerOrder();
  const createReturnRequest = useCreateReturnRequest();
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnReasonType, setReturnReasonType] = useState('');

  // Get order IDs to fetch PO info
  const orderIds = useMemo(() => orders?.map(o => o.id) || [], [orders]);
  const { data: poInfoMap } = useOrdersPOInfo(orderIds);
  // Package tracking
  const { tracking, isLoading: trackingLoading, getCarrierTrackingUrl } = usePackageTracking(
    selectedOrder?.id || ''
  );

  // Real-time subscription for B2B order updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('seller-b2b-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders_b2b',
          filter: `buyer_id=eq.${user.id}`
        },
        (payload) => {
          console.log('B2B Order update received:', payload);
          
          // Invalidate queries to refetch data with specific key matching
          queryClient.invalidateQueries({ queryKey: ['buyer-b2b-orders', user?.id] });
          
          // Show toast for important updates
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            // Payment confirmed
            if (oldData?.payment_status !== 'paid' && newData.payment_status === 'paid') {
              toast.success('¡Pago Confirmado!', {
                description: 'Tu pago ha sido validado y tu pedido está en proceso.'
              });
            }
            
            // Status changes
            if (oldData?.status !== newData.status) {
              const statusMessages: Record<string, { title: string; desc: string }> = {
                'shipped': { title: '📦 Pedido Enviado', desc: 'Tu pedido está en camino' },
                'delivered': { title: '✅ Pedido Entregado', desc: '¡Tu pedido ha llegado a su destino!' },
              };
              
              const msg = statusMessages[newData.status];
              if (msg) {
                toast.success(msg.title, { description: msg.desc });
              }
            }

            // Logistics stage changes
            if (oldData?.metadata?.logistics_stage !== newData.metadata?.logistics_stage) {
              const stageMessages: Record<string, string> = {
                'in_china': '📍 Tu pedido está en China',
                'in_transit_usa': '✈️ Tu pedido está en tránsito hacia USA',
                'in_haiti_hub': '🏢 Tu pedido llegó al Hub en Haití',
                'ready_for_delivery': '🚚 Tu pedido está listo para entrega',
              };
              
              const msg = stageMessages[newData.metadata?.logistics_stage];
              if (msg) {
                toast.info('Actualización de Envío', { description: msg });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // PDF Generation handler - Invoice only (sellers don't need shipping labels for their purchases)

  const handlePrintInvoice = (order: BuyerOrder) => {
    const shippingAddress = order.metadata?.shipping_address || {};
    
    generateInvoicePDF({
      id: order.id,
      order_number: order.id.slice(0, 8).toUpperCase(),
      customer_name: user?.name || shippingAddress.full_name || 'Cliente B2B',
      customer_phone: shippingAddress.phone || '',
      customer_address: shippingAddress.street || '',
      department: shippingAddress.department,
      commune: shippingAddress.commune,
      items: (order.order_items_b2b || []).map(item => {
        const unitPrice = Number(item.precio_unitario || 0);
        const qty = Number(item.cantidad || 0);
        const lineTotal = Number((item as any).precio_total ?? (unitPrice * qty));
        return {
          sku: item.sku,
          nombre: item.nombre,
          cantidad: qty,
          precio_unitario: unitPrice,
          subtotal: lineTotal,
          color: item.sku?.split('-')[1],
          size: item.sku?.split('-')[2],
          image: item.image || undefined,
        };
      }),
      total_amount: order.total_amount,
      payment_method: order.payment_method || 'N/A',
      created_at: order.created_at,
      hybrid_tracking_id: order.metadata?.hybrid_tracking_id,
    });
    
    toast.success('Factura generada', { description: 'Preparando impresión...' });
  };

  // Use payment_status for badge when order is placed but payment not yet confirmed
  const getOrderDisplayBadge = (order: BuyerOrder) => {
    // Preparing / in_transit — always show logistics status (payment already confirmed)
    if (order.status === 'preparing' || order.status === 'in_transit') {
      const config = statusConfig[order.status];
      const Icon = config.icon;
      return (
        <Badge className={`${config.bgColor} ${config.color} gap-1`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }

    // If order is delivered, shipped, or cancelled - show order status
    if (['delivered', 'shipped', 'cancelled'].includes(order.status)) {
      const config = statusConfig[order.status];
      const Icon = config.icon;
      return (
        <Badge className={`${config.bgColor} ${config.color} gap-1`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }
    
    // For placed orders, show payment status
    if (order.status === 'placed') {
      const paymentStatus = order.payment_status || 'pending';
      const config = paymentStatusConfig[paymentStatus] || paymentStatusConfig.pending;
      const Icon = config.icon;
      return (
        <Badge className={`${config.bgColor} ${config.color} gap-1`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }
    
    // For paid orders
    if (order.status === 'paid' || order.payment_status === 'paid') {
      const config = paymentStatusConfig.paid;
      const Icon = config.icon;
      return (
        <Badge className={`${config.bgColor} ${config.color} gap-1`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }
    
    // Default: show order status
    const config = statusConfig[order.status] ?? defaultStatusConfig;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bgColor} ${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: BuyerOrderStatus) => {
    const config = statusConfig[status] ?? defaultStatusConfig;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bgColor} ${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleCancelClick = (order: BuyerOrder) => {
    setSelectedOrder(order);
    setShowCancelDialog(true);
    setCancelReason('');
    setRequestRefund(false);
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    await cancelOrder.mutateAsync({
      orderId: selectedOrder.id,
      reason: cancelReason,
      requestRefund: requestRefund && selectedOrder.status === 'paid',
    });

    setShowCancelDialog(false);
    setSelectedOrder(null);
  };

  const filteredOrders = orders || [];
  // Stats always from ALL orders so tab badges are correct regardless of active tab
  const allOrders = rawOrders || [];

  const stats = {
    total: allOrders.length,
    pending: allOrders.filter(o => o.status === 'placed').length,
    paid: allOrders.filter(o => o.status === 'paid').length,
    preparing: allOrders.filter(o => o.status === 'preparing' || o.status === 'in_transit').length,
    shipped: allOrders.filter(o => o.status === 'shipped').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
    totalAmount: allOrders.filter(o => ['paid', 'preparing', 'in_transit', 'shipped', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + o.total_amount, 0),
  };

  return (
    <SellerLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards with Header */}
        <div className="bg-card border border-border rounded-lg md:mt-14">
          <div className="p-3">
            <div className="border-b pb-2 mb-3">
              <h1 className="text-lg font-bold text-foreground">Mis Compras B2B</h1>
            </div>
            <div className="grid grid-cols-5 gap-1 w-full">
              <Card className="bg-card border-border">
                <CardContent className="p-1.5 text-center">
                  <Package className="h-3 w-3 text-primary mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-foreground">{stats.total}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Total</p>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-1.5 text-center">
                  <Clock className="h-3 w-3 text-blue-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-blue-500">{stats.pending}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Pendiente</p>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-1.5 text-center">
                  <CheckCircle className="h-3 w-3 text-amber-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-amber-500">{stats.paid}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Pagados</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-1.5 text-center">
                  <Truck className="h-3 w-3 text-purple-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-purple-500">{stats.shipped}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Camino</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-1.5 text-center">
                  <CheckCircle className="h-3 w-3 text-green-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-green-500">{stats.delivered}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Entregado</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as BuyerOrderStatus | 'all')}>
              <TabsList className="flex w-full overflow-x-auto gap-1 justify-start scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <TabsTrigger value="all" className="text-xs shrink-0">Todos</TabsTrigger>
                <TabsTrigger value="placed" className="text-xs shrink-0">Pendientes</TabsTrigger>
                <TabsTrigger value="paid" className="text-xs shrink-0">Pagados</TabsTrigger>
                <TabsTrigger value="preparing" className="text-xs shrink-0">
                  En Preparación
                  {stats.preparing > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1">{stats.preparing}</span>}
                </TabsTrigger>
                <TabsTrigger value="shipped" className="text-xs shrink-0">En Camino</TabsTrigger>
                <TabsTrigger value="delivered" className="text-xs shrink-0">Entregados</TabsTrigger>
                <TabsTrigger value="cancelled" className="text-xs shrink-0">Cancelados</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card className="p-8 text-center">
              {statusFilter === 'all' ? (
                <>
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tienes compras aún</h3>
                  <p className="text-muted-foreground mb-4">Explora el catálogo B2B y realiza tu primera compra</p>
                  <Button asChild>
                    <Link to="/seller/adquisicion-lotes">Ir al Catálogo B2B</Link>
                  </Button>
                </>
              ) : (
                <>
                  {statusFilter === 'placed' && <Clock className="h-12 w-12 text-blue-300 mx-auto mb-4" />}
                  {statusFilter === 'paid' && <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />}
                  {statusFilter === 'preparing' && <Package className="h-12 w-12 text-amber-300 mx-auto mb-4" />}
                  {statusFilter === 'shipped' && <Truck className="h-12 w-12 text-purple-300 mx-auto mb-4" />}
                  {statusFilter === 'delivered' && <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />}
                  {statusFilter === 'cancelled' && <XCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />}
                  <h3 className="text-lg font-semibold mb-2">Sin pedidos en este estado</h3>
                  <p className="text-muted-foreground mb-4">
                    No tienes pedidos con estado «{statusConfig[statusFilter as BuyerOrderStatus]?.label ?? statusFilter}» por el momento
                  </p>
                  <Button variant="outline" onClick={() => setStatusFilter('all')}>
                    Ver todos los pedidos
                  </Button>
                </>
              )}
            </Card>
          ) : (
            filteredOrders.map((order) => {
              const status = statusConfig[order.status] ?? defaultStatusConfig;
              const Icon = status.icon;
              const trackingNumber = order.metadata?.tracking_number;
              const carrier = order.metadata?.carrier;
              const poInfo = poInfoMap?.[order.id];
              
              return (
                <Card 
                  key={order.id} 
                  className={`cursor-pointer hover:shadow-lg transition-all duration-300 border-l-4 ${
                    order.status === 'shipped' ? 'border-l-purple-500' : 
                    order.status === 'delivered' ? 'border-l-green-500' : 
                    order.status === 'preparing' || order.status === 'in_transit' ? 'border-l-amber-500' :
                    order.payment_status === 'paid' || order.status === 'paid' ? 'border-l-green-500' : 
                    order.payment_status === 'pending_validation' ? 'border-l-orange-500' :
                    order.status === 'placed' ? 'border-l-amber-400' : 
                    order.status === 'cancelled' ? 'border-l-red-500' : 'border-l-gray-300'
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                          {order.order_items_b2b?.[0]?.image ? (
                            <img 
                              src={order.order_items_b2b[0].image} 
                              alt={order.order_items_b2b[0].nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${status.bgColor}`}>
                              <Icon className={`h-4 w-4 md:h-5 md:w-5 ${status.color}`} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-semibold text-[11px] md:text-base">#{order.id.slice(0, 6).toUpperCase()}</span>
                            {getOrderDisplayBadge(order)}
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {order.order_items_b2b?.length || 0} prod. • {order.total_quantity} uds
                            {poInfo && ` • PO: ${poInfo.po_number}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="font-bold text-lg">${order.total_amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{order.currency}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Tracking Info */}
                    {order.status === 'shipped' && trackingNumber && (
                      <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-purple-600" />
                        <span className="text-muted-foreground">Rastreo:</span>
                        <span className="font-medium text-purple-600">{trackingNumber}</span>
                        {carrier && <span className="text-muted-foreground">({carrier})</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !showCancelDialog} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (() => {
            const selectedPoInfo = poInfoMap?.[selectedOrder.id];
            const selectedStatusConfig = statusConfig[selectedOrder.status] ?? defaultStatusConfig;
            return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedOrder.status === 'cancelled'
                      ? 'bg-red-100 text-red-600'
                      : selectedOrder.status === 'preparing' || selectedOrder.status === 'in_transit'
                        ? 'bg-amber-100 text-amber-600'
                        : selectedOrder.status === 'shipped'
                          ? 'bg-purple-100 text-purple-600'
                          : selectedOrder.status === 'delivered'
                            ? 'bg-green-100 text-green-600'
                            : selectedOrder.payment_status === 'pending_validation'
                              ? 'bg-orange-100 text-orange-600'
                              : selectedOrder.payment_status === 'paid'
                                ? 'bg-green-100 text-green-600'
                                : selectedStatusConfig.bgColor + ' ' + selectedStatusConfig.color
                  }`}>
                    {(() => {
                      const Icon = selectedOrder.status === 'cancelled'
                        ? XCircle
                        : selectedOrder.status === 'preparing' || selectedOrder.status === 'in_transit'
                          ? Package
                          : selectedOrder.status === 'shipped'
                            ? Truck
                            : selectedOrder.status === 'delivered'
                              ? CheckCircle
                              : selectedOrder.payment_status === 'pending_validation'
                                ? AlertCircle
                                : selectedOrder.payment_status === 'paid'
                                  ? CheckCircle
                                  : selectedStatusConfig.icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <span className="block">Pedido #{selectedOrder.id.slice(0, 8).toUpperCase()}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getOrderDisplayBadge(selectedOrder)}
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs">
                        <Boxes className="h-3 w-3 mr-1" />
                        B2B
                      </Badge>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* PO Information Card - Show if linked to PO */}
                {selectedPoInfo && (
                  <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
                        <Boxes className="h-5 w-5" />
                        Orden de Compra Consolidada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-600">Número de PO:</span>
                        <Badge className="bg-indigo-600 text-white">{selectedPoInfo.po_number}</Badge>
                      </div>
                      {selectedPoInfo.hybrid_tracking_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-indigo-600">ID Híbrido:</span>
                          <span className="font-mono text-sm font-medium text-indigo-800">{selectedPoInfo.hybrid_tracking_id}</span>
                        </div>
                      )}
                      {selectedPoInfo.china_tracking_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-indigo-600">Guía China:</span>
                          <span className="font-mono text-sm font-medium text-indigo-800">{selectedPoInfo.china_tracking_number}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-600">Estado PO:</span>
                        <Badge variant="outline" className="border-indigo-300 text-indigo-700">
                          {selectedPoInfo.po_status === 'open' ? 'Abierta' : 
                           selectedPoInfo.po_status === 'closed' ? 'Cerrada' : 
                           selectedPoInfo.po_status === 'in_transit' ? 'En Tránsito' :
                           selectedPoInfo.po_status === 'arrived_hub' ? 'En Hub' : selectedPoInfo.po_status}
                        </Badge>
                      </div>
                      
                      {/* PO Logistics Timeline */}
                      <div className="mt-4 pt-3 border-t border-indigo-200">
                        <p className="text-xs font-medium text-indigo-700 mb-2">Progreso Logístico</p>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`flex items-center gap-1 ${selectedPoInfo.shipped_from_china_at ? 'text-green-600' : 'text-gray-400'}`}>
                            <Package className="h-3 w-3" />
                            <span>China</span>
                          </div>
                          <ChevronRight className="h-3 w-3 text-gray-300" />
                          <div className={`flex items-center gap-1 ${selectedPoInfo.arrived_usa_at ? 'text-green-600' : 'text-gray-400'}`}>
                            <Plane className="h-3 w-3" />
                            <span>USA</span>
                          </div>
                          <ChevronRight className="h-3 w-3 text-gray-300" />
                          <div className={`flex items-center gap-1 ${selectedPoInfo.arrived_hub_at ? 'text-green-600' : 'text-gray-400'}`}>
                            <Warehouse className="h-3 w-3" />
                            <span>Hub Haití</span>
                          </div>
                          <ChevronRight className="h-3 w-3 text-gray-300" />
                          <div className={`flex items-center gap-1 ${selectedPoInfo.delivery_confirmed_at ? 'text-green-600' : 'text-gray-400'}`}>
                            <PackageCheck className="h-3 w-3" />
                            <span>Entregado</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Package Tracking Widget */}
                {selectedOrder && ['shipped', 'delivered'].includes(selectedOrder.status) && (
                  <TrackingWidget 
                    tracking={tracking}
                    isLoading={trackingLoading}
                    getCarrierTrackingUrl={getCarrierTrackingUrl}
                  />
                )}

                {/* Tracking Section */}
                {selectedOrder && (selectedOrder.status === 'shipped' || selectedOrder.status === 'delivered') && selectedOrder.metadata?.tracking_number && (
                  <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                        <Truck className="h-5 w-5" />
                        Seguimiento de Envío
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Paquetería</p>
                          <p className="font-semibold text-purple-900">{selectedOrder.metadata.carrier || "No especificada"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Número de Guía</p>
                          <p className="font-mono font-semibold text-purple-900">{selectedOrder.metadata.tracking_number}</p>
                        </div>
                      </div>
                      
                      {selectedOrder.metadata.estimated_delivery && (
                        <div className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded-lg">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <span className="text-muted-foreground">Entrega estimada:</span>
                          <span className="font-medium">{selectedOrder.metadata.estimated_delivery}</span>
                        </div>
                      )}

                      {selectedOrder.metadata.carrier && carrierUrls[selectedOrder.metadata.carrier] && (
                        <a 
                          href={`${carrierUrls[selectedOrder.metadata.carrier]}${selectedOrder.metadata.tracking_number}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                          <MapPin className="h-4 w-4" />
                          Rastrear en {selectedOrder.metadata.carrier}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Timeline - Horizontal */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Estado del Pedido</h4>
                  <div className="flex items-center justify-between w-full">
                    {['placed', 'paid', 'shipped', 'delivered'].map((step, index, arr) => {
                      // rank map: preparing/in_transit sit between paid(1) and shipped(2)
                      const statusRank: Record<string, number> = {
                        placed: 0, paid: 1, preparing: 1, in_transit: 1, shipped: 2, delivered: 3,
                      };
                      const stepRank: Record<string, number> = { placed: 0, paid: 1, shipped: 2, delivered: 3 };
                      const orderRank = statusRank[selectedOrder.status] ?? -1;
                      const stepStatus = statusConfig[step as BuyerOrderStatus];
                      const StepIcon = stepStatus.icon;
                      const isCompleted = selectedOrder.status !== 'cancelled' && orderRank >= (stepRank[step] ?? 99);
                      const isCurrent = selectedOrder.status === step
                        || (step === 'paid' && (selectedOrder.status === 'preparing' || selectedOrder.status === 'in_transit'));

                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                              ${isCompleted ? stepStatus.bgColor : 'bg-gray-100'}
                              ${isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''}`}>
                              {isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <StepIcon className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <p className={`text-[10px] mt-1 text-center ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {stepStatus.label}
                            </p>
                          </div>
                          {index < arr.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Productos ({selectedOrder.order_items_b2b?.length || 0})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOrder.order_items_b2b?.map((item) => {
                      // Extract variant info from SKU
                      const skuParts = item.sku?.split('-') || [];
                      const color = skuParts[1] || null;
                      const size = skuParts[2] || null;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedItem(item)}
                        >
                          {/* Product Image */}
                          <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.nombre}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{item.nombre}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {color && (
                                <span className="bg-muted px-1.5 py-0.5 rounded capitalize">{color}</span>
                              )}
                              {size && (
                                <span className="bg-muted px-1.5 py-0.5 rounded uppercase">{size}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold">${((item as any).precio_total != null ? Number((item as any).precio_total) : Number(item.precio_unitario || 0) * Number(item.cantidad || 0)).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">× {item.cantidad} uds</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Breakdown */}
                {(() => {
                  const meta = selectedOrder.metadata as any;
                  const itemsSubtotal = Number(meta?.items_subtotal) || Number((selectedOrder as any).subtotal) || selectedOrder.order_items_b2b?.reduce((sum, item) => sum + ((item as any).precio_total != null ? Number((item as any).precio_total) : Number(item.precio_unitario || 0) * Number(item.cantidad || 0)), 0) || 0;
                  const shippingCost = Number(selectedOrder.shipping_cost_total_usd || meta?.shipping_cost || 0);
                  const platformFee = Number(meta?.platform_fee || meta?.fee_plataforma || 0);
                  const discount = Number(meta?.discount_amount || 0);
                  const totalAmount = Number(selectedOrder.total_amount || 0);

                  return (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Resumen de Pago</h4>
                      <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal productos</span>
                          <span>${itemsSubtotal.toFixed(2)}</span>
                        </div>
                        {shippingCost > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Envío / Logística</span>
                            <span>${shippingCost.toFixed(2)}</span>
                          </div>
                        )}
                        {platformFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fee plataforma</span>
                            <span>${platformFee.toFixed(2)}</span>
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Descuento</span>
                            <span>-${discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 flex justify-between items-center">
                          <span className="font-semibold text-base">Total a Pagar</span>
                          <span className="text-2xl font-bold text-primary">
                            ${totalAmount.toFixed(2)} <span className="text-sm font-normal">{selectedOrder.currency}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Comprobante de Pago — for manual payment methods awaiting validation */}
                {selectedOrder.payment_method !== 'stripe' &&
                  selectedOrder.payment_status !== 'paid' &&
                  selectedOrder.status !== 'cancelled' && (
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Comprobante de Pago
                    </h4>
                    <PaymentProofUpload
                      orderId={selectedOrder.id}
                      existingUrl={(selectedOrder.metadata as any)?.payment_proof_url}
                      onUploaded={() => {
                        queryClient.invalidateQueries({ queryKey: ['buyer-b2b-orders'] });
                      }}
                    />
                  </div>
                )}

                {/* Cancellation Info */}
                {selectedOrder.status === 'cancelled' && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-700">Pedido Cancelado</span>
                      </div>
                      {selectedOrder.metadata?.cancellation_reason && (
                        <p className="text-sm text-red-600">
                          <span className="font-medium">Motivo:</span> {selectedOrder.metadata.cancellation_reason}
                        </p>
                      )}
                      {selectedOrder.metadata?.refund_status && selectedOrder.metadata.refund_status !== 'none' && (
                        <div className="border-t border-red-200 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-red-700">Estado del Reembolso</span>
                            <Badge className={`${refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].bgColor} ${refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].color}`}>
                              {refundStatusConfig[selectedOrder.metadata.refund_status as RefundStatus].label}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* PDF Generation Actions */}
                {['paid', 'shipped', 'delivered'].includes(selectedOrder.status) && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Documentos
                    </h4>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintInvoice(selectedOrder)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Factura de Compra
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <Button 
                    asChild 
                    className="w-full"
                  >
                    <Link 
                      to={
                        selectedOrder.order_items_b2b && selectedOrder.order_items_b2b.length > 0
                          ? `/seller/adquisicion-lotes?search=${encodeURIComponent(selectedOrder.order_items_b2b[0].sku)}`
                          : '/seller/adquisicion-lotes'
                      }
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Volver a Comprar
                    </Link>
                  </Button>

                  <OpenChatButton
                    orderId={selectedOrder.id}
                    orderType="b2b"
                    orderLabel={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                    fullWidth
                    navigateTo="seller"
                  />

                  {['placed', 'paid'].includes(selectedOrder.status) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-muted-foreground hover:text-red-600 hover:bg-red-50/50"
                      onClick={() => handleCancelClick(selectedOrder)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </>
          );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancelar Pedido
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Por favor indica el motivo de la cancelación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo de cancelación *</label>
              <Textarea
                placeholder="Escribe el motivo de la cancelación..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>

            {selectedOrder?.status === 'paid' && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="refund"
                  checked={requestRefund}
                  onChange={(e) => setRequestRefund(e.target.checked)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <label htmlFor="refund" className="font-medium text-amber-800 cursor-pointer">
                    Solicitar reembolso
                  </label>
                  <p className="text-xs text-amber-600">
                    Tu pedido ya fue pagado. Marca esta opción para solicitar el reembolso de ${selectedOrder?.total_amount.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={cancelOrder.isPending}>
              Volver
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmCancel}
              disabled={!cancelReason.trim() || cancelOrder.isPending}
            >
              {cancelOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Detail Modal - Shows all variants of the same product */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedItem && selectedOrder && (() => {
            // Get the base SKU (first part before variants)
            const selectedSkuBase = selectedItem.sku?.split('-')[0] || selectedItem.sku;
            
            // Find all items with the same base SKU (same product, different variants)
            const allVariants = selectedOrder.order_items_b2b?.filter(item => {
              const itemSkuBase = item.sku?.split('-')[0] || item.sku;
              return itemSkuBase === selectedSkuBase;
            }) || [selectedItem];
            
            // Calculate totals for all variants
            const totalQuantity = allVariants.reduce((sum, item) => sum + item.cantidad, 0);
            const totalSubtotal = allVariants.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">Detalle del Producto</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Product Image - Large */}
                  <div className="aspect-square w-full max-w-[200px] mx-auto rounded-lg bg-muted overflow-hidden">
                    {selectedItem.image ? (
                      <img 
                        src={selectedItem.image} 
                        alt={selectedItem.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  
                  {/* Product Name */}
                  <div className="text-center">
                    <h3 className="font-semibold text-base leading-tight">{selectedItem.nombre}</h3>
                    <p className="text-xs text-muted-foreground mt-1">SKU Base: {selectedSkuBase}</p>
                  </div>
                  
                  {/* All Variants Purchased */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Variantes Compradas ({allVariants.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {allVariants.map((variant) => {
                        const skuParts = variant.sku?.split('-') || [];
                        const color = skuParts[1] || null;
                        const size = skuParts[2] || null;
                        
                        return (
                          <div 
                            key={variant.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              {color && (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium capitalize">
                                  {color}
                                </span>
                              )}
                              {size && (
                                <span className="bg-secondary/50 px-2 py-1 rounded text-xs font-medium uppercase">
                                  {size}
                                </span>
                              )}
                              {!color && !size && (
                                <span className="text-xs text-muted-foreground">Sin variantes</span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{variant.cantidad} uds</p>
                              <p className="text-xs text-muted-foreground">${variant.precio_unitario.toFixed(2)} c/u</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total variantes</span>
                      <span className="font-medium">{allVariants.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total unidades</span>
                      <span className="font-semibold text-lg">{totalQuantity} uds</span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Subtotal</span>
                      <span className="font-bold text-primary">${totalSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
};

export default SellerMisComprasPage;
