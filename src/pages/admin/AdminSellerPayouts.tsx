import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Save, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Payout {
  id: string;
  order_id: string;
  store_id: string | null;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: string;
  release_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  store?: { name: string } | null;
}

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  held: { label: 'Retenido', variant: 'secondary' },
  releasable: { label: 'Listo para pagar', variant: 'default' },
  paid: { label: 'Pagado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;
const db = supabase as any;

export default function AdminSellerPayouts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdDays, setHoldDays] = useState('7');
  const [savingDays, setSavingDays] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [paying, setPaying] = useState<Payout | null>(null);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: setting }] = await Promise.all([
      db.from('seller_payouts').select('*, store:stores(name)').order('created_at', { ascending: false }).limit(500),
      db.from('platform_settings').select('value').eq('key', 'b2c_payout_hold_days').maybeSingle(),
    ]);
    setRows((data as Payout[]) || []);
    if (setting?.value) setHoldDays(String(setting.value));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.net_amount), 0);
    return { held: sum('held'), releasable: sum('releasable'), paid: sum('paid') };
  }, [rows]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const saveDays = async () => {
    const n = parseInt(holdDays, 10);
    if (!Number.isFinite(n) || n < 0 || n > 120) { toast.error('Indica entre 0 y 120 días'); return; }
    setSavingDays(true);
    const { error } = await db.from('platform_settings').update({ value: String(n) }).eq('key', 'b2c_payout_hold_days');
    setSavingDays(false);
    error ? toast.error(error.message) : toast.success(`Periodo de garantía: ${n} días tras la entrega`);
  };

  const release = async () => {
    setReleasing(true);
    const { data, error } = await db.rpc('release_eligible_seller_payouts');
    setReleasing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data ?? 0} liquidaciones listas para pagar`);
    load();
  };

  const markPaid = async () => {
    if (!paying || !method.trim()) { toast.error('Indica el método de pago'); return; }
    setSubmitting(true);
    const { error } = await db.from('seller_payouts').update({
      status: 'paid', paid_at: new Date().toISOString(), paid_by: user?.id ?? null,
      payment_method: method.trim(), payment_reference: reference.trim() || null,
    }).eq('id', paying.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pago de ${money(paying.net_amount)} registrado a ${paying.store?.name ?? 'vendedor'}`);
    setPaying(null); setMethod(''); setReference('');
    load();
  };

  return (
    <AdminLayout title="Liquidaciones a vendedores">
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Liquidaciones a vendedores</h1>
          <p className="text-sm text-muted-foreground">
            KIZKKA cobra al cliente y retiene el dinero. Se libera al vendedor cuando el pedido se entrega y pasa el periodo de garantía sin reclamos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Retenido</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.held)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Listo para pagar</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{money(totals.releasable)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pagado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.paid)}</CardContent></Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Días de garantía tras entrega</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input type="number" min={0} max={120} value={holdDays} onChange={(e) => setHoldDays(e.target.value)} />
              <Button size="icon" onClick={saveDays} disabled={savingDays} aria-label="Guardar días">
                {savingDays ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {['all', 'held', 'releasable', 'paid', 'cancelled'].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
              {s === 'all' ? 'Todas' : STATUS[s].label}
            </Button>
          ))}
          <Button size="sm" className="ml-auto" onClick={release} disabled={releasing}>
            {releasing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Liberar pedidos elegibles
          </Button>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Sin liquidaciones todavía. Se crean automáticamente cuando un pedido de cliente queda pagado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead><TableHead>Tienda</TableHead><TableHead>Cobrado</TableHead>
                    <TableHead>Comisión</TableHead><TableHead>A pagar</TableHead><TableHead>Liberación</TableHead>
                    <TableHead>Estado</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.order_id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>{r.store?.name ?? '—'}</TableCell>
                      <TableCell>{money(r.gross_amount)}</TableCell>
                      <TableCell>{money(r.commission_amount)}</TableCell>
                      <TableCell className="font-semibold">{money(r.net_amount)}</TableCell>
                      <TableCell className="text-xs">
                        {r.paid_at ? `Pagado ${new Date(r.paid_at).toLocaleDateString()}` : r.release_at ? new Date(r.release_at).toLocaleDateString() : 'Esperando entrega'}
                      </TableCell>
                      <TableCell><Badge variant={STATUS[r.status]?.variant ?? 'secondary'}>{STATUS[r.status]?.label ?? r.status}</Badge></TableCell>
                      <TableCell>
                        {r.status === 'releasable' && <Button size="sm" onClick={() => setPaying(r)}>Registrar pago</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago a {paying?.store?.name ?? 'vendedor'}</DialogTitle></DialogHeader>
          <p className="text-sm">Monto: <strong>{money(paying?.net_amount ?? 0)}</strong></p>
          <div className="space-y-3">
            <div><Label>Método (MonCash, NatCash, transferencia…)</Label><Input value={method} onChange={(e) => setMethod(e.target.value)} /></div>
            <div><Label>Referencia (opcional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={markPaid} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
