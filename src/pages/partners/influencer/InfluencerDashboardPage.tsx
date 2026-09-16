import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Check, DollarSign, MousePointerClick, ShoppingBag, Percent } from "lucide-react";
import PartnerLayout from "@/components/partners/PartnerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useMyAffiliate, useAffiliateConversions } from "@/hooks/useAffiliates";
import InfluencerAffiliatesPanel from "@/components/admin/InfluencerAffiliatesPanel";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AffiliateCommissionsPanel from "@/components/affiliates/AffiliateCommissionsPanel";

const statusLabel: Record<string, string> = {
  pending: "Pendiente de aprobación",
  active: "Activo",
  paused: "En pausa",
  rejected: "Rechazado",
};

export default function InfluencerDashboardPage() {
  const { role } = useAuth();
  const { data: affiliate, isLoading } = useMyAffiliate();
  const { data: conversions = [], isLoading: loadingConversions } = useAffiliateConversions(affiliate?.id);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = role === UserRole.ADMIN;

  const link = affiliate ? `${window.location.origin}/?ref=${affiliate.affiliate_code}` : "";

  const totals = useMemo(() => {
    const earned = conversions.reduce((s, c) => s + Number(c.commission_earned || 0), 0);
    const paid = conversions
      .filter((c) => c.payout_status === "paid")
      .reduce((s, c) => s + Number(c.commission_earned || 0), 0);
    const sales = conversions.reduce((s, c) => s + Number(c.sale_amount || 0), 0);
    return { earned, paid, pending: earned - paid, sales, count: conversions.length };
  }, [conversions]);

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <PartnerLayout variant="influencer" title={isAdmin ? "Gestión de afiliados" : "Panel de afiliado"}>
      {isAdmin ? (
        <InfluencerAffiliatesPanel />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !affiliate ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-muted-foreground">Todavía no tienes una cuenta de afiliado.</p>
            <Button asChild>
              <Link to="/programa-afiliados">Solicitar mi código</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={searchParams.get("tab") === "comisiones" ? "commissions" : "overview"} onValueChange={(value) => setSearchParams(value === "commissions" ? { tab: "comisiones" } : {})} className="space-y-5">
          <TabsList><TabsTrigger value="overview">Mi panel</TabsTrigger><TabsTrigger value="commissions">Comisiones</TabsTrigger></TabsList>
          <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{affiliate.display_name}</CardTitle>
              <Badge variant={affiliate.status === "active" ? "default" : "secondary"}>
                {statusLabel[affiliate.status] ?? affiliate.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Tu código</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-lg">{affiliate.affiliate_code}</span>
                    <Button size="icon" variant="ghost" onClick={() => copy(affiliate.affiliate_code, "code")}>
                      {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Tu enlace</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate">{link}</span>
                    <Button size="icon" variant="ghost" onClick={() => copy(link, "link")}>
                      {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium mb-1">Clientes nuevos (hasta {affiliate.tier1_purchases_limit} compras)</p>
                  <p className="text-muted-foreground">
                    {affiliate.customer_discount_tier1}% de descuento para el cliente · {affiliate.commission_rate_tier1}% para ti
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium mb-1">Clientes recurrentes</p>
                  <p className="text-muted-foreground">
                    {affiliate.customer_discount_tier2}% de descuento para el cliente · {affiliate.commission_rate_tier2}% para ti
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={MousePointerClick} label="Clics" value={String(affiliate.total_clicks ?? 0)} />
            <StatCard icon={ShoppingBag} label="Ventas" value={String(totals.count)} />
            <StatCard icon={Percent} label="Facturado" value={`$${totals.sales.toFixed(2)}`} />
            <StatCard icon={DollarSign} label="Por cobrar" value={`$${totals.pending.toFixed(2)}`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de comisiones</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConversions ? (
                <Skeleton className="h-40 w-full" />
              ) : conversions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay ventas con tu código.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead className="text-right">Venta</TableHead>
                        <TableHead className="text-right">Descuento</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conversions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>Tier {c.tier ?? 1}</TableCell>
                          <TableCell className="text-right">${Number(c.sale_amount).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${Number(c.discount_applied).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${Number(c.commission_earned).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={c.payout_status === "paid" ? "default" : "secondary"}>
                              {c.payout_status === "paid" ? "Pagada" : "Pendiente"}
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
          </TabsContent>
          <TabsContent value="commissions">
            <AffiliateCommissionsPanel affiliate={affiliate} />
          </TabsContent>
        </Tabs>
      )}
    </PartnerLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
