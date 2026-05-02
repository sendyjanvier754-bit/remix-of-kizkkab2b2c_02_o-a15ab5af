import { useState } from "react";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { useMyPickupPoint, usePickupOrders, useUpdatePickupOrderStatus } from "@/hooks/usePickupPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { usePartnerChat } from "@/hooks/usePartnerChat";
import { Package, MessageCircle, Hash } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props { historyMode?: boolean; }

export default function PickupOrdersPage({ historyMode = false }: Props) {
  const { data: assignment, isLoading: loadingAssignment } = useMyPickupPoint();
  const [activeStatus, setActiveStatus] = useState(historyMode ? "delivered" : "shipped");
  const { data: orders, isLoading } = usePickupOrders(activeStatus);
  const update = useUpdatePickupOrderStatus();
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);

  const { chatId } = usePartnerChat({
    context: "partner_order",
    orderId: chatOrderId,
    title: chatOrderId ? `Pedido ${chatOrderId.slice(0, 8)}` : undefined,
    autoCreate: !!chatOrderId,
  });

  if (loadingAssignment) {
    return (
      <PartnerLayout variant="pickup" title="Portal del Punto de Recogida">
        <Skeleton className="h-32 w-full" />
      </PartnerLayout>
    );
  }

  if (!assignment) {
    return (
      <PartnerLayout variant="pickup" title="Portal del Punto de Recogida">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No estás asignado a ningún punto de recogida.</p>
          </CardContent>
        </Card>
      </PartnerLayout>
    );
  }

  const pickup = (assignment as any).pickup_points;
  const tabs = historyMode
    ? [{ value: "delivered", label: "Entregados" }, { value: "cancelled", label: "Cancelados" }]
    : [
        { value: "shipped", label: "En camino" },
        { value: "ready_for_pickup", label: "Listos" },
        { value: "delivered", label: "Entregados hoy" },
      ];

  return (
    <PartnerLayout variant="pickup" title="Portal del Punto de Recogida">
      <div className="mb-4">
        <h2 className="text-xl font-bold">{historyMode ? "Historial" : "Pedidos"}</h2>
        <p className="text-sm text-muted-foreground">{pickup?.name ?? "Punto de recogida"}</p>
      </div>

      <Tabs value={activeStatus} onValueChange={setActiveStatus}>
        <TabsList>
          {tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-2 mt-4">
            {isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : orders && orders.length > 0 ? (
              orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1">
                          <Hash className="h-3 w-3" /> {o.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(o.total_amount ?? 0).toFixed(2)} · {format(new Date(o.created_at), "PPp", { locale: es })}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">{o.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setChatOrderId(o.id)} className="gap-1">
                        <MessageCircle className="h-3.5 w-3.5" /> Chat
                      </Button>
                      {o.status === "shipped" && (
                        <Button size="sm" onClick={() => update.mutate({ orderId: o.id, status: "ready_for_pickup" })}>
                          Marcar listo
                        </Button>
                      )}
                      {o.status === "ready_for_pickup" && (
                        <Button size="sm" onClick={() => update.mutate({ orderId: o.id, status: "delivered" })}>
                          Entregar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">Sin pedidos en este estado.</CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!chatOrderId} onOpenChange={(o) => !o && setChatOrderId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chat del pedido {chatOrderId?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            {chatId ? <ChatWindow chatId={chatId} isStaff={false} /> : <Skeleton className="h-full w-full" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatOrderId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PartnerLayout>
  );
}
