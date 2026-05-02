import PartnerLayout from "@/components/partners/PartnerLayout";
import { useMyEarnings } from "@/hooks/useDriverPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props { variant: "driver" | "pickup"; }

export default function PartnerEarningsPage({ variant }: Props) {
  const { data: earnings, isLoading } = useMyEarnings();

  const totals = (earnings ?? []).reduce(
    (acc, e) => {
      const amt = Number(e.amount_usd ?? 0);
      acc.total += amt;
      if (e.status === "paid") acc.paid += amt;
      else acc.pending += amt;
      return acc;
    },
    { total: 0, paid: 0, pending: 0 },
  );

  return (
    <PartnerLayout variant={variant} title={variant === "driver" ? "Portal del Conductor" : "Portal del Punto de Recogida"}>
      <h2 className="text-xl font-bold mb-4">Mis ganancias</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" /> Total acumulado</div>
            <p className="text-2xl font-bold mt-1">${totals.total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4 text-emerald-600" /> Pagado</div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">${totals.paid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="h-4 w-4 text-amber-600" /> Pendiente</div>
            <p className="text-2xl font-bold mt-1 text-amber-600">${totals.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : earnings && earnings.length > 0 ? (
            earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm">{e.description ?? e.source_type}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "PPp", { locale: es })}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${Number(e.amount_usd).toFixed(2)}</p>
                  <Badge variant={e.status === "paid" ? "default" : "secondary"} className="text-xs">{e.status}</Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no tienes ganancias registradas.</p>
          )}
        </CardContent>
      </Card>
    </PartnerLayout>
  );
}
