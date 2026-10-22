import { useMemo, useState } from "react";
import { CalendarPlus, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePublicCategories } from "@/hooks/useCategories";
import {
  useAdminSponsoredPlacements,
  useSponsorProductSearch,
  type AdminPlacementRow,
  type SearchResult,
  type SponsoredPlacementType,
} from "@/hooks/useSponsoredPlacements";

export const PLACEMENT_LABEL: Record<SponsoredPlacementType, string> = {
  category: "Categorías",
  trends: "Tendencias",
  news: "Noticias",
};

type Status = "Activo" | "Programado" | "Pausado" | "Vencido";

export const statusOf = (r: { is_active: boolean; starts_at: string; ends_at: string | null }): Status => {
  if (!r.is_active) return "Pausado";
  if (r.ends_at && new Date(r.ends_at) <= new Date()) return "Vencido";
  if (new Date(r.starts_at) > new Date()) return "Programado";
  return "Activo";
};

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "outline"> = {
  Activo: "default",
  Programado: "secondary",
  Pausado: "outline",
  Vencido: "outline",
};

const daysLeft = (endsAt: string | null) => {
  if (!endsAt) return "Sin fin";
  const d = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000);
  return d <= 0 ? "Terminado" : `${d} día${d === 1 ? "" : "s"} restantes`;
};

export const SponsoredProductsManager = ({ rows, isLoading, extend, toggle, remove }: {
  rows: AdminPlacementRow[];
  isLoading: boolean;
} & Pick<ReturnType<typeof useAdminSponsoredPlacements>, "extend" | "toggle" | "remove">) => {
  const [creating, setCreating] = useState(false);
  const [placementFilter, setPlacementFilter] = useState<"all" | SponsoredPlacementType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminPlacementRow | null>(null);

  const visible = useMemo(() => rows.filter((r) => {
    if (placementFilter !== "all" && r.placement !== placementFilter) return false;
    if (statusFilter !== "all" && statusOf(r) !== statusFilter) return false;
    const t = q.trim().toLowerCase();
    if (t && !`${r.item?.nombre ?? ""} ${r.item?.storeName ?? ""} ${r.item?.sku ?? ""}`.toLowerCase().includes(t)) return false;
    return true;
  }), [rows, placementFilter, statusFilter, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar anuncio por producto, tienda o SKU" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={placementFilter} onValueChange={(v) => setPlacementFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {(Object.keys(PLACEMENT_LABEL) as SponsoredPlacementType[]).map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {(["Activo", "Programado", "Pausado", "Vencido"] as Status[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Nueva campaña</Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[2.5fr_1fr_1fr_1fr_0.8fr_auto] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground md:grid">
          <span>Producto</span><span>Ubicación</span><span>Vigencia</span><span>Pagado</span><span>Estado</span><span className="w-32 text-right">Acciones</span>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "Aún no hay campañas. Crea la primera con “Nueva campaña”." : "Ninguna campaña coincide con los filtros."}
          </div>
        ) : (
          <div className="divide-y">
            {visible.map((r) => {
              const st = statusOf(r);
              return (
                <div key={r.id} className="grid grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[2.5fr_1fr_1fr_1fr_0.8fr_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    {r.item?.imagen_principal ? <img src={r.item.imagen_principal} alt="" className="h-11 w-11 shrink-0 rounded object-cover" /> : <div className="h-11 w-11 shrink-0 rounded bg-muted" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.item?.nombre ?? "Producto no disponible"}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.item?.storeName ?? "—"} · Prioridad {r.priority}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {PLACEMENT_LABEL[r.placement]}
                    {r.categoryName && <p className="text-xs text-muted-foreground">{r.categoryName}</p>}
                  </div>
                  <div className="text-sm">
                    {daysLeft(r.ends_at)}
                    {r.ends_at && <p className="text-xs text-muted-foreground">Hasta {new Date(r.ends_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="text-sm font-medium">{Number(r.amount_paid || 0).toFixed(2)} {r.currency ?? "USD"}</div>
                  <div><Badge variant={STATUS_VARIANT[st]}>{st}</Badge></div>
                  <div className="flex w-32 items-center justify-end gap-1">
                    <Switch aria-label="Activar o pausar" checked={r.is_active} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Extender campaña"><CalendarPlus className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {[1, 7, 15, 30].map((d) => (
                          <DropdownMenuItem key={d} onClick={() => extend.mutate({ id: r.id, endsAt: r.ends_at, days: d })}>+{d} día{d === 1 ? "" : "s"}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" aria-label="Eliminar campaña" onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateCampaignDialog open={creating} onOpenChange={setCreating} />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar campaña?</DialogTitle>
            <DialogDescription>{confirmDelete?.item?.nombre} dejará de mostrarse. Si solo quieres detenerla, usa el interruptor para pausarla.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CreateCampaignDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [placements, setPlacements] = useState<SponsoredPlacementType[]>(["category"]);
  const [categoryId, setCategoryId] = useState("all");
  const [days, setDays] = useState("7");
  const [priority, setPriority] = useState("5");
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const search = useSponsorProductSearch(term);
  const { data: categories = [] } = usePublicCategories();
  const { create } = useAdminSponsoredPlacements();

  const reset = () => { setTerm(""); setPicked(null); setPlacements(["category"]); setCategoryId("all"); setDays("7"); setPriority("5"); setAmount("0"); setNotes(""); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const submit = () => {
    if (!picked || placements.length === 0) return;
    create.mutate({
      placements,
      sellerCatalogId: picked.source === "seller" ? picked.id : null,
      productId: picked.source === "kizkka" ? picked.id : null,
      storeId: picked.storeId,
      categoryId: categoryId === "all" ? null : categoryId,
      days: days === "0" ? null : Number(days),
      priority: Math.min(10, Math.max(1, Number(priority) || 1)),
      amountPaid: Number(amount) || 0,
      notes,
    }, { onSuccess: () => close(false) });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva campaña</DialogTitle>
          <DialogDescription>{picked ? "Paso 2 de 2 · Configura dónde y cuánto tiempo se mostrará." : "Paso 1 de 2 · Elige el producto a promocionar."}</DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Nombre o SKU (vendedores y Kizkka)" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {term.trim().length < 2 ? (
                <p className="p-4 text-sm text-muted-foreground">Escribe al menos 2 letras para buscar.</p>
              ) : search.isLoading ? (
                <div className="space-y-2 p-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (search.data || []).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Sin resultados.</p>
              ) : search.data!.map((r) => (
                <button key={r.key} type="button" onClick={() => setPicked(r)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted/60">
                  {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.storeName} · {r.sku}</p>
                  </div>
                  <span className="text-sm font-semibold">${r.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-2">
              {picked.image ? <img src={picked.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{picked.nombre}</p>
                <p className="text-xs text-muted-foreground">{picked.storeName} · ${picked.price.toFixed(2)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Cambiar</Button>
            </div>
            <div>
              <Label>Dónde mostrar</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(PLACEMENT_LABEL) as SponsoredPlacementType[]).map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={placements.includes(p)} onCheckedChange={(c) => setPlacements((cur) => c ? [...cur, p] : cur.filter((x) => x !== p))} />
                    {PLACEMENT_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>
            {placements.includes("category") && (
              <div>
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {(categories as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Duración</Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "3", "7", "15", "30"].map((d) => <SelectItem key={d} value={d}>{d} día{d === "1" ? "" : "s"}</SelectItem>)}
                    <SelectItem value="0">Sin fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad (1–10)</Label>
                <Input className="mt-1" type="number" min="1" max="10" value={priority} onChange={(e) => setPriority(e.target.value)} />
              </div>
              <div>
                <Label>Pagado (USD)</Label>
                <Input className="mt-1" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Referencia de pago, acuerdo con el vendedor…" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
          {picked && <Button disabled={create.isPending || placements.length === 0} onClick={submit}>Activar campaña</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
