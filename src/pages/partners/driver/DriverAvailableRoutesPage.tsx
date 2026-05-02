import { useNavigate } from "react-router-dom";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { useAvailableRoutes, useAcceptRoute, useMyDriverProfile } from "@/hooks/useDriverPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, DollarSign, Truck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DriverAvailableRoutesPage() {
  const navigate = useNavigate();
  const { data: driver, isLoading: driverLoading } = useMyDriverProfile();
  const { data: routes, isLoading } = useAvailableRoutes();
  const accept = useAcceptRoute();

  if (driverLoading) {
    return (
      <PartnerLayout variant="driver" title="Portal del Conductor">
        <Skeleton className="h-32 w-full" />
      </PartnerLayout>
    );
  }

  if (!driver) {
    return (
      <PartnerLayout variant="driver" title="Portal del Conductor">
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Tu perfil de conductor aún no está activado.</p>
            <p className="text-xs text-muted-foreground mt-1">Espera la aprobación del administrador.</p>
          </CardContent>
        </Card>
      </PartnerLayout>
    );
  }

  const handleAccept = async (routeId: string) => {
    try {
      await accept.mutateAsync(routeId);
      navigate(`/socio/conductor/ruta/${routeId}`);
    } catch { /* toast handled */ }
  };

  return (
    <PartnerLayout variant="driver" title="Portal del Conductor">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Rutas disponibles</h2>
          <p className="text-sm text-muted-foreground">Acepta una ruta para iniciar las entregas.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : routes && routes.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {routes.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{r.route_code}</p>
                  </div>
                  <Badge variant="outline">{r.route_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{r.total_stops} paradas · {r.total_distance_km ?? 0} km</span>
                </div>
                {r.scheduled_for && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{format(new Date(r.scheduled_for), "PPp", { locale: es })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span>
                    {r.fee_type === "fixed" ? `$${Number(r.fee_amount).toFixed(2)} fijo` : `${r.fee_amount}% por entrega`}
                    {r.completion_bonus ? ` + $${Number(r.completion_bonus).toFixed(2)} bono` : ""}
                  </span>
                </div>
                <Button
                  className="w-full mt-2"
                  onClick={() => handleAccept(r.id)}
                  disabled={accept.isPending}
                >
                  Aceptar ruta
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay rutas disponibles en este momento.
          </CardContent>
        </Card>
      )}
    </PartnerLayout>
  );
}
