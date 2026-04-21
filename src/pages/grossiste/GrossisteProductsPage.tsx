import { useState } from "react";
import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { useGrossisteProducts } from "@/hooks/useGrossisteProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusBadge = (s: string) => {
  if (s === 'approved') return <Badge className="bg-emerald-600">Aprobado</Badge>;
  if (s === 'pending_review') return <Badge variant="outline" className="border-amber-400 text-amber-700">Pendiente</Badge>;
  if (s === 'rejected') return <Badge variant="destructive">Rechazado</Badge>;
  return <Badge variant="secondary">Borrador</Badge>;
};

export default function GrossisteProductsPage() {
  const { products, isLoading, create, remove } = useGrossisteProducts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku_interno: '', nombre: '', descripcion_corta: '', costo_base_excel: 0, precio_mayorista_base: 0, stock_fisico: 0 });

  const submit = () => {
    create.mutate(form, { onSuccess: () => { setOpen(false); setForm({ sku_interno: '', nombre: '', descripcion_corta: '', costo_base_excel: 0, precio_mayorista_base: 0, stock_fisico: 0 }); } });
  };

  return (
    <GrossisteLayout title="Mis Productos B2B" subtitle="Gestiona tu catálogo mayorista">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nuevo producto</Button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Precio mayorista</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aún no tienes productos. Crea el primero.</TableCell></TableRow>
              ) : products.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.sku_interno}</TableCell>
                  <TableCell>${Number(p.costo_base_excel || 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(p.precio_mayorista_base || 0).toFixed(2)}</TableCell>
                  <TableCell>{p.stock_fisico ?? 0}</TableCell>
                  <TableCell>{statusBadge(p.approval_status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('¿Eliminar este producto?')) remove.mutate(p.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo producto B2B</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>SKU interno</Label><Input value={form.sku_interno} onChange={e => setForm({ ...form, sku_interno: e.target.value })} /></div>
            <div><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div><Label>Descripción corta</Label><Textarea value={form.descripcion_corta} onChange={e => setForm({ ...form, descripcion_corta: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Costo</Label><Input type="number" step="0.01" value={form.costo_base_excel} onChange={e => setForm({ ...form, costo_base_excel: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Precio mayorista</Label><Input type="number" step="0.01" value={form.precio_mayorista_base} onChange={e => setForm({ ...form, precio_mayorista_base: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock_fisico} onChange={e => setForm({ ...form, stock_fisico: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">El producto entrará en estado "Pendiente" hasta que el admin lo apruebe.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending || !form.sku_interno || !form.nombre}>{create.isPending ? 'Enviando…' : 'Enviar a revisión'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GrossisteLayout>
  );
}
