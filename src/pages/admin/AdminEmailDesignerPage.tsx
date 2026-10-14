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
import {
  ArrowDown, ArrowUp, Copy, Image as ImageIcon, LayoutTemplate, Monitor, MousePointerClick,
  Plus, Save, Share2, ShoppingBag, Smartphone, Ticket, Trash2, Type, PanelTop, PanelBottom,
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
              <Button size="sm" onClick={save}><Save className="mr-1 h-4 w-4" />Guardar</Button>
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
                case "header": return <><Field label="Logo (URL)" value={d.logo} onChange={(v) => u({ logo: v })} /><Field label="Nombre de marca" value={d.brand} onChange={(v) => u({ brand: v })} /><div className="space-y-1"><Label className="text-xs">Color de fondo</Label><Input type="color" value={d.bg} onChange={(e) => u({ bg: e.target.value })} /></div></>;
                case "hero": return <><Field label="Imagen (URL)" value={d.image} onChange={(v) => u({ image: v })} /><Field label="Título" value={d.title} onChange={(v) => u({ title: v })} /><Field label="Subtítulo" value={d.subtitle} onChange={(v) => u({ subtitle: v })} area /></>;
                case "text": return <><Field label="Texto ({nombre} se reemplaza)" value={d.text} onChange={(v) => u({ text: v })} area /></>;
                case "coupon": return <><Field label="Código" value={d.code} onChange={(v) => u({ code: v })} /><Field label="Descripción" value={d.text} onChange={(v) => u({ text: v })} /></>;
                case "button": return <><Field label="Texto del botón" value={d.label} onChange={(v) => u({ label: v })} /><Field label="Enlace" value={d.url} onChange={(v) => u({ url: v })} /><div className="space-y-1"><Label className="text-xs">Color</Label><Input type="color" value={d.color} onChange={(e) => u({ color: e.target.value })} /></div></>;
                case "social": return <>{["facebook", "instagram", "tiktok", "whatsapp"].map((k) => <Field key={k} label={k} value={d[k]} onChange={(v) => u({ [k]: v })} />)}</>;
                case "footer": return <><Field label="Texto legal" value={d.text} onChange={(v) => u({ text: v })} area /></>;
                case "products": return <>
                  {d.items.map((p: any, i: number) => (
                    <div key={i} className="space-y-2 rounded-md border p-2">
                      {(["name", "price", "image", "url"] as const).map((k) => <Field key={k} label={{ name: "Nombre", price: "Precio", image: "Imagen (URL)", url: "Enlace" }[k]} value={p[k]} onChange={(v) => u({ items: d.items.map((x: any, j: number) => (j === i ? { ...x, [k]: v } : x)) })} />)}
                      <Button size="sm" variant="ghost" onClick={() => u({ items: d.items.filter((_: any, j: number) => j !== i) })}><Trash2 className="mr-1 h-3 w-3" />Quitar</Button>
                    </div>
                  ))}
                  {d.items.length < 3 && <Button size="sm" variant="outline" onClick={() => u({ items: [...d.items, { name: "Producto", price: "$0.00", image: "", url: "https://kizkka.com" }] })}><Plus className="mr-1 h-3 w-3" />Añadir producto</Button>}
                </>;
              }
            })()}
          </CardContent></Card>
      </div>
    </AdminLayout>
  );
}
