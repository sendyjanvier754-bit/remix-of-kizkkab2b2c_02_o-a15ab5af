import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { useGrossisteEarnings } from "@/hooks/useGrossisteEarnings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function GrossisteOrdersPage() {
  const { earnings, isLoading } = useGrossisteEarnings();

  return (
    <GrossisteLayout title="Pedidos recibidos" subtitle="Pedidos B2B con tus productos. Gestionados por la plataforma.">
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead>Neto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : earnings.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aún no hay pedidos pagados con tus productos.</TableCell></TableRow>
            ) : earnings.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{format(new Date(e.created_at), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="text-xs font-mono">{e.order_id?.substring(0, 8)}…</TableCell>
                <TableCell>${Number(e.gross_amount).toFixed(2)}</TableCell>
                <TableCell className="text-destructive">-${Number(e.commission_amount).toFixed(2)}</TableCell>
                <TableCell className="font-semibold text-emerald-600">${Number(e.net_amount).toFixed(2)}</TableCell>
                <TableCell>
                  {e.status === 'settled' ? <Badge className="bg-emerald-600">Liquidado</Badge>
                    : e.status === 'cancelled' ? <Badge variant="destructive">Cancelado</Badge>
                    : <Badge variant="outline">Pendiente</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GrossisteLayout>
  );
}
