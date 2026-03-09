import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenChatButton } from '@/components/chat/OpenChatButton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useOrders, OrderStatus, Order } from '@/hooks/useOrders';
import { PDFGenerators, generatePickingManifestPDF } from '@/services/pdfGenerators';
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
  MapPin,
  Printer,
  FileText,
  Tag,
  Plane,
  Warehouse,
  Ship,
  PackageCheck,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
  placed: { label: 'Pendiente Pago', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  paid: { label: 'Pagado', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  preparing: { label: 'En Preparación', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Package },
  shipped: { label: 'Enviado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Truck },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400' },
  pending: { label: 'Procesando', color: 'bg-blue-500/20 text-blue-400' },
  pending_validation: { label: 'Pendiente Validación', color: 'bg-amber-500/20 text-amber-400' },
  paid: { label: 'Confirmado', color: 'bg-green-500/20 text-green-400' },
  failed: { label: 'Fallido', color: 'bg-red-500/20 text-red-400' },
  expired: { label: 'Expirado', color: 'bg-gray-500/20 text-gray-400' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400' },
};

const logisticsStageOptions = [
  { value: 'payment_pending', label: 'Pago Pendiente', icon: Clock },
  { value: 'payment_validated', label: 'Pago Validado', icon: CheckCircle },
  { value: 'in_china', label: 'En China', icon: Package },
  { value: 'in_transit_usa', label: 'Tránsito USA', icon: Plane },
  { value: 'in_haiti_hub', label: 'Hub Haití', icon: Warehouse },
  { value: 'ready_for_delivery', label: 'Listo Entrega', icon: PackageCheck },
  { value: 'delivered', label: 'Entregado', icon: CheckCircle },
];

const carrierOptions = [
  { value: 'DHL', label: 'DHL', url: 'https://www.dhl.com/en/express/tracking.html?AWB=' },
  { value: 'FedEx', label: 'FedEx', url: 'https://www.fedex.com/fedextrack/?trknbr=' },
  { value: 'UPS', label: 'UPS', url: 'https://www.ups.com/track?tracknum=' },
  { value: 'USPS', label: 'USPS', url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' },
  { value: 'Estafeta', label: 'Estafeta', url: 'https://rastreo3.estafeta.com/Tracking/searchByGet?wayBillType=1&wayBill=' },
  { value: 'other', label: 'Otra paquetería', url: '' },
];

const AdminPedidos = () => {
  const { t } = useTranslation();
  const { useAllOrders, useOrderStats, usePaidOrdersForManifest, updateOrderStatus, updateOrderTracking, updateLogisticsStage, cancelOrder, confirmManualPayment, rejectManualPayment } = useOrders();
  
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [logisticsStage, setLogisticsStage] = useState('');
  const [chinaTracking, setChinaTracking] = useState('');
  
  // Manifest dialog state
  const [showManifestDialog, setShowManifestDialog] = useState(false);
  const [manifestChinaTracking, setManifestChinaTracking] = useState('');
  
  // Tracking form state
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customCarrierUrl, setCustomCarrierUrl] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  
  // Payment confirmation state
  const [paymentConfirmationNotes, setPaymentConfirmationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Live query for selected order — ensures metadata (e.g. payment_proof_url) is always fresh
  const { data: liveSelectedOrder } = useQuery({
    queryKey: ['admin-order-live', selectedOrder?.id],
    enabled: !!selectedOrder?.id,
    refetchInterval: 5000, // poll every 5s so proof appears without reload
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders_b2b')
        .select('*, order_items_b2b (*), profiles:profiles!orders_b2b_seller_id_fkey (full_name, email), buyer_profile:profiles!orders_b2b_buyer_id_fkey (full_name, email)')
        .eq('id', selectedOrder!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Merge: use live data when available so proof_url is never stale
  const dialogOrder = liveSelectedOrder ? { ...selectedOrder, ...liveSelectedOrder } as typeof selectedOrder : selectedOrder;

  const { data: orders, isLoading } = useAllOrders({ status: statusFilter, search: searchTerm });
  const { data: stats } = useOrderStats();
  const { data: paidOrdersForManifest } = usePaidOrdersForManifest(manifestChinaTracking || undefined);

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(search) ||
      order.profiles?.full_name?.toLowerCase().includes(search) ||
      order.profiles?.email?.toLowerCase().includes(search)
    );
  });

  const handleUpdateStatus = async () => {
    if (selectedOrder && newStatus) {
      await updateOrderStatus.mutateAsync({ orderId: selectedOrder.id, status: newStatus });
      setSelectedOrder(null);
      setNewStatus('');
    }
  };

  const handleUpdateTracking = async () => {
    if (selectedOrder && trackingCarrier && trackingNumber) {
      const carrierOption = carrierOptions.find(c => c.value === trackingCarrier);
      const carrierUrl = trackingCarrier === 'other' ? customCarrierUrl : carrierOption?.url || '';
      
      await updateOrderTracking.mutateAsync({
        orderId: selectedOrder.id,
        carrier: trackingCarrier === 'other' ? 'Otro' : trackingCarrier,
        trackingNumber,
        carrierUrl,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      
      setSelectedOrder(null);
      resetTrackingForm();
    }
  };

  const resetTrackingForm = () => {
    setTrackingCarrier('');
    setTrackingNumber('');
    setCustomCarrierUrl('');
    setEstimatedDelivery('');
  };

  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status as OrderStatus);
    // Pre-fill logistics stage
    const metadata = order.metadata as any;
    setLogisticsStage(metadata?.logistics_stage || '');
    setChinaTracking(metadata?.china_tracking || '');
    // Pre-fill tracking info if exists
    if (metadata?.carrier) {
      const matchingCarrier = carrierOptions.find(c => c.value === metadata.carrier);
      setTrackingCarrier(matchingCarrier ? metadata.carrier : 'other');
      if (!matchingCarrier) setCustomCarrierUrl(metadata.carrier_url || '');
    }
    if (metadata?.tracking_number) setTrackingNumber(metadata.tracking_number);
    if (metadata?.estimated_delivery) setEstimatedDelivery(metadata.estimated_delivery);
  };

  const handleUpdateLogisticsStage = async () => {
    if (selectedOrder && logisticsStage) {
      await updateLogisticsStage.mutateAsync({ 
        orderId: selectedOrder.id, 
        logisticsStage,
        chinaTracking: chinaTracking || undefined
      });
    }
  };

  // Handle manual payment confirmation (for transfer, natcash, etc.)
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    try {
      await confirmManualPayment.mutateAsync({
        orderId: selectedOrder.id,
        paymentNotes: paymentConfirmationNotes || undefined,
      });
      setSelectedOrder(null);
      setPaymentConfirmationNotes('');
    } catch {
      // Error toast is handled by mutation.onError
    }
  };

  // Handle payment rejection
  const handleRejectPayment = async () => {
    if (!selectedOrder) return;
    try {
      await rejectManualPayment.mutateAsync({
        orderId: selectedOrder.id,
        rejectionReason: rejectionReason || 'Pago no verificado',
      });
      setSelectedOrder(null);
      setRejectionReason('');
    } catch {
      // Error toast is handled by mutation.onError
    }
  };

  // Generate Picking Manifest PDF
  const handleGeneratePickingManifest = () => {
    if (!paidOrdersForManifest || paidOrdersForManifest.length === 0) return;

    const customers = paidOrdersForManifest.map(order => {
      const metadata = order.metadata as any;
      const items = order.order_items_b2b || [];
      
      // Group items by product name to consolidate variants
      const groupedItems: Record<string, any> = {};
      items.forEach((item: any) => {
        const key = item.nombre;
        if (!groupedItems[key]) {
          groupedItems[key] = {
            product_name: item.nombre,
            image: metadata?.items_by_store?.[Object.keys(metadata?.items_by_store || {})[0]]?.items?.find((i: any) => i.sku === item.sku)?.image,
            sku: item.sku.split('-')[0],
            variants: []
          };
        }
        groupedItems[key].variants.push({
          color: item.color,
          size: item.size,
          quantity: item.cantidad
        });
      });

      return {
        customer_id: order.buyer_id || order.id,
        customer_name: order.buyer_profile?.full_name || metadata?.shipping_address?.full_name || 'Cliente',
        customer_phone: metadata?.shipping_address?.phone,
        commune: metadata?.shipping_address?.city || 'N/A',
        department: metadata?.shipping_address?.state || 'N/A',
        internal_tracking_id: metadata?.hybrid_tracking_id || `SIV-${order.id.slice(0, 8).toUpperCase()}`,
        items: Object.values(groupedItems),
        total_units: order.total_quantity
      };
    });

    generatePickingManifestPDF({
      china_tracking: manifestChinaTracking || 'CONSOLIDADO',
      arrival_date: new Date().toISOString(),
      customers
    });
    
    setShowManifestDialog(false);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (confirm('¿Estás seguro de cancelar este pedido?')) {
      await cancelOrder.mutateAsync(orderId);
      setSelectedOrder(null);
    }
  };

  // Print invoice/delivery guide
  const handlePrintInvoice = (order: Order) => {
    const metadata = order.metadata as any;
    const items = (order as any).order_items_b2b || [];
    
    PDFGenerators.generateInvoicePDF({
      id: order.id,
      order_number: order.id.slice(0, 8).toUpperCase(),
      customer_name: order.profiles?.full_name || 'Cliente',
      customer_phone: (order.metadata as any)?.shipping_address?.phone || '',
      customer_address: metadata?.shipping_address?.street_address,
      department: metadata?.shipping_address?.state,
      commune: metadata?.shipping_address?.city,
      items: items.map((item: any) => {
        const unitPrice = Number(item.precio_unitario || 0);
        const qty = Number(item.cantidad || 0);
        const lineTotal = Number(item.precio_total ?? (unitPrice * qty));
        return {
          sku: item.sku,
          nombre: item.nombre,
          cantidad: qty,
          precio_unitario: unitPrice,
          subtotal: lineTotal,
          color: item.color,
          size: item.size,
          image: item.image,
        };
      }),
      total_amount: order.total_amount,
      payment_method: order.payment_method || undefined,
      created_at: order.created_at,
      hybrid_tracking_id: metadata?.hybrid_tracking_id,
    });
  };

  // Print thermal label
  const handlePrintLabel = (order: Order) => {
    const metadata = order.metadata as any;
    
    PDFGenerators.generateThermalLabelPDF({
      hybridTrackingId: metadata?.hybrid_tracking_id || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      customerName: order.profiles?.full_name || 'Cliente',
      customerPhone: metadata?.shipping_address?.phone || '',
      commune: metadata?.shipping_address?.city || 'N/A',
      department: metadata?.shipping_address?.state || 'N/A',
      unitCount: order.total_quantity,
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <AdminLayout title={t('adminOrders.title')} subtitle={t('adminOrders.subtitle')}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Borradores</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-gray-500">{stats?.draft || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pend. Pago</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-yellow-500">{stats?.placed || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pagados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-500">{stats?.paid || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Enviados</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-500">{stats?.shipped || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Cancelados</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-500">{stats?.cancelled || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ingresos</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-500">${stats?.paidAmount?.toFixed(0) || '0'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, vendedor o email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="placed">Pendiente de Pago</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">ID Pedido</TableHead>
                    <TableHead className="text-muted-foreground">Vendedor</TableHead>
                    <TableHead className="text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-muted-foreground text-center">Productos</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                    <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No hay pedidos</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders?.map((order) => (
                      <TableRow key={order.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono text-sm text-foreground">
                          {order.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{order.profiles?.full_name || 'Sin nombre'}</p>
                            <p className="text-xs text-muted-foreground">{order.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(order.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-center text-foreground">
                          {order.total_quantity}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          ${Number(order.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(order.status as OrderStatus)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrintLabel(order)}
                              title="Imprimir Etiqueta"
                            >
                              <Tag className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrintInvoice(order)}
                              title="Imprimir Factura"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenOrder(order)}
                              title="Ver Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalle del Pedido
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID Pedido</p>
                  <p className="font-mono text-sm">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado Pedido</p>
                  {getStatusBadge(selectedOrder.status as OrderStatus)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado Pago</p>
                  <Badge className={paymentStatusConfig[selectedOrder.payment_status || 'draft']?.color || 'bg-gray-500/20 text-gray-400'}>
                    {paymentStatusConfig[selectedOrder.payment_status || 'draft']?.label || selectedOrder.payment_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <Badge variant="outline">
                    {(selectedOrder.metadata as any)?.order_type === 'b2b' ? 'B2B (Mayorista)' : 'B2C (Consumidor)'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendedor/Comprador</p>
                  <p className="text-sm font-medium">{selectedOrder.profiles?.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrder.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="text-sm">{format(new Date(selectedOrder.created_at), "dd MMMM yyyy, HH:mm", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Método de Pago</p>
                  <p className="text-sm capitalize">{selectedOrder.payment_method || 'No especificado'}</p>
                </div>
              </div>

              {/* MANUAL PAYMENT CONFIRMATION SECTION */}
              {selectedOrder.payment_status === 'pending_validation' && (
                <div className="p-4 bg-amber-500/10 rounded-lg space-y-4 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <p className="font-medium text-amber-500">Validación de Pago Manual Requerida</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    El cliente ha indicado que realizó el pago via <strong className="capitalize">{selectedOrder.payment_method}</strong>. 
                    Verifica el pago y confirma o rechaza.
                  </p>
                  
                  {/* Payment reference if available */}
                  {(selectedOrder.metadata as any)?.payment_reference && (
                    <div className="p-3 bg-background rounded border">
                      <p className="text-xs text-muted-foreground mb-1">Referencia de pago proporcionada:</p>
                      <p className="font-mono text-sm">{(selectedOrder.metadata as any).payment_reference}</p>
                    </div>
                  )}

                  {/* Payment proof upload/view - moved to standalone section below */}
                  
                  <div className="space-y-2">
                    <Label htmlFor="paymentNotes">Notas de confirmación (opcional)</Label>
                    <Input
                      id="paymentNotes"
                      placeholder="Ej: Verificado en cuenta bancaria..."
                      value={paymentConfirmationNotes}
                      onChange={(e) => setPaymentConfirmationNotes(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={confirmManualPayment.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {confirmManualPayment.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirmar Pago
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRejectPayment}
                      disabled={rejectManualPayment.isPending}
                      className="flex-1"
                    >
                      {rejectManualPayment.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Rechazar
                    </Button>
                  </div>
                </div>
              )}

              {/* COMPROBANTE DE PAGO - always visible for manual payment methods */}
              {selectedOrder.payment_method && selectedOrder.payment_method !== 'stripe' && (() => {
                const proofUrl = (dialogOrder?.metadata as any)?.payment_proof_url ?? null;
                return (
                  <div className="p-4 bg-muted/40 rounded-lg space-y-3 border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">Comprobante de Pago</p>
                      {proofUrl ? (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Subido</span>
                      ) : (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Pendiente</span>
                      )}
                    </div>
                    <PaymentProofUpload
                      orderId={selectedOrder.id}
                      existingUrl={proofUrl}
                      readOnly
                    />
                  </div>
                );
              })()}

              {/* Update Status - Only show if payment is already confirmed */}
              {selectedOrder.payment_status === 'paid' && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <p className="text-sm font-medium">Cambiar Estado del Pedido</p>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Pagado (Procesando)</SelectItem>
                        <SelectItem value="shipped">Enviado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleUpdateStatus}
                      disabled={updateOrderStatus.isPending || newStatus === selectedOrder.status}
                    >
                      {updateOrderStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tracking Info Section */}
              {(selectedOrder.status === 'paid' || selectedOrder.status === 'shipped') && (
                <div className="p-4 bg-purple-500/10 rounded-lg space-y-4 border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-purple-500" />
                    <p className="font-medium text-purple-500">Información de Envío</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="carrier">Paquetería</Label>
                      <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar paquetería" />
                        </SelectTrigger>
                        <SelectContent>
                          {carrierOptions.map((carrier) => (
                            <SelectItem key={carrier.value} value={carrier.value}>
                              {carrier.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="trackingNumber">Número de Guía</Label>
                      <Input
                        id="trackingNumber"
                        placeholder="Ej: 1234567890"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                    </div>
                    
                    {trackingCarrier === 'other' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="customUrl">URL de rastreo (opcional)</Label>
                        <Input
                          id="customUrl"
                          placeholder="https://..."
                          value={customCarrierUrl}
                          onChange={(e) => setCustomCarrierUrl(e.target.value)}
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="estimatedDelivery">Fecha estimada de entrega (opcional)</Label>
                      <Input
                        id="estimatedDelivery"
                        placeholder="Ej: 25 de Diciembre, 2024"
                        value={estimatedDelivery}
                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleUpdateTracking}
                    disabled={!trackingCarrier || !trackingNumber || updateOrderTracking.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {updateOrderTracking.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Truck className="h-4 w-4 mr-2" />
                    )}
                    Guardar y Marcar como Enviado
                  </Button>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">Productos ({selectedOrder.total_quantity})</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14"></TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.order_items_b2b?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="pr-0">
                            <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.nombre}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <Package className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.nombre}</p>
                              {(item.color || item.size) && (
                                <p className="text-sm font-semibold text-blue-600">{[item.color, item.size].filter(Boolean).join(' / ')}</p>
                              )}
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.cantidad}</TableCell>
                          <TableCell className="text-right">${Number(item.precio_unitario).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${(item.precio_total != null ? Number(item.precio_total) : Number(item.precio_unitario || 0) * Number(item.cantidad || 0)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Cost Breakdown */}
              {(() => {
                const meta = selectedOrder.metadata as any;
                const itemsSubtotal = Number(meta?.items_subtotal) || Number((selectedOrder as any).subtotal) || selectedOrder.order_items_b2b?.reduce((sum, item) => sum + (item.precio_total != null ? Number(item.precio_total) : Number(item.precio_unitario || 0) * Number(item.cantidad || 0)), 0) || 0;
                const shippingCost = Number(selectedOrder.shipping_cost_total_usd || meta?.shipping_cost || 0);
                const platformFee = Number(meta?.platform_fee || meta?.fee_plataforma || 0);
                const discount = Number(meta?.discount_amount || 0);
                const totalAmount = Number(selectedOrder.total_amount || 0);
                
                return (
                  <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal Productos</span>
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
                        <span className="text-muted-foreground">Fee Plataforma</span>
                        <span>${platformFee.toFixed(2)}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-500">
                        <span>Descuento</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Pagado por Cliente</span>
                      <span className="text-2xl font-bold text-primary">${totalAmount.toFixed(2)} {selectedOrder.currency}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notas</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Actions */}
              <DialogFooter className="flex-row gap-2">
                <OpenChatButton
                  orderId={selectedOrder.id}
                  orderType={(selectedOrder.metadata as any)?.order_type === 'b2b' ? 'b2b' : 'b2c'}
                  orderLabel={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                  navigateTo="admin"
                  size="sm"
                />
                {selectedOrder.status !== 'cancelled' && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    disabled={cancelOrder.isPending}
                  >
                    {cancelOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Cancelar Pedido
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPedidos;