import { useState } from 'react';
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
  User
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

  const { data: orders, isLoading } = useSellerB2CSales({ paymentStatus: paymentStatusFilter });
  const { data: stats } = useB2CSalesStats();

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    return order.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const pendingValidationOrders = orders?.filter(o => o.payment_status === 'pending_validation') || [];

  const handleConfirmPayment = async () => {
    if (selectedOrder) {
      await confirmManualPayment.mutateAsync({ 
        orderId: selectedOrder.id, 
        paymentNotes 
      });
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
      setPaymentNotes('');
    }
  };

  const handleRejectPayment = async () => {
    if (selectedOrder) {
      await rejectManualPayment.mutateAsync({ 
        orderId: selectedOrder.id, 
        rejectionReason 
      });
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
    const metadata = order.metadata as Record<string, any> | null;
    const shippingAddress = metadata?.shipping_address;
    return {
      name: shippingAddress?.full_name || order.buyer_profile?.full_name || 'Cliente',
      phone: shippingAddress?.phone || '',
      address: shippingAddress ? `${shippingAddress.street_address}, ${shippingAddress.city}` : '',
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
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !confirmDialogOpen && !rejectDialogOpen} onOpenChange={(open) => !open && setSelectedOrder(null)}>
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
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(selectedOrder.status as OrderStatus)}
                    {getPaymentStatusBadge(selectedOrder.payment_status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{getBuyerInfo(selectedOrder).name}</p>
                  {getBuyerInfo(selectedOrder).phone && (
                    <p className="text-xs text-muted-foreground">{getBuyerInfo(selectedOrder).phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="text-sm">{format(new Date(selectedOrder.created_at), "dd MMMM yyyy, HH:mm", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Método de Pago</p>
                  {getPaymentMethodBadge(selectedOrder.payment_method)}
                </div>
                {getBuyerInfo(selectedOrder).address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Dirección</p>
                    <p className="text-sm">{getBuyerInfo(selectedOrder).address}</p>
                  </div>
                )}
              </div>

              {/* Payment Reference */}
              {(selectedOrder.metadata as Record<string, any>)?.payment_reference && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Referencia de pago del cliente:</p>
                  <p className="font-mono text-sm">{(selectedOrder.metadata as Record<string, any>).payment_reference}</p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">Productos</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.order_items_b2b?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          </TableCell>
                          <TableCell className="text-center">{item.cantidad}</TableCell>
                          <TableCell className="text-right">${Number(item.precio_unitario).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${Number(item.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">${Number(selectedOrder.total_amount).toFixed(2)} {selectedOrder.currency}</span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <OpenChatButton
                  orderId={selectedOrder.id}
                  orderType={(selectedOrder.metadata as any)?.order_type === 'b2b' ? 'b2b' : 'b2c'}
                  orderLabel={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                  navigateTo="seller"
                  size="sm"
                />
                {selectedOrder.payment_status === 'pending_validation' && (
                  <>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setConfirmDialogOpen(true)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Confirmar Pago
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rechazar Pago
                    </Button>
                  </>
                )}
                {(selectedOrder.status === 'draft' || selectedOrder.status === 'placed') && (
                  <Button
                    variant="outline"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    disabled={cancelOrderWithRestore.isPending}
                  >
                    {cancelOrderWithRestore.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Cancelar Pedido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Confirmar Pago
            </DialogTitle>
            <DialogDescription>
              ¿Has verificado que el pago fue recibido correctamente?
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmPayment}
              disabled={confirmManualPayment.isPending}
            >
              {confirmManualPayment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Payment Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rechazar Pago
            </DialogTitle>
            <DialogDescription>
              El pedido será cancelado y el stock se liberará.
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">
                  Esta acción cancelará el pedido #{selectedOrder.id.substring(0, 8)} 
                  por ${Number(selectedOrder.total_amount).toFixed(2)}
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
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectPayment}
              disabled={rejectManualPayment.isPending}
            >
              {rejectManualPayment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Rechazar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
};

export default SellerPedidosPage;
