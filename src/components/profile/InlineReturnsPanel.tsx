import { useState } from "react";
import {
  useMyReturnRequests,
  useCreateReturnRequest,
  RETURN_STATUS_CONFIG,
  ReturnStatus,
  CreateReturnInput,
} from "@/hooks/useOrderReturnRequests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RotateCcw, Plus, Loader2, Package, Clock, CheckCircle2,
  XCircle, Handshake, ShieldAlert, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusIcons: Partial<Record<ReturnStatus, React.ReactNode>> = {
  pending:           <Clock className="w-4 h-4 text-amber-600" />,
  accepted:          <CheckCircle2 className="w-4 h-4 text-green-600" />,
  rejected:          <XCircle className="w-4 h-4 text-red-600" />,
  processing:        <Loader2 className="w-4 h-4 text-blue-600" />,
  completed:         <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  agreement_reached: <Handshake className="w-4 h-4 text-purple-600" />,
  under_mediation:   <ShieldAlert className="w-4 h-4 text-indigo-600" />,
  cancelled:         <XCircle className="w-4 h-4 text-gray-400" />,
};

const REASON_TYPES = [
  { value: "damaged",      label: "Producto dañado" },
  { value: "wrong_item",   label: "Producto incorrecto" },
  { value: "not_as_desc",  label: "No es como se describe" },
  { value: "missing_part", label: "Pieza faltante" },
  { value: "other",        label: "Otro motivo" },
];

interface FormState {
  order_id: string;
  order_type: 'b2b' | 'b2c';
  seller_id: string;
  reason_type: string;
  reason: string;
  amount_requested: string;
}

const EMPTY_FORM: FormState = {
  order_id: "",
  order_type: "b2c",
  seller_id: "",
  reason_type: "",
  reason: "",
  amount_requested: "",
};

export function InlineReturnsPanel() {
  const { data: returns = [], isLoading } = useMyReturnRequests();
  const createReturn = useCreateReturnRequest();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const handleSubmit = async () => {
    if (!form.order_id || !form.reason_type || !form.reason) return;
    const input: CreateReturnInput = {
      order_id: form.order_id,
      order_type: form.order_type,
      seller_id: form.seller_id || undefined,
      reason: form.reason,
      reason_type: form.reason_type,
      amount_requested: form.amount_requested ? parseFloat(form.amount_requested) : undefined,
    };
    await createReturn.mutateAsync(input);
    setDialogOpen(false);
    setForm(EMPTY_FORM);
  };

  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-md p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-background border border-border rounded-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Mis Devoluciones</h2>
            <Badge variant="secondary" className="text-xs">{returns.length}</Badge>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Nueva solicitud
          </Button>
        </div>

        {/* Info banner */}
        <div className="px-5 py-3 bg-blue-50 border-b border-border flex gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Para devoluciones de pedidos B2C, el vendedor revisará tu solicitud. Para pedidos B2B, el administrador gestionará el proceso.
          </p>
        </div>

        {returns.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <RotateCcw className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No tienes solicitudes de devolución</p>
            <p className="text-xs text-muted-foreground">Cuando solicites una devolución aparecerá aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {returns.map((ret) => {
              const cfg = RETURN_STATUS_CONFIG[ret.status];
              return (
                <div key={ret.id} className="px-5 py-4 flex gap-3 hover:bg-muted/20 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {statusIcons[ret.status] ?? <Package className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">
                        Pedido #{ret.order_id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1.5 ${cfg.color} border-current`}
                      >
                        {cfg.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {ret.order_type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {REASON_TYPES.find(r => r.value === ret.reason_type)?.label || ret.reason_type || "Sin motivo"}
                    </p>
                    <p className="text-xs text-foreground mt-0.5 line-clamp-1">{ret.reason}</p>
                    {ret.amount_requested && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Monto solicitado: <span className="font-medium text-foreground">${ret.amount_requested.toLocaleString()}</span>
                        {ret.amount_approved && (
                          <> · Aprobado: <span className="font-medium text-green-600">${ret.amount_approved.toLocaleString()}</span></>
                        )}
                      </p>
                    )}
                    {ret.seller_notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Vendedor: "{ret.seller_notes}"
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(ret.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New return dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Devolución</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">ID del Pedido *</Label>
              <Input
                value={form.order_id}
                onChange={(e) => setForm(f => ({ ...f, order_id: e.target.value }))}
                placeholder="Pega el ID del pedido"
                className="h-9 mt-1 font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Lo encuentras en el detalle de tu pedido</p>
            </div>
            <div>
              <Label className="text-xs">Tipo de pedido *</Label>
              <Select
                value={form.order_type}
                onValueChange={(v) => setForm(f => ({ ...f, order_type: v as 'b2b' | 'b2c' }))}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2c">B2C — Tienda virtual</SelectItem>
                  <SelectItem value="b2b">B2B — Catálogo mayorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Motivo de devolución *</Label>
              <Select
                value={form.reason_type}
                onValueChange={(v) => setForm(f => ({ ...f, reason_type: v }))}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descripción detallada *</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Explica qué pasó con el producto…"
                className="mt-1 min-h-[80px] resize-none"
              />
            </div>
            <div>
              <Label className="text-xs">Monto a reembolsar (opcional)</Label>
              <Input
                type="number"
                value={form.amount_requested}
                onChange={(e) => setForm(f => ({ ...f, amount_requested: e.target.value }))}
                placeholder="0.00"
                className="h-9 mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createReturn.isPending || !form.order_id || !form.reason_type || !form.reason}
            >
              {createReturn.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
