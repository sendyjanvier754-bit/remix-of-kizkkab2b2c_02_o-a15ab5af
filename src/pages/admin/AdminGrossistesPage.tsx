import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminGrossistesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("mayoristas");

  const { data: grossistes = [] } = useQuery({
    queryKey: ['admin-grossistes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grossiste_profiles' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: pendingProducts = [] } = useQuery({
    queryKey: ['admin-grossiste-pending-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products')
        .select('id, sku_interno, nombre, costo_base_excel, precio_mayorista_base, owner_user_id, created_at, imagen_principal' as any)
        .eq('approval_status' as any, 'pending_review')
        .eq('owner_role' as any, 'grossiste')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const verify = useMutation({
    mutationFn: async ({ userId, status, rate }: { userId: string; status: string; rate?: number }) => {
      const patch: any = { verification_status: status };
      if (rate !== undefined) patch.commission_rate = rate;
      if (status === 'verified') { patch.verified_at = new Date().toISOString(); }
      const { error } = await supabase.from('grossiste_profiles' as any).update(patch).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-grossistes'] }); toast.success("Mayorista actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase.from('products').update({ approval_status: status, approval_notes: notes, reviewed_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-grossiste-pending-products'] }); toast.success("Producto revisado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Mayoristas (Grossistes)">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mayoristas">Mayoristas ({grossistes.length})</TabsTrigger>
          <TabsTrigger value="aprobaciones">Aprobaciones pendientes ({pendingProducts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mayoristas" className="mt-4">
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>B2C</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grossistes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aún no hay mayoristas. Asigna el rol "Mayorista" desde Cuentas.</TableCell></TableRow>
                ) : grossistes.map((g: any) => (
                  <TableRow key={g.user_id}>
                    <TableCell className="font-medium">{g.business_name || '—'}</TableCell>
                    <TableCell className="text-sm">{g.email}</TableCell>
                    <TableCell>{g.verification_status === 'verified' ? <Badge className="bg-emerald-600">Verificado</Badge> : <Badge variant="outline">{g.verification_status}</Badge>}</TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={g.commission_rate} className="w-20 h-8" step="0.5"
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (v !== g.commission_rate) verify.mutate({ userId: g.user_id, status: g.verification_status, rate: v }); }} />
                    </TableCell>
                    <TableCell>{g.enable_b2c_storefront ? <Badge variant="secondary">Activa</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="space-x-1">
                      {g.verification_status !== 'verified' && (
                        <Button size="sm" className="h-7" onClick={() => verify.mutate({ userId: g.user_id, status: 'verified' })}><ShieldCheck className="w-3 h-3 mr-1" />Verificar</Button>
                      )}
                      {g.verification_status !== 'suspended' && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => verify.mutate({ userId: g.user_id, status: 'suspended' })}>Suspender</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="aprobaciones" className="mt-4 space-y-3">
          {pendingProducts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay productos pendientes de aprobación.</p>
          ) : pendingProducts.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center gap-4">
                {p.imagen_principal && <img src={p.imagen_principal} alt="" className="w-16 h-16 rounded object-cover" />}
                <div className="flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku_interno} · Costo ${p.costo_base_excel} · Precio mayorista ${p.precio_mayorista_base}</p>
                </div>
                <Button size="sm" onClick={() => review.mutate({ id: p.id, status: 'approved' })} className="bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4 mr-1" />Aprobar</Button>
                <Button size="sm" variant="destructive" onClick={() => { const notes = prompt('Motivo del rechazo:'); if (notes !== null) review.mutate({ id: p.id, status: 'rejected', notes }); }}><X className="w-4 h-4 mr-1" />Rechazar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
