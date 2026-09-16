import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MousePointerClick, Users, ShoppingBag, DollarSign, Percent } from "lucide-react";

type RangeKey = "7" | "30" | "90" | "all";

interface AffiliateRow {
  id: string;
  display_name: string;
  affiliate_code: string;
  status: string;
  clicks: number;
  visitors: number;
  orders: number;
  buyers: number;
  sales: number;
  commissions: number;
  paid: number;
}

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

const rangeStart = (range: RangeKey) => {
  if (range === "all") return null;
  const days = Number(range);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export default function AdminAffiliateStatsPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliate-stats", range],
    queryFn: async (): Promise<AffiliateRow[]> => {
      const since = rangeStart(range);

      const affiliatesQuery = supabase
        .from("affiliates")
        .select("id, display_name, affiliate_code, status")
        .order("display_name");

      let clicksQuery = supabase.from("affiliate_clicks").select("affiliate_id, visitor_id");
      let conversionsQuery = supabase
        .from("affiliate_conversions")
        .select("affiliate_id, customer_id, sale_amount, commission_earned, paid_amount");

      if (since) {
        clicksQuery = clicksQuery.gte("created_at", since);
        conversionsQuery = conversionsQuery.gte("created_at", since);
      }

      const [affiliates, clicks, conversions] = await Promise.all([
        affiliatesQuery,
        clicksQuery.limit(50000),
        conversionsQuery.limit(50000),
      ]);

      if (affiliates.error) throw affiliates.error;
      if (clicks.error) throw clicks.error;
      if (conversions.error) throw conversions.error;

      return (affiliates.data ?? []).map((affiliate) => {
        const affiliateClicks = (clicks.data ?? []).filter((c) => c.affiliate_id === affiliate.id);
        const affiliateConversions = (conversions.data ?? []).filter((c) => c.affiliate_id === affiliate.id);
        return {
          ...affiliate,
          clicks: affiliateClicks.length,
          visitors: new Set(affiliateClicks.map((c) => c.visitor_id).filter(Boolean)).size,
          orders: affiliateConversions.length,
          buyers: new Set(affiliateConversions.map((c) => c.customer_id).filter(Boolean)).size,
          sales: affiliateConversions.reduce((sum, c) => sum + Number(c.sale_amount || 0), 0),
          commissions: affiliateConversions.reduce((sum, c) => sum + Number(c.commission_earned || 0), 0),
          paid: affiliateConversions.reduce((sum, c) => sum + Number(c.paid_amount || 0), 0),
        };
      });
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data ?? []).filter(
      (row) =>
        !term ||
        row.display_name.toLowerCase().includes(term) ||
        row.affiliate_code.toLowerCase().includes(term),
    );
    return [...list].sort((a, b) => b.orders - a.orders || b.clicks - a.clicks);
  }, [data, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          clicks: acc.clicks + row.clicks,
          visitors: acc.visitors + row.visitors,
          orders: acc.orders + row.orders,
          sales: acc.sales + row.sales,
          commissions: acc.commissions + row.commissions,
        }),
        { clicks: 0, visitors: 0, orders: 0, sales: 0, commissions: 0 },
      ),
    [rows],
  );

  const conversionRate = totals.visitors > 0 ? (totals.orders / totals.visitors) * 100 : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Estadísticas de Afiliados</h1>
                <p className="text-muted-foreground">
                  Visitas recibidas por cada enlace y compras que generaron comisión
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o código"
                  className="w-56"
                />
                <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 días</SelectItem>
                    <SelectItem value="30">Últimos 30 días</SelectItem>
                    <SelectItem value="90">Últimos 90 días</SelectItem>
                    <SelectItem value="all">Todo el histórico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><MousePointerClick className="h-4 w-4" />Clics en enlaces</CardTitle></CardHeader>
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
                <CardContent><p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" />Comisiones generadas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{money(totals.commissions)}</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Detalle por enlace de afiliado</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Todavía no hay datos para este periodo.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Afiliado</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead className="text-right">Clics</TableHead>
                          <TableHead className="text-right">Visitantes</TableHead>
                          <TableHead className="text-right">Compras</TableHead>
                          <TableHead className="text-right">Compradores</TableHead>
                          <TableHead className="text-right">Conversión</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-right">Comisiones</TableHead>
                          <TableHead className="text-right">Pagado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {row.display_name}
                                {row.status !== "active" && <Badge variant="secondary">{row.status}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.affiliate_code}</TableCell>
                            <TableCell className="text-right">{row.clicks}</TableCell>
                            <TableCell className="text-right">{row.visitors}</TableCell>
                            <TableCell className="text-right font-semibold">{row.orders}</TableCell>
                            <TableCell className="text-right">{row.buyers}</TableCell>
                            <TableCell className="text-right">
                              {row.visitors > 0 ? `${((row.orders / row.visitors) * 100).toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right">{money(row.sales)}</TableCell>
                            <TableCell className="text-right">{money(row.commissions)}</TableCell>
                            <TableCell className="text-right text-green-600">{money(row.paid)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
