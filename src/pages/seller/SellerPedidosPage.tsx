import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenChatButton } from '@/components/chat/OpenChatButton';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerReturnRequests, useUpdateReturnRequest, RETURN_STATUS_CONFIG, ReturnStatus } from '@/hooks/useOrderReturnRequests';
import { useOrders, OrderStatus, Order, PaymentStatus } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
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
  CreditCard,
  Smartphone,
  Banknote,
  Check,
  X,
  User,
  RotateCcw,
  BarChart2,
  TrendingUp,
  FileText,
  Store,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
  placed: { label: 'Pendiente Pago', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  paid: { label: 'Pagado', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  preparing: { label: 'En Preparación', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Package },
  shipped: { label: 'Enviado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Truck },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Procesando', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  pending_validation: { label: 'Por Validar', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertCircle },
  paid: { label: 'Pagado', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  failed: { label: 'Fallido', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  expired: { label: 'Expirado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
};

const paymentMethodConfig: Record<string, { label: string; icon: React.ElementType }> = {
  moncash: { label: 'MonCash', icon: Smartphone },
  natcash: { label: 'NatCash', icon: Smartphone },
  transfer: { label: 'Transferencia', icon: Banknote },
  cash: { label: 'Efectivo', icon: DollarSign },
  stripe: { label: 'Tarjeta', icon: CreditCard },
};

const SellerPedidosPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    useSellerB2CSales, 
    useB2CSalesStats, 
    cancelOrderWithRestore, 
    confirmManualPayment, 
    rejectManualPayment 
  } = useOrders();
  
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [returnActionOrder, setReturnActionOrder] = useState<any | null>(null);
  const [returnActionType, setReturnActionType] = useState<'accept' | 'reject' | 'mediate' | null>(null);
  const [returnActionNotes, setReturnActionNotes] = useState('');
  const [returnAmountApproved, setReturnAmountApproved] = useState('');
  const [returnSearchTerm, setReturnSearchTerm] = useState('');

  const { data: orders = [], isLoading } = useSellerB2CSales({ paymentStatus: paymentStatusFilter });
  const { data: returnRequests = [], isLoading: returnsLoading } = useSellerReturnRequests();
  const updateReturn = useUpdateReturnRequest();

  const pendingReturns = returnRequests.filter(r => r.status === 'pending');
  const { data: stats } = useB2CSalesStats();

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    return order.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredReturns = returnRequests.filter(r => {
    if (!returnSearchTerm) return true;
    return r.order_id.toLowerCase().includes(returnSearchTerm.toLowerCase())
      || r.reason.toLowerCase().includes(returnSearchTerm.toLowerCase());
  });

  const pendingValidationOrders = orders?.filter(o => o.payment_status === 'pending_validation') || [];

  // ── Product sales summary (reads from B2C order items) ───────────────────
  const productSales = useMemo(() => {
    const map: Record<string, { sku: string; nombre: string; qty: number; revenue: number; image?: string }> = {};
    (orders || []).forEach(order => {
      const items = (order as any).order_items_b2c || [];
      items.forEach((item: any) => {
        const key = item.sku || item.product_name || item.id;
        if (!map[key]) {
          map[key] = {
            sku: item.sku || '—',
            nombre: item.product_name || item.sku || 'Producto',
            qty: 0,
            revenue: 0,
            image: item.seller_catalog?.images?.[0] ?? item.image ?? undefined,
          };
        }
        map[key].qty += Number(item.quantity);
        map[key].revenue += Number(item.total_price);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const handleConfirmPayment = async () => {
    if (selectedOrder) {
      await confirmManualPayment.mutateAsync({ orderId: selectedOrder.id, paymentNotes });
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
      setPaymentNotes('');
    }
  };

  const handleRejectPayment = async () => {
    if (selectedOrder) {
      await rejectManualPayment.mutateAsync({ orderId: selectedOrder.id, rejectionReason });
      setRejectDialogOpen(false);
      setSelectedOrder(null);
      setRejectionReason('');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (confirm('¿Estás seguro de cancelar este pedido? Los productos se restaurarán al carrito del cliente.')) {
      await cancelOrderWithRestore.mutateAsync({ orderId, restoreToCart: true });
      setSelectedOrder(null);
    }
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

  const getPaymentStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const config = paymentStatusConfig[status];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return null;
    const config = paymentMethodConfig[method];
    if (!config) return <Badge variant="outline">{method}</Badge>;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getBuyerInfo = (order: Order) => {
    // orders_b2c stores shipping_address directly on the row (not inside metadata)
    const shippingAddress = (order as any).shipping_address
      || (order.metadata as Record<string, any> | null)?.shipping_address;
    return {
      name: shippingAddress?.full_name || order.buyer_profile?.full_name || 'Cliente',
      phone: shippingAddress?.phone || '',
      address: shippingAddress ? `${shippingAddress.street_address || ''}, ${shippingAddress.city || ''}`.replace(/^, |, $/, '') : '',
    };
  };

  return (
    <SellerLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards with Header */}
        <div className="bg-card border border-border rounded-lg md:mt-14">
          <div className="p-3">
            <div className="border-b pb-2 mb-3">
              <h1 className="text-lg font-bold text-foreground">{t('sellerOrders.title')}</h1>
            </div>
            <div className="grid grid-cols-5 gap-1 w-full">
              <Card className="bg-card border-border">
                <CardContent className="p-1.5 text-center">
                  <Package className="h-3 w-3 text-primary mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-foreground">{stats?.total || 0}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Total</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-1.5 text-center">
                  <AlertCircle className="h-3 w-3 text-orange-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-orange-500">{stats?.pending_validation || 0}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Por Validar</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-1.5 text-center">
                  <CheckCircle className="h-3 w-3 text-amber-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-amber-500">{stats?.paid || 0}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Pagados</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-1.5 text-center">
                  <Truck className="h-3 w-3 text-blue-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-blue-500">{stats?.shipped || 0}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Enviados</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-1.5 text-center">
                  <XCircle className="h-3 w-3 text-red-500 mx-auto mb-0.5" />
                  <div className="text-base md:text-lg font-bold text-red-500">{stats?.cancelled || 0}</div>
                  <p className="text-[8px] md:text-xs text-muted-foreground leading-tight">Cancelados</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Pending Validation Alert */}
        {pendingValidationOrders.length > 0 && (
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium text-orange-500">
                    {pendingValidationOrders.length} pedido(s) pendiente(s) de validación de pago
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revisa y confirma los pagos de MonCash, NatCash, Transferencia o Efectivo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs: Pedidos B2C | Mis Ventas | Devoluciones */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders" className="gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Pedidos B2C
              {pendingValidationOrders.length > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[9px] bg-amber-500 text-white ml-1">
                  {pendingValidationOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ventas" className="gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Mis Ventas
            </TabsTrigger>
            <TabsTrigger value="returns" className="gap-1.5 relative">
              <RotateCcw className="h-3.5 w-3.5" />
              Devoluciones
              {pendingReturns.length > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground ml-1">
                  {pendingReturns.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: PEDIDOS ────────────────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por ID de pedido..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select 
                    value={paymentStatusFilter} 
                    onValueChange={(v) => setPaymentStatusFilter(v as PaymentStatus | 'all')}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filtrar por estado de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending_validation">Por Validar</SelectItem>
                      <SelectItem value="pending">Procesando</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="failed">Fallido</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
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
                        <TableHead className="text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-muted-foreground">Fecha</TableHead>
                        <TableHead className="text-muted-foreground">Método</TableHead>
                        <TableHead className="text-muted-foreground text-right">Total</TableHead>
                        <TableHead className="text-muted-foreground text-center">Estado Pago</TableHead>
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
                            <p className="text-muted-foreground">No tienes ventas aún</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders?.map((order) => {
                          const buyer = getBuyerInfo(order);
                          return (
                            <TableRow 
                              key={order.id} 
                              className={`border-border hover:bg-muted/50 ${
                                order.payment_status === 'pending_validation' ? 'bg-orange-500/5' : ''
                              }`}
                            >
                              <TableCell className="font-mono text-sm text-foreground">
                                {order.id.substring(0, 8)}...
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{buyer.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(order.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                              </TableCell>
                              <TableCell>
                                {getPaymentMethodBadge(order.payment_method)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-foreground">
                                ${Number(order.total_amount).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                {getPaymentStatusBadge(order.payment_status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {order.payment_status === 'pending_validation' && (
                                    <>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                          setSelectedOrder(order);
                                          setConfirmDialogOpen(true);
                                        }}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedOrder(order);
                                          setRejectDialogOpen(true);
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedOrder(order)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: MIS VENTAS ─────────────────────────────────────────────── */}
          <TabsContent value="ventas" className="space-y-4 mt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">
                    ${(orders || []).reduce((s, o) => s + Number(o.total_amount), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Ingresos totales</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <ShoppingCart className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{(orders || []).length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos totales</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <Package className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">
                    {productSales.reduce((s, p) => s + p.qty, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Unidades vendidas</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <BarChart2 className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{productSales.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Productos únicos</p>
                </CardContent>
              </Card>
            </div>

            {/* Product sales table */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Ventas por Producto</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Producto</TableHead>
                        <TableHead className="text-muted-foreground text-center">SKU</TableHead>
                        <TableHead className="text-muted-foreground text-center">Cant. vendida</TableHead>
                        <TableHead className="text-muted-foreground text-right">Ingresos</TableHead>
                        <TableHead className="text-muted-foreground text-right">% del total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          </TableCell>
                        </TableRow>
                      ) : productSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            No hay ventas registradas aún
                          </TableCell>
                        </TableRow>
                      ) : (() => {
                        const totalRevenue = productSales.reduce((s, p) => s + p.revenue, 0);
                        return productSales.map((p, i) => (
                          <TableRow key={p.sku} className="border-border hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">#{i + 1}</span>
                                {p.image && (
                                  <img src={p.image} alt={p.nombre} className="w-8 h-8 rounded object-cover" />
                                )}
                                <span className="font-medium text-sm text-foreground">{p.nombre}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{p.qty} uds</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-foreground">
                              ${p.revenue.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {totalRevenue > 0 ? ((p.revenue / totalRevenue) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: DEVOLUCIONES ───────────────────────────────────────────── */}
          <TabsContent value="returns" className="space-y-4 mt-4">
            {pendingReturns.length > 0 && (
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-700">
                      {pendingReturns.length} solicitud(es) pendiente(s) de revisión
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search */}
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por pedido o motivo..."
                    className="pl-10"
                    value={returnSearchTerm}
                    onChange={(e) => setReturnSearchTerm(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Pedido</TableHead>
                        <TableHead className="text-muted-foreground">Tipo motivo</TableHead>
                        <TableHead className="text-muted-foreground">Descripción</TableHead>
                        <TableHead className="text-muted-foreground">Monto solicitado</TableHead>
                        <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                        <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          </TableCell>
                        </TableRow>
                      ) : filteredReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground text-sm">No hay solicitudes de devolución</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReturns.map((ret) => {
                          const cfg = RETURN_STATUS_CONFIG[ret.status as ReturnStatus];
                          return (
                            <TableRow key={ret.id} className="border-border hover:bg-muted/50">
                              <TableCell className="font-mono text-xs text-foreground">
                                {ret.order_id.slice(0, 8).toUpperCase()}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-foreground">{ret.reason_type || 'Sin tipo'}</p>
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className="text-xs text-muted-foreground line-clamp-2">{ret.reason}</p>
                              </TableCell>
                              <TableCell>
                                {ret.amount_requested
                                  ? <span className="font-medium">${Number(ret.amount_requested).toFixed(2)}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={`${cfg?.color} border-current text-xs`}>
                                  {cfg?.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {ret.status === 'pending' && (
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                      onClick={() => {
                                        setReturnActionOrder(ret);
                                        setReturnActionType('accept');
                                        setReturnAmountApproved(ret.amount_requested?.toString() || '');
                                        setReturnActionNotes('');
                                      }}
                                    >
                                      Aceptar
                                    </Button>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => {
                                        setReturnActionOrder(ret);
                                        setReturnActionType('reject');
                                        setReturnActionNotes('');
                                      }}
                                    >
                                      Rechazar
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-7 text-xs"
                                      title="Escalar a mediación admin"
                                      onClick={() => {
                                        setReturnActionOrder(ret);
                                        setReturnActionType('mediate');
                                        setReturnActionNotes('');
                                      }}
                                    >
                                      Mediar
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Order Detail Dialog ── */}
      <Dialog open={!!selectedOrder && !confirmDialogOpen && !rejectDialogOpen} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Detalle del Pedido B2C
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const buyer = getBuyerInfo(selectedOrder);
            const b2cItems = (selectedOrder as any).order_items_b2c as any[] | undefined;
            const shippingAddr = (selectedOrder as any).shipping_address as Record<string, any> | null;
            const paymentRef = (selectedOrder as any).payment_reference
              || (selectedOrder.metadata as Record<string, any> | null)?.payment_reference;
            return (
              <div className="space-y-5">
                {/* IDs + status row */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/40 rounded-lg border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ID Pedido</p>
                    <p className="font-mono text-sm select-all">{selectedOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha</p>
                    <p className="text-sm">{format(new Date(selectedOrder.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estado del pedido</p>
                    <div className="mt-0.5">{getStatusBadge(selectedOrder.status as OrderStatus)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estado de pago</p>
                    <div className="mt-0.5">{getPaymentStatusBadge(selectedOrder.payment_status) ?? <span className="text-muted-foreground text-sm">—</span>}</div>
                  </div>
                </div>

                {/* Buyer info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{buyer.name}</p>
                        {selectedOrder.buyer_profile?.email && (
                          <p className="text-xs text-muted-foreground">{selectedOrder.buyer_profile.email}</p>
                        )}
                        {buyer.phone && (
                          <p className="text-xs text-muted-foreground">{buyer.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Método de pago</p>
                    <div className="mt-0.5">{getPaymentMethodBadge(selectedOrder.payment_method) ?? <span className="text-muted-foreground text-sm">—</span>}</div>
                    {paymentRef && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">Ref: {paymentRef}</p>
                    )}
                  </div>
                </div>

                {/* Shipping address */}
                {shippingAddr && (
                  <div className="p-3 bg-muted/40 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Dirección de envío
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {shippingAddr.full_name && <div><span className="text-muted-foreground text-xs">Nombre: </span>{shippingAddr.full_name}</div>}
                      {shippingAddr.phone && <div><span className="text-muted-foreground text-xs">Tel: </span>{shippingAddr.phone}</div>}
                      {shippingAddr.street_address && <div className="col-span-2"><span className="text-muted-foreground text-xs">Dirección: </span>{shippingAddr.street_address}</div>}
                      {(shippingAddr.city || shippingAddr.state) && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">Ciudad: </span>
                          {[shippingAddr.city, shippingAddr.state, shippingAddr.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {shippingAddr.postal_code && <div><span className="text-muted-foreground text-xs">CP: </span>{shippingAddr.postal_code}</div>}
                      {shippingAddr.notes && <div className="col-span-2 text-muted-foreground text-xs italic">{shippingAddr.notes}</div>}
                    </div>
                  </div>
                )}

                {/* Order items */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Productos</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border bg-muted/30">
                          <TableHead className="text-muted-foreground text-xs">Producto</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-center">Cant.</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">P. Unit.</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!b2cItems || b2cItems.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">Sin productos</TableCell>
                          </TableRow>
                        ) : b2cItems.map((item: any) => {
                          const img = item.seller_catalog?.images?.[0] ?? item.image ?? null;
                          const name = item.product_name || item.seller_catalog?.nombre || item.sku || '—';
                          const sku = item.sku || item.seller_catalog?.sku || '—';
                          const variantInfo = item.variant_info as Record<string, any> | null;
                          return (
                            <TableRow key={item.id} className="border-border">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {img && <img src={img} alt={name} className="w-9 h-9 rounded object-cover shrink-0 border border-border" />}
                                  <div>
                                    <p className="font-medium text-sm">{name}</p>
                                    <p className="text-xs text-muted-foreground">SKU: {sku}</p>
                                    {variantInfo && Object.keys(variantInfo).length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {Object.entries(variantInfo).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                              <TableCell className="text-right text-sm">${Number(item.unit_price).toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium text-sm">${Number(item.total_price).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2 bg-muted/20 text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${(Number(selectedOrder.total_amount) - Number((selectedOrder as any).shipping_cost || 0)).toFixed(2)}</span>
                  </div>
                  {Number((selectedOrder as any).shipping_cost) > 0 && (
                    <div className="flex justify-between items-center px-4 py-2 border-t border-border text-sm">
                      <span className="text-muted-foreground">Envío</span>
                      <span>${Number((selectedOrder as any).shipping_cost).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-muted/30">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-foreground">${Number(selectedOrder.total_amount).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{selectedOrder.currency}</span></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <OpenChatButton
                    orderId={selectedOrder.id}
                    orderType="b2c"
                    orderLabel={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                    navigateTo="seller"
                    size="sm"
                  />
                  {selectedOrder.payment_status === 'pending_validation' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => setConfirmDialogOpen(true)}
                      >
                        <Check className="h-4 w-4 mr-1.5" />Confirmar Pago
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>
                        <X className="h-4 w-4 mr-1.5" />Rechazar Pago
                      </Button>
                    </>
                  )}
                  {(selectedOrder.status === 'draft' || selectedOrder.status === 'placed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      disabled={cancelOrderWithRestore.isPending}
                    >
                      {cancelOrderWithRestore.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Confirm Payment Dialog ── */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />Confirmar Pago
            </DialogTitle>
            <DialogDescription>¿Has verificado que el pago fue recibido correctamente?</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monto:</span>
                  <span className="font-bold text-lg">${Number(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">Método:</span>
                  {getPaymentMethodBadge(selectedOrder.payment_method)}
                </div>
                {(selectedOrder.metadata as Record<string, any>)?.payment_reference && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Referencia:</span>
                    <span className="font-mono text-sm">{(selectedOrder.metadata as Record<string, any>).payment_reference}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  placeholder="Ej: Verificado en MonCash, transacción #12345"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmPayment} disabled={confirmManualPayment.isPending}>
              {confirmManualPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Payment Dialog ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />Rechazar Pago
            </DialogTitle>
            <DialogDescription>El pedido será cancelado y el stock se liberará.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">
                  Esta acción cancelará el pedido #{selectedOrder.id.substring(0, 8)} por ${Number(selectedOrder.total_amount).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Motivo del rechazo</label>
                <Textarea
                  placeholder="Ej: No se recibió el pago, monto incorrecto, etc."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectPayment} disabled={rejectManualPayment.isPending}>
              {rejectManualPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
              Rechazar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Action Dialog ── */}
      <Dialog open={!!returnActionOrder} onOpenChange={() => setReturnActionOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {returnActionType === 'accept' && 'Aceptar Devolución'}
              {returnActionType === 'reject' && 'Rechazar Devolución'}
              {returnActionType === 'mediate' && 'Escalar a Mediación Admin'}
            </DialogTitle>
            <DialogDescription>
              {returnActionType === 'mediate' && 'Se notificará al administrador para mediar en esta disputa.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {returnActionType === 'accept' && (
              <div>
                <label className="text-xs text-muted-foreground">Monto a reembolsar</label>
                <Input
                  type="number"
                  value={returnAmountApproved}
                  onChange={(e) => setReturnAmountApproved(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">
                {returnActionType === 'reject' ? 'Razón del rechazo *' : 'Notas (opcional)'}
              </label>
              <Textarea
                value={returnActionNotes}
                onChange={(e) => setReturnActionNotes(e.target.value)}
                className="mt-1 min-h-[80px]"
                placeholder="Escribe aquí…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setReturnActionOrder(null)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={updateReturn.isPending}
              onClick={async () => {
                if (!returnActionOrder) return;
                if (returnActionType === 'reject' && !returnActionNotes.trim()) return;
                await updateReturn.mutateAsync({
                  id: returnActionOrder.id,
                  status: returnActionType === 'accept' ? 'accepted'
                        : returnActionType === 'reject' ? 'rejected'
                        : 'under_mediation',
                  seller_notes: returnActionNotes,
                  amount_approved: returnActionType === 'accept' && returnAmountApproved
                    ? parseFloat(returnAmountApproved) : undefined,
                });
                setReturnActionOrder(null);
              }}
            >
              {updateReturn.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
};

export default SellerPedidosPage;
