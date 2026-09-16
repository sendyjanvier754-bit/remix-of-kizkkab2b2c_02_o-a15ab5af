import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MousePointerClick, Users, ShoppingBag, Percent, DollarSign, CheckCircle2 } from "lucide-react";
import { useMyAffiliate } from "@/hooks/useAffiliates";

type RangeKey = "7" | "30" | "90" | "all";

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

const rangeStart = (range: RangeKey) => {
  if (range === "all") return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return date.toISOString();
};

export default function InfluencerStatsPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const { data: affiliate, isLoading: loadingAffiliate } = useMyAffiliate();

  const { data, isLoading } = useQuery({
    queryKey: ["my-affiliate-stats", affiliate?.id, range],
    enabled: !!affiliate?.id,
    queryFn: async () => {
      const since = rangeStart(range);

      let clicksQuery = supabase
        .from("affiliate_clicks")
        .select("visitor_id, created_at")
        .eq("affiliate_id", affiliate!.id);
      let conversionsQuery = supabase
        .from("affiliate_conversions")
        .select("customer_id, sale_amount, commission_earned, paid_amount, payout_status, created_at")
        .eq("affiliate_id", affiliate!.id)
        .order("created_at", { ascending: false });

      if (since) {
        clicksQuery = clicksQuery.gte("created_at", since);
        conversionsQuery = conversionsQuery.gte("created_at", since);
      }

      const [clicks, conversions] = await Promise.all([
        clicksQuery.limit(50000),
        conversionsQuery.limit(5000),
      ]);
      if (clicks.error) throw clicks.error;
      if (conversions.error) throw conversions.error;

      return { clicks: clicks.data ?? [], conversions: conversions.data ?? [] };
    },
  });

  const totals = useMemo(() => {
    const clicks = data?.clicks ?? [];
    const conversions = data?.conversions ?? [];
    const visitors = new Set(clicks.map((c: any) => c.visitor_id).filter(Boolean)).size;
    const earned = conversions.reduce((s: number, c: any) => s + Number(c.commission_earned || 0), 0);
    const paid = conversions.reduce((s: number, c: any) => s + Number(c.paid_amount || 0), 0);
    return {
      clicks: clicks.length,
      visitors,
      orders: conversions.length,
      buyers: new Set(conversions.map((c: any) => c.customer_id).filter(Boolean)).size,
      sales: conversions.reduce((s: number, c: any) => s + Number(c.sale_amount || 0), 0),
      earned,
      paid,
      pending: Math.max(earned - paid, 0),
      conversion: visitors > 0 ? (conversions.length / visitors) * 100 : 0,
    };
  }, [data]);

  return (
    <PartnerLayout variant="influencer" title="Mis estadísticas">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Rendimiento de mi enlace</h2>
            <p className="text-sm text-muted-foreground">
              Entradas por tu enlace, compras con comisión y comisiones pagadas
            </p>
          </div>
          <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="all">Todo el histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingAffiliate ? (
          <Skeleton className="h-40 w-full" />
        ) : !affiliate ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Todavía no tienes un enlace de afiliado activo.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><MousePointerClick className="h-4 w-4" />Entradas por link</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.clicks}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" />Visitantes únicos</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.visitors}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><ShoppingBag className="h-4 w-4" />Compras con comisión</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.orders}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Percent className="h-4 w-4" />Conversión</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.conversion.toFixed(1)}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" />Comisiones pendientes</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{money(totals.pending)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Comisiones pagadas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{money(totals.paid)}</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Compras generadas por mi enlace</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : (data?.conversions ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay compras en este periodo.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Venta</TableHead>
                          <TableHead className="text-right">Comisión</TableHead>
                          <TableHead className="text-right">Pagado</TableHead>
                          <TableHead className="text-right">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.conversions ?? []).map((row: any, index: number) => (
                          <TableRow key={`${row.created_at}-${index}`}>
                            <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{money(row.sale_amount)}</TableCell>
                            <TableCell className="text-right font-semibold">{money(row.commission_earned)}</TableCell>
                            <TableCell className="text-right text-green-600">{money(row.paid_amount)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={row.payout_status === "paid" ? "default" : "secondary"}>
                                {row.payout_status === "paid" ? "Cobrada" : "Pendiente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PartnerLayout>
  );
}
