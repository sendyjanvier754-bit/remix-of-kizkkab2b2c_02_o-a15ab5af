import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Check } from "lucide-react";
import {
  Affiliate,
  useAllAffiliates,
  useAllAffiliateConversions,
  useSaveAffiliate,
} from "@/hooks/useAffiliates";
import AffiliateCommissionsPanel from "@/components/affiliates/AffiliateCommissionsPanel";
import AffiliatePaymentMethodsPanel from "@/components/affiliates/AffiliatePaymentMethodsPanel";

const emptyForm = {
  display_name: "",
  affiliate_code: "",
  commission_rate_tier1: 10,
  commission_rate_tier2: 5,
  tier1_purchases_limit: 1,
  customer_discount_tier1: 10,
  customer_discount_tier2: 5,
  status: "active",
};

export default function InfluencerAffiliatesPanel() {
  const { data: affiliates = [], isLoading } = useAllAffiliates();
  const { data: allConversions = [], isLoading: loadingAllConversions } = useAllAffiliateConversions();
  const save = useSaveAffiliate();
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openEdit = (a: Affiliate) => {
    setEditing(a);
    setForm({
      display_name: a.display_name,
      affiliate_code: a.affiliate_code,
      commission_rate_tier1: Number(a.commission_rate_tier1),
      commission_rate_tier2: Number(a.commission_rate_tier2),
      tier1_purchases_limit: a.tier1_purchases_limit,
      customer_discount_tier1: Number(a.customer_discount_tier1),
      customer_discount_tier2: Number(a.customer_discount_tier2),
      status: a.status,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    await save.mutateAsync({ id: editing.id, ...form } as any);
    setEditing(null);
  };

  const portfolioTotals = allConversions.reduce(
    (totals, conversion) => {
      const amount = Number(conversion.commission_earned || 0);
      const paid = Number(conversion.paid_amount || 0);
      totals.paid += paid;
      totals.pending += Math.max(0, amount - paid);
      return totals;
    },
    { pending: 0, paid: 0 },
  );

  const commissionsFor = (affiliateId: string) => {
    return allConversions.reduce(
      (totals, conversion) => {
        if (conversion.affiliate_id !== affiliateId) return totals;
        const amount = Number(conversion.commission_earned || 0);
        const paid = Number(conversion.paid_amount || 0);
        totals.paid += paid;
        totals.pending += Math.max(0, amount - paid);
        return totals;
      },
      { pending: 0, paid: 0 },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Comisiones por pagar</p>
            <p className="mt-1 text-2xl font-semibold">${portfolioTotals.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Comisiones pagadas</p>
            <p className="mt-1 text-2xl font-semibold">${portfolioTotals.paid.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Influencers y afiliados</CardTitle>
          <CardDescription>
            Aprueba solicitudes y define el descuento del cliente y la comisión por nivel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || loadingAllConversions ? (
            <Skeleton className="h-40 w-full" />
          ) : affiliates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay afiliados registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nivel 1</TableHead>
                    <TableHead>Nivel 2</TableHead>
                    <TableHead>Clics</TableHead>
                    <TableHead className="text-right">Por pagar</TableHead>
                    <TableHead className="text-right">Pagadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((a) => {
                    const commissionTotals = commissionsFor(a.id);
                    return (
                    <TableRow key={a.id} className={selectedId === a.id ? "bg-muted/50" : undefined}>
                      <TableCell className="font-medium">{a.display_name}</TableCell>
                      <TableCell className="font-mono">{a.affiliate_code}</TableCell>
                      <TableCell className="text-xs">
                        {a.customer_discount_tier1}% cliente / {a.commission_rate_tier1}% comisión
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.customer_discount_tier2}% cliente / {a.commission_rate_tier2}% comisión
                      </TableCell>
                      <TableCell>{a.total_clicks ?? 0}</TableCell>
                      <TableCell className="text-right font-medium">${commissionTotals.pending.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${commissionTotals.paid.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {a.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => save.mutate({ id: a.id, status: "active" })}
                          >
                            <Check className="h-4 w-4 mr-1" /> Aprobar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedId(a.id)}>
                          Comisiones
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && (() => {
        const selectedAffiliate = affiliates.find((affiliate) => affiliate.id === selectedId);
        return selectedAffiliate ? <AffiliateCommissionsPanel affiliate={selectedAffiliate} canManage /> : null;
      })()}

      <AffiliatePaymentMethodsPanel />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar afiliado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre público</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                value={form.affiliate_code}
                onChange={(e) => setForm({ ...form, affiliate_code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="paused">En pausa</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Compras para nivel 1</Label>
              <Input
                type="number"
                value={form.tier1_purchases_limit}
                onChange={(e) => setForm({ ...form, tier1_purchases_limit: Number(e.target.value) })}
              />
            </div>
            <div />
            <div className="space-y-1.5">
              <Label>Descuento cliente nivel 1 (%)</Label>
              <Input
                type="number"
                value={form.customer_discount_tier1}
                onChange={(e) => setForm({ ...form, customer_discount_tier1: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comisión nivel 1 (%)</Label>
              <Input
                type="number"
                value={form.commission_rate_tier1}
                onChange={(e) => setForm({ ...form, commission_rate_tier1: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descuento cliente nivel 2 (%)</Label>
              <Input
                type="number"
                value={form.customer_discount_tier2}
                onChange={(e) => setForm({ ...form, customer_discount_tier2: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comisión nivel 2 (%)</Label>
              <Input
                type="number"
                value={form.commission_rate_tier2}
                onChange={(e) => setForm({ ...form, commission_rate_tier2: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
