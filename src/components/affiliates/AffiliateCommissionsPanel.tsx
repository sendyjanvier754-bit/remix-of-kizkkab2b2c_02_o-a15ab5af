import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, CircleDollarSign, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import {
  Affiliate,
  AffiliateConversion,
  useAffiliateConversions,
  useAffiliatePayoutMethods,
  useAffiliatePayoutRequests,
  useAffiliatePayouts,
  useRecordAffiliatePayout,
  useRequestAffiliatePayout,
  useResolveAffiliatePayoutRequest,
  useVoidAffiliatePayout,
} from "@/hooks/useAffiliates";

type Props = { affiliate: Affiliate; canManage?: boolean };

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

export default function AffiliateCommissionsPanel({ affiliate, canManage = false }: Props) {
  const { data: conversions = [], isLoading } = useAffiliateConversions(affiliate.id);
  const { data: payouts = [], isLoading: loadingPayouts } = useAffiliatePayouts(affiliate.id);
  const { data: methods = [] } = useAffiliatePayoutMethods(false);
  const recordPayout = useRecordAffiliatePayout();
  const voidPayout = useVoidAffiliatePayout();
  const [selected, setSelected] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [partialMode, setPartialMode] = useState(false);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const { data: payoutRequests = [] } = useAffiliatePayoutRequests(affiliate.id);
  const requestPayout = useRequestAffiliatePayout();
  const resolveRequest = useResolveAffiliatePayoutRequest();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");
  const [claimMethodId, setClaimMethodId] = useState("");
  const [claimDetails, setClaimDetails] = useState("");
  const [claimNote, setClaimNote] = useState("");


  const totals = useMemo(() => conversions.reduce((sum, conversion) => {
    const earned = Number(conversion.commission_earned || 0);
    const paid = Number(conversion.paid_amount || 0);
    sum.sales += Number(conversion.sale_amount || 0);
    sum.discounts += Number(conversion.discount_applied || 0);
    sum.earned += earned;
    sum.paid += paid;
    sum.pending += Math.max(0, earned - paid);
    return sum;
  }, { sales: 0, discounts: 0, earned: 0, paid: 0, pending: 0 }), [conversions]);

  const pending = conversions.filter((conversion) => remaining(conversion) > 0);
  const selectedConversions = pending.filter((conversion) => selected.includes(conversion.id));
  const selectedBalance = selectedConversions.reduce((sum, conversion) => sum + remaining(conversion), 0);

  const openPayment = () => {
    if (selected.length === 0) return;
    setAmount(selectedBalance.toFixed(2));
    setDialogOpen(true);
  };

  const submitPayment = async () => {
    const requested = partialMode ? Number(amount) : selectedBalance;
    if (!methodId || requested <= 0 || requested > selectedBalance) return;
    let available = requested;
    const allocations = selectedConversions.flatMap((conversion) => {
      const allocated = Math.min(remaining(conversion), available);
      available = Number((available - allocated).toFixed(2));
      return allocated > 0 ? [{ conversion_id: conversion.id, amount: allocated }] : [];
    });
    await recordPayout.mutateAsync({
      affiliateId: affiliate.id,
      paymentMethodId: methodId,
      paidAt,
      reference,
      notes,
      allocations,
    });
    const methodName = methods.find((method) => method.id === methodId)?.name ?? "método seleccionado";
    toast.success(
      `Pago de ${money(requested)} registrado por ${methodName}`,
      { description: `${allocations.length} comisión(es) marcadas como pagadas el ${new Date(paidAt).toLocaleDateString()}.` },
    );
    setDialogOpen(false);
    setSelected([]);
    setReference("");
    setNotes("");
  };

  const openRequest = payoutRequests.find((request) => request.status === "pending" || request.status === "approved");

  const openClaim = () => {
    setClaimAmount(totals.pending.toFixed(2));
    setClaimOpen(true);
  };

  const submitClaim = async () => {
    const requested = Number(claimAmount);
    if (!(requested > 0) || requested > totals.pending) return;
    await requestPayout.mutateAsync({
      affiliateId: affiliate.id,
      amount: requested,
      paymentMethodId: claimMethodId || null,
      paymentDetails: claimDetails,
      note: claimNote,
    });
    setClaimOpen(false);
    setClaimDetails("");
    setClaimNote("");
  };

  if (isLoading || loadingPayouts) return <Skeleton className="h-80 w-full" />;


  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary icon={ReceiptText} label="Ventas generadas" value={money(totals.sales)} />
        <Summary icon={CircleDollarSign} label="Descuentos aplicados" value={money(totals.discounts)} />
        <Summary icon={Banknote} label="Por cobrar" value={money(totals.pending)} />
        <Summary icon={Banknote} label="Cobrado" value={money(totals.paid)} />
      </div>

      {!canManage && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo disponible para reclamar</p>
              <p className="text-2xl font-semibold">{money(totals.pending)}</p>
              {openRequest && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tienes una solicitud de {money(openRequest.amount)} en revisión desde el {new Date(openRequest.created_at).toLocaleDateString()}.
                </p>
              )}
            </div>
            <Button onClick={openClaim} disabled={totals.pending <= 0 || !!openRequest}>
              Reclamar mi pago
            </Button>
          </CardContent>
        </Card>
      )}

      {payoutRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Solicitudes de pago</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Fecha</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Método</TableHead>
                <TableHead>Nota</TableHead><TableHead>Estado</TableHead>{canManage && <TableHead />}
              </TableRow></TableHeader>
              <TableBody>{payoutRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-medium">{money(request.amount)}</TableCell>
                  <TableCell>{methods.find((method) => method.id === request.payment_method_id)?.name || "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{request.payment_details || request.note || "—"}</TableCell>
                  <TableCell><RequestBadge status={request.status} /></TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => resolveRequest.mutate({ id: request.id, status: "approved" })}>Aprobar</Button>
                          <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt("Motivo del rechazo"); if (reason?.trim()) resolveRequest.mutate({ id: request.id, status: "rejected", adminNote: reason }); }}>Rechazar</Button>
                        </div>
                      )}
                      {request.status === "approved" && (
                        <Button size="sm" onClick={() => resolveRequest.mutate({ id: request.id, status: "paid" })}>Marcar pagada</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}</TableBody>
            </Table></div>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Ventas y comisiones</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{affiliate.display_name} · {affiliate.affiliate_code}</p>
          </div>
          {canManage && selected.length > 0 && (
            <Button onClick={openPayment}>Registrar pago ({selected.length})</Button>
          )}
        </CardHeader>
        <CardContent>
          {conversions.length === 0 ? <Empty text="Aún no hay ventas con este código." /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  {canManage && <TableHead className="w-10"><Checkbox checked={pending.length > 0 && selected.length === pending.length} onCheckedChange={(checked) => setSelected(checked ? pending.map((item) => item.id) : [])} /></TableHead>}
                  <TableHead>Fecha</TableHead><TableHead>Nivel</TableHead><TableHead className="text-right">Venta</TableHead>
                  <TableHead className="text-right">Descuento</TableHead><TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead>
                </TableRow></TableHeader>
                <TableBody>{conversions.map((conversion) => {
                  const balance = remaining(conversion);
                  return <TableRow key={conversion.id}>
                    {canManage && <TableCell><Checkbox disabled={balance <= 0} checked={selected.includes(conversion.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, conversion.id] : current.filter((id) => id !== conversion.id))} /></TableCell>}
                    <TableCell>{new Date(conversion.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>Tier {conversion.tier ?? 1}</TableCell>
                    <TableCell className="text-right">{money(conversion.sale_amount)}</TableCell>
                    <TableCell className="text-right">{money(conversion.discount_applied)}</TableCell>
                    <TableCell className="text-right font-medium">{money(conversion.commission_earned)}</TableCell>
                    <TableCell className="text-right">{money(conversion.paid_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{money(balance)}</TableCell>
                    <TableCell><PaymentBadge status={conversion.payout_status} /></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historial de pagos</CardTitle></CardHeader>
        <CardContent>{payouts.length === 0 ? <Empty text="Todavía no se han registrado pagos." /> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Método</TableHead><TableHead>Referencia</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Estado</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
            <TableBody>{payouts.map((payout) => <TableRow key={payout.id}>
              <TableCell>{new Date(payout.paid_at).toLocaleDateString()}</TableCell><TableCell>{payout.payment_method_name}</TableCell>
              <TableCell>{payout.reference || "—"}</TableCell><TableCell className="text-right font-medium">{money(payout.amount)} {payout.currency}</TableCell>
              <TableCell><PaymentBadge status={payout.status} /></TableCell>
              {canManage && <TableCell className="text-right">{payout.status === "paid" && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt("Motivo de anulación"); if (reason?.trim()) voidPayout.mutate({ payoutId: payout.id, reason }); }}>Anular</Button>}</TableCell>}
            </TableRow>)}</TableBody>
          </Table></div>
        )}</CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Registrar pago de comisión</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border p-3 text-sm"><span className="text-muted-foreground">Saldo seleccionado</span><p className="text-xl font-semibold">{money(selectedBalance)}</p></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={partialMode} onCheckedChange={(checked) => setPartialMode(checked === true)} /> Registrar pago parcial</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Monto (USD)</Label><Input type="number" min="0.01" step="0.01" max={selectedBalance} disabled={!partialMode} value={partialMode ? amount : selectedBalance.toFixed(2)} onChange={(event) => setAmount(event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Fecha de pago</Label><Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Método</Label><Select value={methodId} onValueChange={setMethodId}><SelectTrigger><SelectValue placeholder="Seleccionar método" /></SelectTrigger><SelectContent>{methods.map((method) => <SelectItem key={method.id} value={method.id}>{method.name}{method.processing_mode === "automatic" ? " · Automático" : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Referencia o comprobante</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Número de transacción" /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={recordPayout.isPending || !methodId || Number(partialMode ? amount : selectedBalance) <= 0 || Number(partialMode ? amount : selectedBalance) > selectedBalance} onClick={submitPayment}>{recordPayout.isPending ? "Registrando..." : "Confirmar pago"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const remaining = (conversion: AffiliateConversion) => Math.max(0, Number(conversion.commission_earned || 0) - Number(conversion.paid_amount || 0));

function PaymentBadge({ status }: { status: string }) {
  const label = status === "paid" ? "Cobrada" : status === "partial" ? "Parcial" : status === "voided" ? "Anulada" : status === "failed" ? "Fallida" : status === "processing" ? "Procesando" : "Pendiente";
  return <Badge variant={status === "paid" ? "default" : status === "voided" || status === "failed" ? "destructive" : "secondary"}>{label}</Badge>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="text-xl font-semibold">{value}</p></CardContent></Card>;
}

function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }