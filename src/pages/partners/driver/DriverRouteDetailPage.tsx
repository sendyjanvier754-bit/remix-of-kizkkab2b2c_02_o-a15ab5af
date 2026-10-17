import { useParams, Link } from "react-router-dom";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { useRouteDetail, useCompleteStop } from "@/hooks/useDriverPortal";
import { usePartnerChat } from "@/hooks/usePartnerChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, MapPin, Phone, CheckCircle2 } from "lucide-react";

export default function DriverRouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const { route, stops } = useRouteDetail(routeId ?? null);
  const completeStop = useCompleteStop();
  const { chatId } = usePartnerChat({
    context: "partner_route",
    routeId: routeId ?? null,
    title: route.data ? `Ruta ${route.data.route_code}` : undefined,
  });

  return (
    <PartnerLayout variant="driver" title="Portal del Conductor">
      <Link to="/socio/conductor/mis-rutas" className="inline-flex items-center text-sm text-muted-foreground mb-3 hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Volver
      </Link>

      {route.isLoading || !route.data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{route.data.name}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono">{route.data.route_code}</p>
              </div>
              <Badge variant="outline">{route.data.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {route.data.completed_stops}/{route.data.total_stops} paradas completadas
            {route.data.notes && <p className="mt-2">{route.data.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stops">
        <TabsList>
          <TabsTrigger value="stops">Paradas</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="stops" className="space-y-2 mt-4">
          {stops.isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : stops.data && stops.data.length > 0 ? (
            stops.data.map((s) => {
              const done = s.status === "completed";
              return (
                <Card key={s.id} className={done ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                        {s.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{s.stop_type}</Badge>
                          {done && (
                            <Badge className="bg-emerald-500/15 text-emerald-600" variant="secondary">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Completada
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium mt-1">{s.contact_name ?? "—"}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.address ?? "Sin dirección"}
                        </p>
                        {s.contact_phone && (
                          <a href={`tel:${s.contact_phone}`} className="text-sm text-primary flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {s.contact_phone}
                          </a>
                        )}
                        {!done && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => completeStop.mutate({ stopId: s.id })}
                            disabled={completeStop.isPending}
                          >
                            Marcar como completada
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Esta ruta aún no tiene paradas.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <div className="h-[600px]">
            {chatId ? (
              <ChatWindow chatId={chatId} isStaff={false} />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PartnerLayout>
  );
}
