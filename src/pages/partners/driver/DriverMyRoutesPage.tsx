import { Link } from "react-router-dom";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { useMyRoutes } from "@/hooks/useDriverPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  accepted: "bg-blue-500/15 text-blue-600",
  in_progress: "bg-amber-500/15 text-amber-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/15 text-destructive",
};

export default function DriverMyRoutesPage() {
  const { data: routes, isLoading } = useMyRoutes();

  return (
    <PartnerLayout variant="driver" title="Portal del Conductor">
      <h2 className="text-xl font-bold mb-4">Mis rutas</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : routes && routes.length > 0 ? (
        <div className="space-y-2">
          {routes.map((r) => (
            <Link key={r.id} to={`/socio/conductor/ruta/${r.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.completed_stops}/{r.total_stops} paradas
                        {r.scheduled_for && ` · ${format(new Date(r.scheduled_for), "PP", { locale: es })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[r.status] ?? "bg-muted"} variant="secondary">
                      {r.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aún no tienes rutas aceptadas.
          </CardContent>
        </Card>
      )}
    </PartnerLayout>
  );
}
