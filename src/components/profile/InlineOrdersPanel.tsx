/**
 * InlineOrdersPanel
 * Embeds the full orders experience (tabs, list, detail dialog, cancel dialog)
 * directly in the /perfil desktop layout — no redirect to /mis-compras needed.
 *
 * Reuses the exact same data hooks, components, and logic as MyPurchasesPage.
 */
/**
 * InlineOrdersPanel
 * Embeds the full orders experience (tabs, list, detail dialog, cancel dialog)
 * directly in the /perfil desktop layout — no redirect to /mis-compras needed.
 *
 * Reuses the exact same data hooks, components, and logic as MyPurchasesPage.
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import {
  useBuyerOrders,
  useCancelBuyerOrder,
  BuyerOrder,
  BuyerOrderStatus,
  RefundStatus,
  PaymentStatus,
} from "@/hooks/useBuyerOrders";
import { useBuyerB2COrders, BuyerB2COrder } from "@/hooks/useBuyerB2COrders";
import { useOrdersPOInfo, OrderPOInfo } from "@/hooks/useOrderPOInfo";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpenChatButton } from "@/components/chat/OpenChatButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Package, ShoppingBag, Truck, CheckCircle, XCircle, Clock, ExternalLink,
  ChevronRight, RefreshCw, AlertTriangle, Loader2, Ban, DollarSign,
  Plane, Ship, Warehouse, PackageCheck, Boxes, Store, MapPin, Calendar, RotateCcw,
} from "lucide-react";
import {
  useMyReturnRequests,
  useCreateReturnRequest,
  useOrderReturnStatus,
  RETURN_STATUS_CONFIG,
} from "@/hooks/useOrderReturnRequests";

// ── status config (mirrors MyPurchasesPage) ──────────────────────────────────
const statusConfig: Record<BuyerOrderStatus, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  draft:      { label: "Borrador",    color: "text-gray-600",    icon: <Clock className="h-4 w-4" />,       bgColor: "bg-gray-100"   },
  placed:     { label: "Confirmado",  color: "text-blue-600",    icon: <Package className="h-4 w-4" />,     bgColor: "bg-blue-100"   },
  paid:       { label: "Pagado",      color: "text-amber-600",   icon: <CheckCircle className="h-4 w-4" />, bgColor: "bg-amber-100"  },
  shipped:    { label: "En camino",   color: "text-purple-600",  icon: <Truck className="h-4 w-4" />,       bgColor: "bg-purple-100" },
  delivered:  { label: "Entregado",   color: "text-green-600",   icon: <CheckCircle className="h-4 w-4" />, bgColor: "bg-green-100"  },
  cancelled:  { label: "Cancelado",   color: "text-red-600",     icon: <XCircle className="h-4 w-4" />,     bgColor: "bg-red-100"    },
  in_transit: { label: "En tránsito", color: "text-indigo-600",  icon: <Truck className="h-4 w-4" />,       bgColor: "bg-indigo-100" },
  preparing:  { label: "Preparando",  color: "text-orange-600",  icon: <Package className="h-4 w-4" />,     bgColor: "bg-orange-100" },
};

const refundStatusConfig: Record<RefundStatus, { label: string; color: string; bgColor: string }> = {
  none:       { label: "Sin reembolso", color: "text-gray-600",  bgColor: "bg-gray-100"  },
  requested:  { label: "Solicitado",    color: "text-amber-600", bgColor: "bg-amber-100" },
  processing: { label: "En proceso",    color: "text-blue-600",  bgColor: "bg-blue-100"  },
  completed:  { label: "Completado",    color: "text-green-600", bgColor: "bg-green-100" },
  rejected:   { label: "Rechazado",     color: "text-red-600",   bgColor: "bg-red-100"   },
};

type LogisticsStage = 'payment_pending' | 'payment_validated' | 'in_china' | 'in_transit_usa' | 'in_haiti_hub' | 'ready_for_delivery' | 'delivered';

const logisticsStages: { key: LogisticsStage; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'payment_pending',    label: 'Pago Pendiente',      icon: <Clock className="h-4 w-4" />,        description: 'Esperando confirmación de pago' },
  { key: 'payment_validated',  label: 'Pago Validado',       icon: <CheckCircle className="h-4 w-4" />,  description: 'Tu pago fue confirmado' },
  { key: 'in_china',           label: 'En China',            icon: <Package className="h-4 w-4" />,      description: 'Producto en almacén de origen' },
  { key: 'in_transit_usa',     label: 'Tránsito USA',        icon: <Plane className="h-4 w-4" />,        description: 'En camino a Estados Unidos' },
  { key: 'in_haiti_hub',       label: 'Hub Haití',           icon: <Warehouse className="h-4 w-4" />,    description: 'Llegó al centro de distribución' },
  { key: 'ready_for_delivery', label: 'Listo para Entrega',  icon: <PackageCheck className="h-4 w-4" />, description: 'Disponible para recoger/entregar' },
  { key: 'delivered',          label: 'Entregado',           icon: <CheckCircle className="h-4 w-4" />,  description: 'Pedido completado' },
];

const carrierUrls: Record<string, string> = {
  "DHL":     "https://www.dhl.com/en/express/tracking.html?AWB=",
  "FedEx":   "https://www.fedex.com/fedextrack/?trknbr=",
  "UPS":     "https://www.ups.com/track?tracknum=",
  "USPS":    "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  "Estafeta":"https://rastreo3.estafeta.com/Tracking/searchByGet?wayBillType=1&wayBill=",
};

const getLogisticsStage = (order: BuyerOrder, poInfo?: OrderPOInfo): LogisticsStage => {
  if (order.status === 'delivered') return 'delivered';
  if (poInfo) {
    if (poInfo.arrived_hub_at) return 'in_haiti_hub';
    if (poInfo.shipped_to_haiti_at || poInfo.arrived_usa_at) return 'in_transit_usa';
    if (poInfo.shipped_from_china_at) return 'in_china';
  }
  const meta = order.metadata || {};
  if (meta.logistics_stage) return meta.logistics_stage as LogisticsStage;
  if (meta.ready_for_delivery) return 'ready_for_delivery';
  if (meta.arrived_haiti) return 'in_haiti_hub';
  if (meta.in_transit_usa || meta.tracking_number) return 'in_transit_usa';
  if (meta.shipped_from_china) return 'in_china';
  if (order.status === 'paid') return 'payment_validated';
  return 'payment_pending';
};

// ── STATUS TABS ───────────────────────────────────────────────────────────────
const STATUS_TABS: { value: BuyerOrderStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todos'       },
  { value: 'placed',    label: 'Confirmados' },
  { value: 'paid',      label: 'Pagados'     },
  { value: 'shipped',   label: 'En camino'   },
  { value: 'delivered', label: 'Entregados'  },
  { value: 'cancelled', label: 'Cancelados'  },
];

// ── ORDER CARD ────────────────────────────────────────────────────────────────
const OrderCard = ({
  order,
  onClick,
  poInfo,
  returnStatus,
}: { order: BuyerOrder; onClick: () => void; poInfo?: OrderPOInfo; returnStatus?: string | null }) => {
  const status = statusConfig[order.status] || statusConfig.draft;
  const itemCount = order.order_items_b2b?.length || 0;
  const firstItem = order.order_items_b2b?.[0];
  const isB2B = order.metadata?.order_type === 'b2b';
  const borderColor = {
    shipped: 'border-l-purple-500',
    delivered: 'border-l-green-500',
    paid: 'border-l-amber-500',
    placed: 'border-l-blue-500',
    cancelled: 'border-l-red-500',
  }[order.status] || 'border-l-gray-300';

  const returnCfg = returnStatus ? RETURN_STATUS_CONFIG[returnStatus as keyof typeof RETURN_STATUS_CONFIG] : null;

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer hover:shadow-md transition-all border-l-4 group ${borderColor}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2.5 rounded-xl ${status.bgColor} ${status.color} shrink-0`}>
              {status.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">
                  Pedido #{order.id.slice(0, 8).toUpperCase()}
                </span>
                <Badge variant="outline" className={`${status.color} border-current text-xs`}>
                  {status.label}
                </Badge>
                {isB2B ? (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs">
                    <Boxes className="h-3 w-3 mr-1" />B2B
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                    <Store className="h-3 w-3 mr-1" />B2C
                  </Badge>
                )}
                {/* Return request status badge */}
                {returnCfg && (
                  <Badge variant="outline" className={`${returnCfg.color} border-current text-xs gap-1`}>
                    <RotateCcw className="h-2.5 w-2.5" />
                    {returnCfg.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(order.created_at), "d 'de' MMMM, yyyy", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {firstItem?.nombre}{itemCount > 1 && ` y ${itemCount - 1} más`}
              </p>
              {poInfo && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Package className="h-3 w-3" />PO: {poInfo.po_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <p className="font-bold text-sm text-foreground">
                {order.currency} ${order.total_amount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.total_quantity} {order.total_quantity === 1 ? 'art.' : 'arts.'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
        {order.status === 'shipped' && order.metadata?.tracking_number && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs">
            <Truck className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-muted-foreground">Rastreo:</span>
            <span className="font-medium text-purple-600">{order.metadata.tracking_number}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── RETURN REQUEST DIALOG ─────────────────────────────────────────────────────
const ReturnRequestDialog = ({
  order, open, onClose, existingReturnStatus,
}: { order: BuyerOrder | null; open: boolean; onClose: () => void; existingReturnStatus?: string | null }) => {
  const [reason, setReason] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const createReturn = useCreateReturnRequest();

  const handleSubmit = async () => {
    if (!order || !reason.trim() || !reasonType) return;
    const isB2B = order.metadata?.order_type === 'b2b';
    await createReturn.mutateAsync({
      order_id: order.id,
      order_type: isB2B ? 'b2b' : 'b2c',
      seller_id: order.seller_id || undefined,
      reason,
      reason_type: reasonType,
      amount_requested: amountRequested ? parseFloat(amountRequested) : undefined,
    });
    setReason(''); setReasonType(''); setAmountRequested('');
    onClose();
  };

  if (!order) return null;
  if (existingReturnStatus) {
    const cfg = RETURN_STATUS_CONFIG[existingReturnStatus as keyof typeof RETURN_STATUS_CONFIG];
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />Solicitud de Devolución
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <Badge variant="outline" className={`${cfg?.color} border-current text-sm px-4 py-1.5`}>
              {cfg?.label || existingReturnStatus}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Ya existe una solicitud de devolución para este pedido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />Solicitar Devolución
          </DialogTitle>
          <DialogDescription>
            Pedido #{order.id.slice(0, 8).toUpperCase()} · ${order.total_amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={reasonType} onValueChange={setReasonType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de problema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producto_danado">Producto dañado / defectuoso</SelectItem>
                <SelectItem value="producto_incorrecto">Producto incorrecto recibido</SelectItem>
                <SelectItem value="no_llegó">Pedido no llegó</SelectItem>
                <SelectItem value="descripcion_incorrecta">No corresponde a la descripción</SelectItem>
                <SelectItem value="calidad">Problema de calidad</SelectItem>
                <SelectItem value="otro">Otro motivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción detallada *</Label>
            <Textarea
              placeholder="Describe el problema con detalle..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Monto a solicitar (opcional)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                className="pl-10"
                placeholder={order.total_amount.toString()}
                value={amountRequested}
                onChange={e => setAmountRequested(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Deja vacío para solicitar el monto total del pedido
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || !reasonType || createReturn.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {createReturn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── DETAIL DIALOG ─────────────────────────────────────────────────────────────
const OrderDetailDialog = ({
  order, open, onClose, onReorder, onCancelClick, onRequestReturn, poInfo, returnStatus,
}: {
  order: BuyerOrder | null;
  open: boolean;
  onClose: () => void;
  onReorder: (o: BuyerOrder) => void;
  onCancelClick: (o: BuyerOrder) => void;
  onRequestReturn: (o: BuyerOrder) => void;
  poInfo?: OrderPOInfo;
  returnStatus?: string | null;
}) => {
  if (!order) return null;

  const status = statusConfig[order.status] || statusConfig.draft;
  const carrier = order.metadata?.carrier || "";
  const trackingNumber = order.metadata?.tracking_number || "";
  const carrierBaseUrl = carrierUrls[carrier] || order.metadata?.carrier_url || "";
  const trackingUrl = carrierBaseUrl ? `${carrierBaseUrl}${trackingNumber}` : "";
  const canCancel = ['placed', 'paid'].includes(order.status);
  const refundStatus = (order.metadata?.refund_status as RefundStatus) || 'none';
  const isDelivered = order.status === 'delivered';
  const returnCfg = returnStatus ? RETURN_STATUS_CONFIG[returnStatus as keyof typeof RETURN_STATUS_CONFIG] : null;
  const refundConfig = refundStatusConfig[refundStatus];
  const isB2B = order.metadata?.order_type === 'b2b';

  const currentStage = getLogisticsStage(order, poInfo);

  type B2CStage = 'payment_pending' | 'payment_validated' | 'preparing' | 'shipped' | 'delivered';
  const b2cStages: { key: B2CStage; label: string; icon: React.ReactNode; description: string }[] = [
    { key: 'payment_pending',   label: 'Pago Pendiente',    icon: <Clock className="h-4 w-4" />,       description: 'Esperando confirmación de pago' },
    { key: 'payment_validated', label: 'Pago Confirmado',   icon: <CheckCircle className="h-4 w-4" />, description: 'Tu pago fue confirmado' },
    { key: 'preparing',         label: 'En Preparación',    icon: <Package className="h-4 w-4" />,     description: 'El vendedor está preparando tu pedido' },
    { key: 'shipped',           label: 'Enviado',           icon: <Truck className="h-4 w-4" />,       description: 'Tu pedido está en camino' },
    { key: 'delivered',         label: 'Entregado',         icon: <CheckCircle className="h-4 w-4" />, description: 'Pedido completado' },
  ];
  const currentB2CStage: B2CStage = (() => {
    if (order.status === 'delivered') return 'delivered';
    if (order.status === 'shipped' || order.status === 'in_transit') return 'shipped';
    if (order.status === 'preparing') return 'preparing';
    if (order.payment_status === 'paid' || order.status === 'paid') return 'payment_validated';
    return 'payment_pending';
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status.bgColor} ${status.color}`}>{status.icon}</div>
            <div>
              <span className="block">Pedido #{order.id.slice(0, 8).toUpperCase()}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`${status.color} border-current`}>{status.label}</Badge>
                {isB2B
                  ? <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs"><Boxes className="h-3 w-3 mr-1" />B2B</Badge>
                  : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs"><Store className="h-3 w-3 mr-1" />B2C</Badge>
                }
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* PO card */}
          {poInfo && (
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
                  <Boxes className="h-5 w-5" />Orden de Compra Consolidada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-indigo-600">Número de PO:</span>
                  <Badge className="bg-indigo-600 text-white">{poInfo.po_number}</Badge>
                </div>
                {poInfo.hybrid_tracking_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-indigo-600">ID Híbrido:</span>
                    <span className="font-mono text-sm text-indigo-800">{poInfo.hybrid_tracking_id}</span>
                  </div>
                )}
                {poInfo.china_tracking_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-indigo-600">Guía China:</span>
                    <span className="font-mono text-sm text-indigo-800">{poInfo.china_tracking_number}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-indigo-600">Estado PO:</span>
                  <Badge variant="outline" className="border-indigo-300 text-indigo-700">
                    {{ open: 'Abierta', closed: 'Cerrada', in_transit: 'En Tránsito', arrived_hub: 'En Hub' }[poInfo.po_status] || poInfo.po_status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logistics progress */}
          {order.status !== 'cancelled' && order.status !== 'draft' && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                  <Ship className="h-5 w-5" />Seguimiento en Tiempo Real
                  {poInfo && <Badge variant="outline" className="ml-2 text-xs border-blue-300">Sincronizado con PO</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {(isB2B ? logisticsStages : b2cStages).map((stage, index) => {
                    const arr = isB2B ? logisticsStages : b2cStages;
                    const currentKey = isB2B ? currentStage : currentB2CStage;
                    const currentIndex = arr.findIndex(s => s.key === currentKey);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = stage.key === currentKey;
                    return (
                      <div key={stage.key} className="flex items-start gap-3 mb-4 last:mb-0">
                        <div className="relative flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all
                            ${isCompleted ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}
                            ${isCurrent ? 'ring-4 ring-blue-200 animate-pulse' : ''}`}>
                            {stage.icon}
                          </div>
                          {index < arr.length - 1 && (
                            <div className={`w-0.5 h-8 ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className={`font-medium ${isCompleted ? 'text-blue-900' : 'text-gray-400'}`}>{stage.label}</p>
                          <p className={`text-sm ${isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>{stage.description}</p>
                          {isCurrent && order.metadata?.stage_updated_at && (
                            <p className="text-xs text-blue-500 mt-1">
                              Actualizado: {format(new Date(order.metadata.stage_updated_at), "d MMM, HH:mm", { locale: es })}
                            </p>
                          )}
                        </div>
                        {isCompleted && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {order.metadata?.payment_confirmed_at && (
                  <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                    <CheckCircle className="h-4 w-4" />
                    Pago validado el {format(new Date(order.metadata.payment_confirmed_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tracking */}
          {(order.status === 'shipped' || order.status === 'delivered') && trackingNumber && (
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                  <Truck className="h-5 w-5" />Guía de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paquetería</p>
                    <p className="font-semibold text-purple-900">{carrier || "No especificada"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Número de Guía</p>
                    <p className="font-mono font-semibold text-purple-900">{trackingNumber}</p>
                  </div>
                </div>
                {order.metadata?.estimated_delivery && (
                  <div className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded-lg">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span className="text-muted-foreground">Entrega estimada:</span>
                    <span className="font-medium">{order.metadata.estimated_delivery}</span>
                  </div>
                )}
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
                    <MapPin className="h-4 w-4" />
                    Rastrear en {carrier || "Paquetería"}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Productos ({order.order_items_b2b?.length || 0})
            </h4>
            <div className="space-y-2">
              {order.order_items_b2b?.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku} · Cant: {item.cantidad}</p>
                  </div>
                  <p className="font-semibold">${item.subtotal.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary">
              {order.currency} ${order.total_amount.toLocaleString()}
            </span>
          </div>

          {order.notes && (
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Cancellation */}
          {order.status === 'cancelled' && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-600" /><span className="font-medium text-red-700">Pedido Cancelado</span>
                </div>
                {order.metadata?.cancellation_reason && (
                  <p className="text-sm text-red-600"><span className="font-medium">Motivo:</span> {order.metadata.cancellation_reason}</p>
                )}
                {order.metadata?.cancelled_at && (
                  <p className="text-xs text-red-500">
                    Cancelado el {format(new Date(order.metadata.cancelled_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                )}
                {refundStatus !== 'none' && (
                  <div className="border-t border-red-200 pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">Estado del Reembolso</span>
                      </div>
                      <Badge className={`${refundConfig.bgColor} ${refundConfig.color}`}>{refundConfig.label}</Badge>
                    </div>
                    {order.metadata?.refund_amount && (
                      <p className="text-sm text-red-600 mt-2">Monto: {order.currency} ${order.metadata.refund_amount.toLocaleString()}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {order.status !== 'draft' && (
              <Button onClick={() => onReorder(order)} className="w-full" size="lg">
                <RefreshCw className="h-4 w-4 mr-2" />Volver a Comprar
              </Button>
            )}
            <OpenChatButton
              orderId={order.id}
              orderType={isB2B ? 'b2b' : 'b2c'}
              orderLabel={`Pedido #${order.id.slice(0, 8).toUpperCase()}`}
              fullWidth
              navigateTo="buyer"
            />
            {/* Solicitar Devolución — only for delivered orders */}
            {isDelivered && (
              returnCfg ? (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Devolución:</span>
                  </div>
                  <Badge variant="outline" className={`${returnCfg.color} border-current text-xs`}>
                    {returnCfg.label}
                  </Badge>
                </div>
              ) : (
                <Button
                  onClick={() => onRequestReturn(order)}
                  variant="outline"
                  className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                  size="lg"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />Solicitar Devolución
                </Button>
              )
            )}
            {canCancel && (
              <Button onClick={() => onCancelClick(order)} variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" size="lg">
                <XCircle className="h-4 w-4 mr-2" />Cancelar Pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── CANCEL DIALOG ─────────────────────────────────────────────────────────────
const CancelOrderDialog = ({
  order, open, onClose, onConfirm, isLoading,
}: {
  order: BuyerOrder | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, requestRefund: boolean) => void;
  isLoading: boolean;
}) => {
  const [reason, setReason] = useState('');
  const [requestRefund, setRequestRefund] = useState(false);
  if (!order) return null;
  const isPaid = order.status === 'paid';
  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason, requestRefund && isPaid);
      setReason('');
      setRequestRefund(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />Cancelar Pedido
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Por favor indica el motivo de la cancelación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de cancelación *</Label>
            <Textarea id="reason" placeholder="Escribe el motivo..." value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          </div>
          {isPaid && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <Checkbox id="refund" checked={requestRefund} onCheckedChange={c => setRequestRefund(c as boolean)} />
              <div className="space-y-1">
                <Label htmlFor="refund" className="font-medium text-amber-800 cursor-pointer">Solicitar reembolso</Label>
                <p className="text-xs text-amber-600">
                  Tu pedido ya fue pagado. Monto: {order.currency} ${order.total_amount.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Volver</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            Confirmar Cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export const InlineOrdersPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<BuyerOrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<BuyerOrder | null>(null);
  const [orderForReturn, setOrderForReturn] = useState<BuyerOrder | null>(null);

  const { data: b2bOrdersRaw = [], isLoading } = useBuyerOrders(statusFilter);
  const { data: b2cOrdersRaw = [], isLoading: isLoadingB2C } = useBuyerB2COrders();
  const cancelMutation = useCancelBuyerOrder();

  // Fetch user's return requests to build a map by order_id
  const { data: myReturns = [] } = useMyReturnRequests();
  const returnStatusByOrderId = useMemo(() => {
    const map: Record<string, string> = {};
    myReturns.forEach(r => { map[r.order_id] = r.status; });
    return map;
  }, [myReturns]);

  // Normalize B2C → BuyerOrder
  const normalizedB2C: BuyerOrder[] = useMemo(() =>
    b2cOrdersRaw.map((o: BuyerB2COrder) => ({
      id: o.id,
      seller_id: o.store_id || '',
      buyer_id: o.buyer_user_id,
      status: (o.status || 'placed') as BuyerOrderStatus,
      payment_status: (o.payment_status || 'pending') as PaymentStatus,
      total_amount: o.total_amount || 0,
      total_quantity: o.order_items_b2c?.reduce((s, i) => s + i.quantity, 0) || 0,
      currency: o.currency || 'USD',
      payment_method: o.payment_method,
      notes: o.notes,
      metadata: {
        order_type: 'b2c',
        store_name: o.store?.name,
        payment_reference: o.payment_reference,
        tracking_number: o.tracking_number,
        ...(o.metadata || {}),
      },
      created_at: o.created_at,
      updated_at: o.updated_at,
      order_items_b2b: o.order_items_b2c?.map(i => ({
        id: i.id,
        order_id: i.order_id,
        product_id: null,
        sku: i.sku || '',
        nombre: i.product_name,
        cantidad: i.quantity,
        precio_unitario: i.unit_price,
        descuento_percent: null,
        subtotal: i.total_price,
        image: (i.metadata as any)?.image || null,
      })) || [],
    })),
    [b2cOrdersRaw]
  );

  const allOrders = useMemo(() => {
    const merged = [...b2bOrdersRaw, ...normalizedB2C];
    const filtered = statusFilter === 'all' ? merged : merged.filter(o => o.status === statusFilter);
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [b2bOrdersRaw, normalizedB2C, statusFilter]);

  const orderIds = useMemo(() => b2bOrdersRaw.map(o => o.id), [b2bOrdersRaw]);
  const { data: poInfoMap } = useOrdersPOInfo(orderIds);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('profile-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders_b2b', filter: `buyer_id=eq.${user.id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
        if (selectedOrder && payload.new && (payload.new as any).id === selectedOrder.id) {
          const u = payload.new as any;
          setSelectedOrder(prev => prev ? { ...prev, status: u.status, payment_status: u.payment_status, metadata: u.metadata, updated_at: u.updated_at } : null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient, selectedOrder]);

  const handleReorder = (order: BuyerOrder) => {
    if (!order.order_items_b2b?.length) {
      toast({ title: "No hay productos para agregar", variant: "destructive" });
      return;
    }
    order.order_items_b2b.forEach(item => {
      for (let i = 0; i < item.cantidad; i++) {
        addItem({ id: item.product_id || item.sku, name: item.nombre, price: item.precio_unitario, image: '', sku: item.sku });
      }
    });
    toast({ title: "Productos agregados al carrito", description: `${order.order_items_b2b.length} productos añadidos` });
    setSelectedOrder(null);
    navigate('/carrito');
  };

  const handleCancelClick = (order: BuyerOrder) => {
    setSelectedOrder(null);
    setOrderToCancel(order);
  };

  const handleRequestReturn = (order: BuyerOrder) => {
    setSelectedOrder(null);
    setOrderForReturn(order);
  };

  const handleCancelConfirm = async (reason: string, requestRefund: boolean) => {
    if (!orderToCancel) return;
    await cancelMutation.mutateAsync({ orderId: orderToCancel.id, reason, requestRefund });
    setOrderToCancel(null);
  };

  const isLoadingAll = isLoading || isLoadingB2C;

  return (
    <div className="bg-background border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-foreground">Mis Pedidos</h2>
        <span className="text-xs text-muted-foreground">{allOrders.length} pedido{allOrders.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Status tabs */}
      <div className="flex overflow-x-auto border-b border-border no-scrollbar">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
              ${statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div className="p-4 space-y-3">
        {isLoadingAll ? (
          [1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))
        ) : allOrders.length > 0 ? (
          allOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => setSelectedOrder(order)}
              poInfo={poInfoMap?.[order.id]}
              returnStatus={returnStatusByOrderId[order.id] || null}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <ShoppingBag className="w-10 h-10 opacity-25" />
            <p className="text-sm">No tienes pedidos en esta categoría</p>
            <Link to="/">
              <Button size="sm" variant="outline" className="mt-1">
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />Ir a la Tienda
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <OrderDetailDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onReorder={handleReorder}
        onCancelClick={handleCancelClick}
        onRequestReturn={handleRequestReturn}
        poInfo={selectedOrder ? poInfoMap?.[selectedOrder.id] : undefined}
        returnStatus={selectedOrder ? (returnStatusByOrderId[selectedOrder.id] || null) : null}
      />
      <ReturnRequestDialog
        order={orderForReturn}
        open={!!orderForReturn}
        onClose={() => setOrderForReturn(null)}
        existingReturnStatus={orderForReturn ? (returnStatusByOrderId[orderForReturn.id] || null) : null}
      />
      <CancelOrderDialog
        order={orderToCancel}
        open={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={handleCancelConfirm}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
};

export default InlineOrdersPanel;
