import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, Copy, Image as ImageIcon, LayoutTemplate, Monitor, MousePointerClick,
  Plus, Save, Send, Upload, Loader2, Search, X, Share2, ShoppingBag, Smartphone, Ticket, Trash2, Type, PanelTop, PanelBottom,
} from "lucide-react";

type BlockType = "header" | "hero" | "text" | "products" | "coupon" | "button" | "social" | "footer";
type Block = { id: string; type: BlockType; data: Record<string, any> };

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const BLOCKS: { type: BlockType; label: string; icon: any; data: Record<string, any> }[] = [
  { type: "header", label: "Cabecera", icon: PanelTop, data: { logo: "", brand: "Kizkka", bg: "#071d7f" } },
  { type: "hero", label: "Banner", icon: ImageIcon, data: { image: "", title: "Nuevas ofertas para ti", subtitle: "Descubre lo último en Kizkka" } },
  { type: "text", label: "Texto", icon: Type, data: { text: "Hola {nombre}, tenemos novedades que te van a encantar." } },
  { type: "products", label: "Productos", icon: ShoppingBag, data: { items: [{ name: "Producto 1", price: "$19.99", image: "", url: "https://kizkka.com" }, { name: "Producto 2", price: "$24.99", image: "", url: "https://kizkka.com" }] } },
  { type: "coupon", label: "Cupón", icon: Ticket, data: { code: "KIZKKA10", text: "10% de descuento en tu próxima compra" } },
  { type: "button", label: "Botón", icon: MousePointerClick, data: { label: "Comprar ahora", url: "https://kizkka.com", color: "#ce2e2e" } },
  { type: "social", label: "Redes", icon: Share2, data: { facebook: "", instagram: "", tiktok: "", whatsapp: "" } },
  { type: "footer", label: "Pie legal", icon: PanelBottom, data: { text: "© Kizkka. Todos los derechos reservados.", unsubscribe: true } },
];
const make = (t: BlockType): Block => ({ id: uid(), type: t, data: structuredClone(BLOCKS.find((b) => b.type === t)!.data) });

const PRESETS: Record<string, { label: string; blocks: BlockType[] }> = {
  promo: { label: "Promoción", blocks: ["header", "hero", "text", "coupon", "button", "footer"] },
  catalog: { label: "Catálogo de productos", blocks: ["header", "text", "products", "button", "social", "footer"] },
  news: { label: "Novedades", blocks: ["header", "hero", "text", "button", "social", "footer"] },
};

function blockHtml(b: Block): string {
  const d = b.data;
  switch (b.type) {
    case "header": return `<tr><td style="background:${esc(d.bg)};padding:24px;text-align:center">${d.logo ? `<img src="${esc(d.logo)}" alt="${esc(d.brand)}" style="max-height:44px">` : `<span style="font-size:24px;font-weight:800;color:#ffffff">${esc(d.brand)}</span>`}</td></tr>`;
    case "hero": return `<tr><td style="padding:0">${d.image ? `<img src="${esc(d.image)}" style="width:100%;display:block">` : ""}<div style="padding:24px 28px 8px;text-align:center"><h1 style="margin:0;font-size:26px;color:#071d7f">${esc(d.title)}</h1><p style="margin:8px 0 0;color:#4b5563">${esc(d.subtitle)}</p></div></td></tr>`;
    case "text": return `<tr><td style="padding:16px 28px;font-size:15px;line-height:1.6;color:#1f2937">${esc(d.text).replace(/\n/g, "<br>")}</td></tr>`;
    case "products": return `<tr><td style="padding:12px 20px"><table width="100%" cellpadding="0" cellspacing="0"><tr>${(d.items || []).map((p: any) => `<td width="${Math.floor(100 / Math.max(1, d.items.length))}%" style="padding:6px;vertical-align:top;text-align:center"><a href="${esc(p.url)}" style="text-decoration:none;color:#1f2937">${p.image ? `<img src="${esc(p.image)}" style="width:100%;border-radius:10px">` : `<div style="background:#f3f4f6;height:120px;border-radius:10px"></div>`}<p style="margin:8px 0 2px;font-size:14px">${esc(p.name)}</p><p style="margin:0;font-weight:800;color:#ce2e2e">${esc(p.price)}</p></a></td>`).join("")}</tr></table></td></tr>`;
    case "coupon": return `<tr><td style="padding:16px 28px"><div style="border:2px dashed #ce2e2e;border-radius:12px;padding:18px;text-align:center"><p style="margin:0 0 6px;color:#4b5563">${esc(d.text)}</p><p style="margin:0;font-size:24px;font-weight:800;letter-spacing:3px;color:#ce2e2e">${esc(d.code)}</p></div></td></tr>`;
    case "button": return `<tr><td style="padding:16px 28px;text-align:center"><a href="${esc(d.url)}" style="display:inline-block;padding:13px 28px;border-radius:999px;background:${esc(d.color)};color:#ffffff;font-weight:700;text-decoration:none">${esc(d.label)}</a></td></tr>`;
    case "social": {
      const links = (["facebook", "instagram", "tiktok", "whatsapp"] as const).filter((k) => d[k]).map((k) => `<a href="${esc(d[k])}" style="margin:0 8px;color:#071d7f;font-weight:600;text-decoration:none;text-transform:capitalize">${k}</a>`).join("");
      return links ? `<tr><td style="padding:16px;text-align:center">${links}</td></tr>` : "";
    }
    case "footer": return `<tr><td style="padding:18px;text-align:center;color:#6b7280;font-size:12px;background:#f9fafb">${esc(d.text)}${d.unsubscribe ? `<br><a href="{unsubscribe_url}" style="color:#6b7280">Darse de baja</a>` : ""}</td></tr>`;
  }
}
export const renderEmail = (blocks: Block[]) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">${blocks.map(blockHtml).join("")}</table></td></tr></table></body></html>`;

const SITE = "https://kizkka.com";
const fn = async (action: string, extra: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("email-campaigns", { body: { action, ...extra } });
  if (error) { let m = error.message; try { m = (await (error as any).context.json()).error || m; } catch { /* */ } throw new Error(m); }
  return data;
};

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("El archivo debe ser una imagen");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5 MB");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user?.id}/email-assets/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      onChange(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      toast.success("Imagen subida");
    } catch (e: any) { toast.error("No se pudo subir: " + e.message); } finally { setBusy(false); }
  };
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>
    {value && <img src={value} alt="" className="h-16 w-full rounded border object-contain bg-muted" />}
    <div className="flex gap-1">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL o sube desde tu PC" className="text-xs" />
      <Button asChild size="icon" variant="outline" className="shrink-0"><label className="cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}<input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
    </div></div>;
}

function ProductPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: { name: string; price: string; image: string; url: string }) => void }) {
  const [q, setQ] = useState(""); const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      let qq = supabase.from("products").select("id,nombre,sku_interno,imagen_principal,galeria_imagenes,precio_sugerido_venta,precio_promocional,promo_active").eq("is_active", true).order("created_at", { ascending: false }).limit(40);
      if (q.trim()) qq = qq.ilike("nombre", `%${q.trim()}%`);
      const { data } = await qq; setRows(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl">
    <DialogHeader><DialogTitle>Elegir producto del catálogo</DialogTitle></DialogHeader>
    <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..." /></div>
    <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
      {!rows ? <p className="col-span-full text-sm text-muted-foreground">Cargando...</p> : rows.length === 0 ? <p className="col-span-full text-sm text-muted-foreground">Sin resultados</p> : rows.map((p) => {
        const img = p.imagen_principal || p.galeria_imagenes?.[0] || "";
        const price = p.promo_active && p.precio_promocional ? p.precio_promocional : p.precio_sugerido_venta;
        return <button key={p.id} onClick={() => { onPick({ name: p.nombre, price: price ? `$${Number(price).toFixed(2)}` : "", image: img, url: `${SITE}/producto/${encodeURIComponent(p.sku_interno || p.id)}` }); onClose(); }} className="rounded-md border p-2 text-left hover:border-primary">
          {img ? <img src={img} alt="" className="aspect-square w-full rounded object-cover" /> : <div className="aspect-square w-full rounded bg-muted" />}
          <p className="mt-1 line-clamp-2 text-xs">{p.nombre}</p>{price && <p className="text-xs font-bold text-price">${Number(price).toFixed(2)}</p>}
        </button>;
      })}
    </div></DialogContent></Dialog>;
}

function CouponPanel({ onUse }: { onUse: (code: string, text: string) => void }) {
  const [list, setList] = useState<any[]>([]); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ code: "", discount_type: "percentage", discount_value: "10", min_purchase_amount: "", max_uses: "", valid_until: "" });
  const describe = (c: any) => c.discount_type === "fixed" ? `$${Number(c.discount_value).toFixed(2)} de descuento en tu compra` : `${Number(c.discount_value)}% de descuento en tu compra`;
  const load = () => fn("list_coupons").then((d) => setList(d.coupons || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async () => {
    setBusy(true);
    try { const { coupon } = await fn("create_coupon", f); toast.success(`Cupón ${coupon.code} creado`); onUse(coupon.code, describe(coupon)); setOpen(false); load(); }
    catch (e: any) { toast.error(e.message === "code_exists" ? "Ese código ya existe" : "No se pudo crear el cupón"); } finally { setBusy(false); }
  };
  return <div className="space-y-2 rounded-md border p-2">
    <Label className="text-xs">Cupones activos</Label>
    <Select onValueChange={(id) => { const c = list.find((x) => x.id === id); if (c) onUse(c.code, describe(c)); }}>
      <SelectTrigger><SelectValue placeholder={list.length ? "Elegir cupón existente" : "No hay cupones"} /></SelectTrigger>
      <SelectContent>{list.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.discount_type === "fixed" ? `$${c.discount_value}` : `${c.discount_value}%`}</SelectItem>)}</SelectContent>
    </Select>
    <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}><Plus className="mr-1 h-3 w-3" />Crear código de descuento</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Nuevo código de descuento</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Código</Label><div className="flex gap-1"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="KIZKKA15" /><Button variant="outline" onClick={() => setF({ ...f, code: "KZ" + Math.random().toString(36).slice(2, 8).toUpperCase() })}>Generar</Button></div></div>
        <div className="space-y-1"><Label className="text-xs">Tipo</Label><Select value={f.discount_type} onValueChange={(v) => setF({ ...f, discount_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Porcentaje (%)</SelectItem><SelectItem value="fixed">Monto fijo ($)</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Valor</Label><Input type="number" value={f.discount_value} onChange={(e) => setF({ ...f, discount_value: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Compra mínima ($, opcional)</Label><Input type="number" value={f.min_purchase_amount} onChange={(e) => setF({ ...f, min_purchase_amount: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Usos máximos (opcional)</Label><Input type="number" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Válido hasta (opcional)</Label><Input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></div>
      </div>
      <Button onClick={create} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear y usar en el correo</Button>
    </DialogContent></Dialog>
  </div>;
}

const SEGMENTS: Record<string, string> = { all: "Todos (usuarios + suscriptores)", buyers: "Compradores (B2C)", sellers: "Vendedores (B2B)", subscribers: "Suscriptores newsletter" };

function SendDialog({ open, onClose, subject, html }: { open: boolean; onClose: () => void; subject: string; html: string }) {
  const [mode, setMode] = useState<"users" | "segment">("users");
  const [segment, setSegment] = useState("all"); const [count, setCount] = useState<number | null>(null);
  const [q, setQ] = useState(""); const [users, setUsers] = useState<any[]>([]); const [picked, setPicked] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; const t = setTimeout(() => fn("search_users", { q }).then((d) => setUsers(d.users || [])).catch(() => {}), 300); return () => clearTimeout(t); }, [q, open]);
  useEffect(() => { if (!open || mode !== "segment") return; setCount(null); fn("count", { segment, language: "all" }).then((d) => setCount(d.count)).catch(() => {}); }, [segment, mode, open]);
  const ids = Object.keys(picked);
  const total = mode === "users" ? ids.length : count ?? 0;
  const send = async () => {
    if (!total) return toast.error("Elige al menos un destinatario");
    if (!confirm(`¿Enviar "${subject}" a ${total} destinatario(s)?`)) return;
    setBusy(true);
    try { const r = await fn("send_direct", { subject, html, ...(mode === "users" ? { user_ids: ids } : { segment }) }); toast.success(`Enviados: ${r.sent} · Fallidos: ${r.failed}`); onClose(); setPicked({}); }
    catch (e: any) { toast.error("No se pudo enviar: " + e.message); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-xl">
    <DialogHeader><DialogTitle>Enviar correo: {subject}</DialogTitle></DialogHeader>
    <div className="flex gap-1">
      <Button size="sm" variant={mode === "users" ? "default" : "outline"} onClick={() => setMode("users")}>Usuarios específicos</Button>
      <Button size="sm" variant={mode === "segment" ? "default" : "outline"} onClick={() => setMode("segment")}>Grupo / Todos</Button>
    </div>
    {mode === "users" ? <div className="space-y-2">
      {ids.length > 0 && <div className="flex flex-wrap gap-1">{ids.map((id) => <Badge key={id} variant="secondary" className="gap-1">{picked[id].full_name || picked[id].email}<X className="h-3 w-3 cursor-pointer" onClick={() => setPicked(({ [id]: _, ...r }) => r)} /></Badge>)}</div>}
      <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" /></div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {users.map((u) => <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
          <Checkbox checked={!!picked[u.id]} onCheckedChange={(c) => setPicked((p) => { const n = { ...p }; if (c) n[u.id] = u; else delete n[u.id]; return n; })} />
          <span className="min-w-0 flex-1 truncate">{u.full_name || "Sin nombre"} <span className="text-muted-foreground">· {u.email}</span></span>
        </label>)}
        {users.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(users.map((u) => [u.id, u])) }))}>Seleccionar todos los visibles</Button>}
      </div>
    </div> : <div className="space-y-2">
      <Select value={segment} onValueChange={setSegment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SEGMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      <p className="text-sm text-muted-foreground">{count === null ? "Calculando destinatarios..." : `${count} destinatario(s)`}. Las personas dadas de baja se excluyen.</p>
    </div>}
    <Button onClick={send} disabled={busy || !total}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar a {total}</Button>
  </DialogContent></Dialog>;
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{area ? <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <Input value={value} onChange={(e) => onChange(e.target.value)} />}</div>;
}

export default function AdminEmailDesignerPage() {
  const [blocks, setBlocks] = useState<Block[]>(() => PRESETS.promo.blocks.map(make));
  const [sel, setSel] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [name, setName] = useState("Nueva plantilla");
  const [subject, setSubject] = useState("Novedades de Kizkka");
  const [purpose, setPurpose] = useState("marketing");
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const html = useMemo(() => renderEmail(blocks), [blocks]);

  const loadTemplates = async () => {
    const { data } = await supabase.from("email_templates").select("id,name,subject,purpose,design_blocks").not("design_blocks", "is", null).order("updated_at", { ascending: false });
    setTemplates(data || []);
  };
  useEffect(() => { loadTemplates(); }, []);

  const update = (id: string, patch: Record<string, any>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)));
  const move = (i: number, dir: -1 | 1) => setBlocks((bs) => { const n = [...bs]; const j = i + dir; if (j < 0 || j >= n.length) return bs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const current = blocks.find((b) => b.id === sel);

  const save = async () => {
    const payload: any = { name, subject, purpose, html_content: html, design_blocks: blocks, is_active: true, variables: ["nombre", "unsubscribe_url"] };
    const q = editingId ? supabase.from("email_templates").update(payload).eq("id", editingId).select("id").single() : supabase.from("email_templates").insert(payload).select("id").single();
    const { data, error } = await q;
    if (error) return toast.error("No se pudo guardar: " + error.message);
    setEditingId(data.id); toast.success("Plantilla guardada"); loadTemplates();
  };
  const open = (t: any) => { setBlocks(t.design_blocks); setName(t.name); setSubject(t.subject); setPurpose(t.purpose); setEditingId(t.id); setSel(null); };
  const copyHtml = async () => { await navigator.clipboard.writeText(html); toast.success("HTML copiado: pégalo en una campaña"); };

  return (
    <AdminLayout title="Diseñador de correos" subtitle="Arma correos con bloques, sin escribir código">
      <div className="grid gap-4 xl:grid-cols-[260px_1fr_320px]">
        {/* Left: blocks & presets */}
        <div className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Añadir bloque</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {BLOCKS.map((b) => (
                <Button key={b.type} variant="outline" size="sm" className="h-auto flex-col gap-1 py-3" onClick={() => { const nb = make(b.type); setBlocks((bs) => [...bs, nb]); setSel(nb.id); }}>
                  <b.icon className="h-4 w-4" /><span className="text-xs">{b.label}</span>
                </Button>
              ))}
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><LayoutTemplate className="h-4 w-4" />Plantillas base</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(PRESETS).map(([k, p]) => <Button key={k} variant="secondary" size="sm" className="w-full justify-start" onClick={() => { setBlocks(p.blocks.map(make)); setEditingId(null); setSel(null); }}>{p.label}</Button>)}
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Mis diseños</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {templates.length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay diseños guardados.</p> : templates.map((t) => (
                <button key={t.id} onClick={() => open(t)} className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${editingId === t.id ? "bg-muted font-medium" : ""}`}>{t.name}</button>
              ))}
            </CardContent></Card>
        </div>

        {/* Center: preview */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex gap-1">
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}><Monitor className="mr-1 h-4 w-4" />Escritorio</Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}><Smartphone className="mr-1 h-4 w-4" />Móvil</Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyHtml}><Copy className="mr-1 h-4 w-4" />Copiar HTML</Button>
              <Button size="sm" variant="outline" onClick={save}><Save className="mr-1 h-4 w-4" />Guardar</Button>
              <Button size="sm" onClick={() => setSendOpen(true)}><Send className="mr-1 h-4 w-4" />Enviar correo</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto" />
              <Select value={purpose} onValueChange={setPurpose}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="marketing">Marketing</SelectItem><SelectItem value="notifications">Notificaciones</SelectItem><SelectItem value="orders">Pedidos</SelectItem></SelectContent></Select>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className={`mx-auto transition-all ${device === "mobile" ? "max-w-[375px]" : "max-w-[680px]"}`}>
                <iframe title="preview" srcDoc={html} className="h-[640px] w-full rounded-md border bg-background" />
              </div>
            </div>
            <div className="space-y-1">
              {blocks.map((b, i) => {
                const meta = BLOCKS.find((x) => x.type === b.type)!;
                return (
                  <div key={b.id} onClick={() => setSel(b.id)} className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm ${sel === b.id ? "border-primary bg-primary/5" : ""}`}>
                    <span className="flex items-center gap-2"><meta.icon className="h-4 w-4" />{meta.label}</span>
                    <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setBlocks((bs) => bs.filter((x) => x.id !== b.id)); if (sel === b.id) setSel(null); }}><Trash2 className="h-3 w-3" /></Button>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: editor */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Editar bloque</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!current ? <p className="text-sm text-muted-foreground">Selecciona un bloque de la lista para editarlo.</p> : (() => {
              const d = current.data, u = (p: Record<string, any>) => update(current.id, p);
              switch (current.type) {
                case "header": return <><ImageField label="Logo" value={d.logo} onChange={(v) => u({ logo: v })} /><Field label="Nombre de marca" value={d.brand} onChange={(v) => u({ brand: v })} /><div className="space-y-1"><Label className="text-xs">Color de fondo</Label><Input type="color" value={d.bg} onChange={(e) => u({ bg: e.target.value })} /></div></>;
                case "hero": return <><ImageField label="Imagen" value={d.image} onChange={(v) => u({ image: v })} /><Field label="Título" value={d.title} onChange={(v) => u({ title: v })} /><Field label="Subtítulo" value={d.subtitle} onChange={(v) => u({ subtitle: v })} area /></>;
                case "text": return <><Field label="Texto ({nombre} se reemplaza)" value={d.text} onChange={(v) => u({ text: v })} area /></>;
                case "coupon": return <><CouponPanel onUse={(code, text) => u({ code, text })} /><Field label="Código" value={d.code} onChange={(v) => u({ code: v })} /><Field label="Descripción" value={d.text} onChange={(v) => u({ text: v })} /></>;
                case "button": return <><Field label="Texto del botón" value={d.label} onChange={(v) => u({ label: v })} /><Field label="Enlace" value={d.url} onChange={(v) => u({ url: v })} /><div className="space-y-1"><Label className="text-xs">Color</Label><Input type="color" value={d.color} onChange={(e) => u({ color: e.target.value })} /></div></>;
                case "social": return <>{["facebook", "instagram", "tiktok", "whatsapp"].map((k) => <Field key={k} label={k} value={d[k]} onChange={(v) => u({ [k]: v })} />)}</>;
                case "footer": return <><Field label="Texto legal" value={d.text} onChange={(v) => u({ text: v })} area /></>;
                case "products": return <>
                  {d.items.map((p: any, i: number) => (
                    <div key={i} className="space-y-2 rounded-md border p-2">
                      <Button size="sm" variant="secondary" className="w-full" onClick={() => setPickerFor(i)}><ShoppingBag className="mr-1 h-3 w-3" />Elegir del catálogo</Button>
                      {(["name", "price", "image", "url"] as const).map((k) => { const ch = (v: string) => u({ items: d.items.map((x: any, j: number) => (j === i ? { ...x, [k]: v } : x)) }); return k === "image" ? <ImageField key={k} label="Imagen" value={p[k]} onChange={ch} /> : <Field key={k} label={{ name: "Nombre", price: "Precio", url: "Enlace" }[k]} value={p[k]} onChange={ch} />; })}
                      <Button size="sm" variant="ghost" onClick={() => u({ items: d.items.filter((_: any, j: number) => j !== i) })}><Trash2 className="mr-1 h-3 w-3" />Quitar</Button>
                    </div>
                  ))}
                  {d.items.length < 3 && <Button size="sm" variant="outline" onClick={() => u({ items: [...d.items, { name: "Producto", price: "$0.00", image: "", url: "https://kizkka.com" }] })}><Plus className="mr-1 h-3 w-3" />Añadir producto</Button>}
                </>;
              }
            })()}
          </CardContent></Card>
      </div>
      <ProductPicker open={pickerFor !== null} onClose={() => setPickerFor(null)} onPick={(p) => { if (current && pickerFor !== null) update(current.id, { items: current.data.items.map((x: any, j: number) => (j === pickerFor ? p : x)) }); }} />
      <SendDialog open={sendOpen} onClose={() => setSendOpen(false)} subject={subject} html={html} />
    </AdminLayout>
  );
}
