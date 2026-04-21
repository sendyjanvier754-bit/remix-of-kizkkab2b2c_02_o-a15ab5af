import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { useGrossisteEarnings } from "@/hooks/useGrossisteEarnings";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function GrossisteSettlementsPage() {
  const { settlements, pendingTotal, settledTotal, isLoading } = useGrossisteEarnings();

  return (
    <GrossisteLayout title="Liquidaciones" subtitle="Historial de pagos de la plataforma">
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Saldo pendiente</p><p className="text-2xl font-bold text-blue-600">${pendingTotal.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total liquidado</p><p className="text-2xl font-bold text-emerald-600">${settledTotal.toFixed(2)}</p></CardContent></Card>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Bruto</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Neto pagado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pagado el</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : settlements.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aún no hay liquidaciones.</TableCell></TableRow>
              ) : settlements.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{format(new Date(s.period_start), 'dd/MM/yy')} → {format(new Date(s.period_end), 'dd/MM/yy')}</TableCell>
                  <TableCell>${Number(s.gross_sales).toFixed(2)}</TableCell>
                  <TableCell className="text-destructive">-${Number(s.commission_amount).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">${Number(s.net_payable).toFixed(2)}</TableCell>
                  <TableCell>{s.status === 'paid' ? <Badge className="bg-emerald-600">Pagado</Badge> : <Badge variant="outline">Pendiente</Badge>}</TableCell>
                  <TableCell className="text-sm">{s.paid_at ? format(new Date(s.paid_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{s.payment_reference || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </GrossisteLayout>
  );
}
