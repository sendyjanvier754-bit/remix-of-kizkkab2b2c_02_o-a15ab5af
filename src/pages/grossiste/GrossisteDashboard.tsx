import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, Wallet, TrendingUp } from "lucide-react";
import { useGrossisteProducts } from "@/hooks/useGrossisteProducts";
import { useGrossisteEarnings } from "@/hooks/useGrossisteEarnings";
import { useGrossisteProfile } from "@/hooks/useGrossisteProfile";
import { Badge } from "@/components/ui/badge";

export default function GrossisteDashboard() {
  const { products } = useGrossisteProducts();
  const { pendingTotal, settledTotal } = useGrossisteEarnings();
  const { profile } = useGrossisteProfile();

  const approved = products.filter(p => p.approval_status === 'approved').length;
  const pending = products.filter(p => p.approval_status === 'pending_review').length;

  const verifBadge = profile?.verification_status === 'verified'
    ? <Badge className="bg-emerald-600">Verificado</Badge>
    : profile?.verification_status === 'pending'
    ? <Badge variant="outline">Pendiente verificación</Badge>
    : <Badge variant="destructive">{profile?.verification_status}</Badge>;

  const cards = [
    { label: "Productos publicados", value: approved, icon: Package, color: "text-emerald-600" },
    { label: "Pendientes aprobación", value: pending, icon: Clock, color: "text-amber-600" },
    { label: "Saldo pendiente liquidación", value: `$${pendingTotal.toFixed(2)}`, icon: Wallet, color: "text-blue-600" },
    { label: "Total liquidado", value: `$${settledTotal.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <GrossisteLayout title="Dashboard" subtitle="Resumen de tu actividad como mayorista">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{profile?.business_name || "Mi negocio"}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            {verifBadge}
          </CardHeader>
        </Card>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </GrossisteLayout>
  );
}
