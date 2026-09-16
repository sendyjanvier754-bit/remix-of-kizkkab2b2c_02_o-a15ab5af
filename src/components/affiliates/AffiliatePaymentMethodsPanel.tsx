import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AffiliatePayoutMethod, useAffiliatePayoutMethods, useSaveAffiliatePayoutMethod } from "@/hooks/useAffiliates";

export default function AffiliatePaymentMethodsPanel() {
  const { data: methods = [] } = useAffiliatePayoutMethods(true);
  const save = useSaveAffiliatePayoutMethod();
  const [editing, setEditing] = useState<AffiliatePayoutMethod | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", processing_mode: "manual" as "manual" | "automatic", is_active: true });

  const edit = (method?: AffiliatePayoutMethod) => {
    setEditing(method ?? null);
    setForm(method ? { name: method.name, code: method.code, processing_mode: method.processing_mode, is_active: method.is_active } : { name: "", code: "", processing_mode: "manual", is_active: true });
    setOpen(true);
  };

  const submit = async () => {
    await save.mutateAsync({ id: editing?.id, ...form });
    setOpen(false);
  };

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Métodos de pago</CardTitle><p className="mt-1 text-sm text-muted-foreground">Activa, retira o prepara métodos para transferencias automáticas.</p></div><Button size="sm" onClick={() => edit()}><Plus className="mr-1 h-4 w-4" />Agregar</Button></CardHeader>
    <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Código</TableHead><TableHead>Modalidad</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{methods.map((method) => <TableRow key={method.id}><TableCell className="font-medium">{method.name}</TableCell><TableCell className="font-mono text-xs">{method.code}</TableCell><TableCell><Badge variant="outline">{method.processing_mode === "automatic" ? "Automático" : "Manual"}</Badge></TableCell><TableCell><Badge variant={method.is_active ? "default" : "secondary"}>{method.is_active ? "Activo" : "Retirado"}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => edit(method)}>Editar</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar método" : "Agregar método"}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label>Nombre</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej. Cripto USDT" /></div><div className="space-y-1.5"><Label>Código interno</Label><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="crypto_usdt" /></div><div className="space-y-1.5"><Label>Modalidad</Label><Select value={form.processing_mode} onValueChange={(value: "manual" | "automatic") => setForm({ ...form, processing_mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="automatic">Automático</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Automático requiere las credenciales oficiales del proveedor antes de enviar dinero.</p></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked === true })} /> Disponible para pagos</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!form.name.trim() || !form.code.trim() || save.isPending} onClick={submit}>Guardar</Button></div></div></DialogContent></Dialog>
  </Card>;
}