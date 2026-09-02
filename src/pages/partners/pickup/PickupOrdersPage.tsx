import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { PickupOrder, useMyPickupPoint, usePickupOrders, useUpdatePickupOrderStatus } from "@/hooks/usePickupPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { usePartnerChat } from "@/hooks/usePartnerChat";
import { Package, MessageCircle, Hash, Search, CheckCircle2, Clock3, CreditCard, MapPin, Phone, UserRound, Truck, AlertCircle, Copy, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props { historyMode?: boolean; }

export default function PickupOrdersPage({ historyMode = false }: Props) {
  const { t } = useTranslation();
  const { data: assignment, isLoading: loadingAssignment } = useMyPickupPoint();
  const [activeStatus, setActiveStatus] = useState(historyMode ? "delivered" : "shipped");
  const { data: orders = [], isLoading } = usePickupOrders(activeStatus);
  const update = useUpdatePickupOrderStatus();
  const [selectedOrder, setSelectedOrder] = useState<PickupOrder | null>(null);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { chatId } = usePartnerChat({
    context: "partner_order",
    orderId: chatOrderId,
    title: chatOrderId ? `${t("pagesExtra.pickupPortal.order")} ${chatOrderId.slice(0, 8)}` : undefined,
    autoCreate: !!chatOrderId,
  });

  const pickup = (assignment as any)?.pickup_points;
  const tabs = historyMode
    ? [{ value: "delivered", label: t("pagesExtra.pickupPortal.delivered") }, { value: "cancelled", label: t("pagesExtra.pickupPortal.cancelled") }]
    : [
        { value: "shipped", label: t("pagesExtra.pickupPortal.inTransit") },
        { value: "ready_for_pickup", label: t("pagesExtra.pickupPortal.ready") },
        { value: "delivered", label: t("pagesExtra.pickupPortal.deliveredToday") },
      ];

  const visibleOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => [order.id, order.order_number, order.shipping_address?.full_name, order.shipping_address?.phone, order.delivery?.delivery_code].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [orders, searchTerm]);

  const stats = useMemo(() => ({
    total: orders.length,
    paid: orders.filter((order) => order.payment_status === "paid").length,
    awaiting: orders.filter((order) => order.payment_status !== "paid").length,
  }), [orders]);

  if (loadingAssignment) return <PartnerLayout variant="pickup" title={t("pagesExtra.pickupPortal.title")}><Skeleton className="h-32 w-full" /></PartnerLayout>;

  if (!assignment) {
    return <PartnerLayout variant="pickup" title={t("pagesExtra.pickupPortal.title")}><Card><CardContent className="py-12 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-muted-foreground">{t("pagesExtra.pickupPortal.noAssignment")}</p></CardContent></Card></PartnerLayout>;
  }

  const paymentLabel = (status: string | null) => status === "paid" ? t("pagesExtra.pickupPortal.paid") : status === "pending_validation" ? t("pagesExtra.pickupPortal.pendingValidation") : t("pagesExtra.pickupPortal.pendingPayment");
  const paymentIcon = (status: string | null) => status === "paid" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />;
  const address = selectedOrder?.shipping_address;
  const formatMoney = (amount: number | null, currency = "USD") => `${currency} ${Number(amount ?? 0).toFixed(2)}`;

  return (
    <PartnerLayout variant="pickup" title={t("pagesExtra.pickupPortal.title")}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm text-muted-foreground">{pickup?.name ?? t("pagesExtra.pickupPortal.pickupPoint")}</p><h2 className="text-2xl font-bold tracking-tight">{historyMode ? t("pagesExtra.pickupPortal.history") : t("pagesExtra.pickupPortal.inbox")}</h2><p className="text-sm text-muted-foreground mt-1">{t("pagesExtra.pickupPortal.subtitle")}</p></div>
          <div className="relative w-full md:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t("pagesExtra.pickupPortal.searchPlaceholder")} className="pl-9" /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3"><Package className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.visibleOrders")}</p><p className="text-xl font-semibold">{stats.total}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.paidOrders")}</p><p className="text-xl font-semibold">{stats.paid}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><AlertCircle className="h-5 w-5 text-amber-600" /><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.paymentReview")}</p><p className="text-xl font-semibold">{stats.awaiting}</p></div></CardContent></Card>
        </div>

        <Tabs value={activeStatus} onValueChange={setActiveStatus}>
          <TabsList className="w-full justify-start overflow-x-auto"><div className="flex">{tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</div></TabsList>
          {tabs.map((tab) => <TabsContent key={tab.value} value={tab.value} className="space-y-3 mt-4">
            {isLoading ? [1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />) : visibleOrders.length > 0 ? visibleOrders.map((order) => {
              const buyer = order.shipping_address?.full_name || t("pagesExtra.pickupPortal.customer");
              const paid = order.payment_status === "paid";
              return <Card key={order.id} className="overflow-hidden"><CardContent className="p-0"><div className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3 min-w-0"><div className="p-2.5 rounded-lg bg-primary/10 shrink-0"><Package className="h-5 w-5 text-primary" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{order.order_number || `${t("pagesExtra.pickupPortal.order")} #${order.id.slice(0, 8)}`}</p><Badge variant="outline" className={paid ? "gap-1 border-emerald-500/40 text-emerald-700" : "gap-1 border-amber-500/40 text-amber-700"}>{paymentIcon(order.payment_status)}{paymentLabel(order.payment_status)}</Badge></div><p className="text-sm mt-1">{buyer} · {order.items.length} {t("pagesExtra.pickupPortal.itemCount")}</p><p className="text-xs text-muted-foreground mt-1">{formatMoney(order.total_amount, order.currency ?? "USD")} · {format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p><div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{order.delivery?.delivery_code || t("pagesExtra.pickupPortal.noCode")}</span>{order.tracking_number && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{order.tracking_number}</span>}</div></div></div><div className="flex gap-2 shrink-0"><Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>{t("pagesExtra.pickupPortal.viewDetails")}</Button>{order.status === "shipped" && <Button size="sm" disabled={!paid || update.isPending} onClick={() => update.mutate({ orderId: order.id, status: "ready_for_pickup", deliveryId: order.delivery?.id })}>{t("pagesExtra.pickupPortal.markReady")}</Button>}{order.status === "ready_for_pickup" && <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ orderId: order.id, status: "delivered", deliveryId: order.delivery?.id })}>{t("pagesExtra.pickupPortal.confirmPickup")}</Button>}</div></div>{!paid && order.status === "shipped" && <div className="border-t border-border bg-amber-500/5 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{t("pagesExtra.pickupPortal.paymentRequired")}</div>}</CardContent></Card>;
            }) : <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>{t("pagesExtra.pickupPortal.noOrders")}</p></CardContent></Card>}
          </TabsContent>)}
        </Tabs>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{t("pagesExtra.pickupPortal.orderDetails")}</DialogTitle><DialogDescription>{selectedOrder?.order_number || selectedOrder?.id}</DialogDescription></DialogHeader>
          {selectedOrder && <div className="space-y-5"><div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-4"><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.payment")}</p><Badge variant="outline" className="mt-1 gap-1">{paymentIcon(selectedOrder.payment_status)}{paymentLabel(selectedOrder.payment_status)}</Badge></div><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.total")}</p><p className="font-semibold mt-1">{formatMoney(selectedOrder.total_amount, selectedOrder.currency ?? "USD")}</p></div><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.method")}</p><p className="text-sm mt-1">{selectedOrder.payment_method || t("pagesExtra.pickupPortal.notAvailable")}</p></div><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.date")}</p><p className="text-sm mt-1">{format(new Date(selectedOrder.created_at), "dd MMM yyyy, HH:mm", { locale: es })}</p></div></div>
            <section><h3 className="font-semibold mb-2 flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" />{t("pagesExtra.pickupPortal.recipient")}</h3><div className="rounded-lg border border-border p-3 text-sm space-y-1"><p className="font-medium">{address?.full_name || t("pagesExtra.pickupPortal.customer")}</p>{address?.phone && <p className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{address.phone}</p>}{address?.street_address && <p className="text-muted-foreground flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{[address.street_address, address.city, address.state].filter(Boolean).join(", ")}</p>}</div></section>
            <section><h3 className="font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t("pagesExtra.pickupPortal.packageContents")}</h3><div className="divide-y divide-border rounded-lg border border-border">{selectedOrder.items.map((item) => <div key={item.id} className="p-3 flex items-start justify-between gap-3 text-sm"><div><p className="font-medium">{item.product_name}</p><p className="text-xs text-muted-foreground">{item.sku || "—"}{item.variant_info ? ` · ${typeof item.variant_info === "string" ? item.variant_info : JSON.stringify(item.variant_info)}` : ""}</p></div><div className="text-right shrink-0"><p>x{item.quantity}</p><p className="text-xs text-muted-foreground">{formatMoney(item.total_price, selectedOrder.currency ?? "USD")}</p></div></div>)}</div></section>
            {selectedOrder.delivery && <section><h3 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t("pagesExtra.pickupPortal.pickupSecurity")}</h3><div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3"><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.deliveryCode")}</p><p className="font-mono font-semibold mt-1 flex items-center gap-1">{selectedOrder.delivery.delivery_code || "—"}<Copy className="h-3 w-3 text-muted-foreground" /></p></div><div><p className="text-xs text-muted-foreground">{t("pagesExtra.pickupPortal.customerPin")}</p><p className="font-mono font-semibold mt-1">{selectedOrder.delivery.security_pin || "—"}</p></div></div></section>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedOrder(null)}>{t("pagesExtra.pickupPortal.close")}</Button><Button variant="outline" onClick={() => { if (selectedOrder) setChatOrderId(selectedOrder.id); setSelectedOrder(null); }} className="gap-1"><MessageCircle className="h-4 w-4" />{t("pagesExtra.pickupPortal.openChat")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!chatOrderId} onOpenChange={(open) => !open && setChatOrderId(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{t("pagesExtra.pickupPortal.orderChat")} {chatOrderId?.slice(0, 8)}</DialogTitle></DialogHeader><div className="h-[500px]">{chatId ? <ChatWindow chatId={chatId} isStaff={false} /> : <Skeleton className="h-full w-full" />}</div><DialogFooter><Button variant="outline" onClick={() => setChatOrderId(null)}>{t("pagesExtra.pickupPortal.close")}</Button></DialogFooter></DialogContent></Dialog>
    </PartnerLayout>
  );
}
