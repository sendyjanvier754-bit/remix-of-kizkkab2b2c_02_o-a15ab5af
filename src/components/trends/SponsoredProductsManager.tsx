import { useState } from "react";
import { Megaphone, Search, Trash2 } from "lucide-react";
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
import { usePublicCategories } from "@/hooks/useCategories";
import {
  useAdminSponsoredPlacements,
  useSponsorProductSearch,
  type SearchResult,
  type SponsoredPlacementType,
} from "@/hooks/useSponsoredPlacements";

const PLACEMENT_LABEL: Record<SponsoredPlacementType, string> = {
  category: "Categorías (franja superior)",
  trends: "Tendencias",
  news: "Noticias",
};

const statusOf = (r: { is_active: boolean; starts_at: string; ends_at: string | null }) => {
  if (!r.is_active) return { label: "Pausado", cls: "bg-muted text-muted-foreground" };
  if (r.ends_at && new Date(r.ends_at) <= new Date()) return { label: "Vencido", cls: "bg-muted text-muted-foreground" };
  if (new Date(r.starts_at) > new Date()) return { label: "Programado", cls: "bg-secondary text-secondary-foreground" };
  return { label: "Activo", cls: "bg-primary text-primary-foreground" };
};

export const SponsoredProductsManager = () => {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [placements, setPlacements] = useState<SponsoredPlacementType[]>(["category"]);
  const [categoryId, setCategoryId] = useState("all");
  const [days, setDays] = useState("7");
  const [priority, setPriority] = useState("0");
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | SponsoredPlacementType>("all");

  const search = useSponsorProductSearch(term);
  const { data: categories = [] } = usePublicCategories();
  const { rows, isLoading, create, toggle, remove } = useAdminSponsoredPlacements();

  const openFor = (r: SearchResult) => {
    setPicked(r); setPlacements(["category"]); setCategoryId("all"); setDays("7"); setPriority("0"); setAmount("0"); setNotes("");
  };

  const submit = () => {
    if (!picked || placements.length === 0) return;
    create.mutate({
      placements,
      sellerCatalogId: picked.source === "seller" ? picked.id : null,
      productId: picked.source === "kizkka" ? picked.id : null,
      storeId: picked.storeId,
      categoryId: categoryId === "all" ? null : categoryId,
      days: days === "0" ? null : Number(days),
      priority: Number(priority) || 0,
      amountPaid: Number(amount) || 0,
      notes,
    }, { onSuccess: () => setPicked(null) });
  };

  const visible = rows.filter((r) => filter === "all" || r.placement === filter);
  const activeCount = rows.filter((r) => statusOf(r).label === "Activo").length;
  const revenue = rows.reduce((t, r) => t + Number(r.amount_paid || 0), 0);

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Kizkka Ads · Productos patrocinados</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pon productos de cualquier vendedor más a la vista. Si no hay anuncios activos, se muestran productos de Kizkka.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <div className="rounded-lg border px-3 py-2"><p className="text-muted-foreground text-xs">Activos</p><p className="font-bold">{activeCount}</p></div>
          <div className="rounded-lg border px-3 py-2"><p className="text-muted-foreground text-xs">Ingresos registrados</p><p className="font-bold">${revenue.toFixed(2)}</p></div>
        </div>
      </div>

      {/* Search */}
      <div className="mt-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar producto por nombre o SKU (vendedores y Kizkka)…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        {term.trim().length >= 2 && (
          <div className="mt-2 max-h-80 divide-y overflow-y-auto rounded-lg border">
            {search.isLoading ? (
              <div className="p-3"><Skeleton className="h-10 w-full" /></div>
            ) : (search.data || []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              search.data!.map((r) => (
                <div key={r.key} className="flex items-center gap-3 p-2">
                  {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">{r.storeName} · {r.sku} · ${r.price.toFixed(2)}</p>
                  </div>
                  <Button size="sm" onClick={() => openFor(r)}>Patrocinar</Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Placements list */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Anuncios</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {(Object.keys(PLACEMENT_LABEL) as SponsoredPlacementType[]).map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 divide-y rounded-lg border">
        {isLoading ? (
          <div className="p-3"><Skeleton className="h-12 w-full" /></div>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay productos patrocinados.</p>
        ) : visible.map((r) => {
          const st = statusOf(r);
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              {r.item?.imagen_principal ? <img src={r.item.imagen_principal} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.item?.nombre ?? "Producto no disponible"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.item?.storeName ?? "—"} · {PLACEMENT_LABEL[r.placement]}{r.categoryName ? ` · ${r.categoryName}` : ""} · Prioridad {r.priority}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.ends_at ? `Hasta ${new Date(r.ends_at).toLocaleDateString()}` : "Sin fecha de fin"}
                  {Number(r.amount_paid) > 0 ? ` · Pagado ${Number(r.amount_paid).toFixed(2)} ${r.currency ?? "USD"}` : ""}
                </p>
              </div>
              <Badge className={st.cls}>{st.label}</Badge>
              <Switch checked={r.is_active} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })} />
              <Button variant="ghost" size="icon" aria-label="Eliminar anuncio" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Patrocinar producto</DialogTitle>
            <DialogDescription>{picked?.nombre} · {picked?.storeName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Dónde mostrar</Label>
              <div className="mt-2 space-y-2">
                {(Object.keys(PLACEMENT_LABEL) as SponsoredPlacementType[]).map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
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
                    <SelectItem value="1">1 día</SelectItem>
                    <SelectItem value="3">3 días</SelectItem>
                    <SelectItem value="7">7 días</SelectItem>
                    <SelectItem value="15">15 días</SelectItem>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="0">Sin fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Input className="mt-1" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicked(null)}>Cancelar</Button>
            <Button disabled={create.isPending || placements.length === 0} onClick={submit}>Activar anuncio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
