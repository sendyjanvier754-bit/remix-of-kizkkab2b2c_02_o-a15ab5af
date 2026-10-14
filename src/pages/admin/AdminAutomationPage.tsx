import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Store, Play, Save, Loader2, Mail, MessageCircle, TrendingUp, PackageX } from "lucide-react";

type Settings = {
  cart_recovery: { enabled: boolean; delay_hours: number; second_delay_hours: number; max_reminders: number; email: boolean; whatsapp: boolean; coupon_code: string; template_id?: string };
  seller_alerts: { enabled: boolean; new_sale: boolean; low_stock: boolean; low_stock_threshold: number; email: boolean; whatsapp: boolean };
};
type Stats = { reminders: number; emails: number; whatsapps: number; abandoned_value: number; recovered_count: number; recovered_value: number; sale_alerts: number; stock_alerts: number; recent: any[] };

const call = async (action: string, extra: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("marketing-automation", { body: { action, ...extra } });
  if (error) throw error;
  return data;
};
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const Row = ({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div><p className="text-sm font-medium">{label}</p>{desc && <p className="text-xs text-muted-foreground">{desc}</p>}</div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default function AdminAutomationPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [designs, setDesigns] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { supabase.from("email_templates").select("id,name").not("design_blocks", "is", null).order("updated_at", { ascending: false }).then(({ data }) => setDesigns((data as any) || [])); }, []);

  const load = async () => {
    try { const [a, b] = await Promise.all([call("get_settings"), call("stats")]); setS(a); setStats(b); }
    catch { toast.error("No se pudo cargar la automatización"); }
  };
  useEffect(() => { load(); }, []);

  const cr = <K extends keyof Settings["cart_recovery"]>(k: K, v: Settings["cart_recovery"][K]) => setS((p) => p && { ...p, cart_recovery: { ...p.cart_recovery, [k]: v } });
  const sa = <K extends keyof Settings["seller_alerts"]>(k: K, v: Settings["seller_alerts"][K]) => setS((p) => p && { ...p, seller_alerts: { ...p.seller_alerts, [k]: v } });

  const save = async () => {
    setSaving(true);
    try { setS(await call("save_settings", { settings: s })); toast.success("Configuración guardada"); }
    catch { toast.error("Error al guardar"); } finally { setSaving(false); }
  };
  const runNow = async () => {
    setRunning(true);
    try { const r = await call("run_now"); toast.success(`Carritos avisados: ${r.cart?.sent ?? 0} · Tiendas con stock bajo: ${r.stock?.stores ?? 0}`); load(); }
    catch { toast.error("Error al ejecutar"); } finally { setRunning(false); }
  };

  const kpis = stats ? [
    { icon: ShoppingCart, label: "Valor abandonado (30d)", value: money(stats.abandoned_value) },
    { icon: TrendingUp, label: "Ventas recuperadas", value: `${stats.recovered_count} · ${money(stats.recovered_value)}` },
    { icon: Mail, label: "Recordatorios email / WhatsApp", value: `${stats.emails} / ${stats.whatsapps}` },
    { icon: Store, label: "Avisos de venta / stock", value: `${stats.sale_alerts} / ${stats.stock_alerts}` },
  ] : [];

  return (
    <AdminLayout title="Automatizaciones" subtitle="Carritos abandonados y avisos a vendedores">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={runNow} disabled={running || !s}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Ejecutar ahora</Button>
          <Button onClick={save} disabled={saving || !s}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!stats ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : kpis.map((k) => (
            <Card key={k.label}><CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><k.icon className="h-5 w-5" /></div>
              <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-lg font-bold">{k.value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        {!s ? <Skeleton className="h-96" /> : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Carritos abandonados</CardTitle>
                <CardDescription>Recuerda a los clientes los productos que dejaron sin comprar.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Row label="Activar recuperación" checked={s.cart_recovery.enabled} onChange={(v) => cr("enabled", v)} />
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">1er aviso (horas)</Label><Input type="number" min={1} value={s.cart_recovery.delay_hours} onChange={(e) => cr("delay_hours", Number(e.target.value))} /></div>
                  <div><Label className="text-xs">2º aviso (horas)</Label><Input type="number" min={2} value={s.cart_recovery.second_delay_hours} onChange={(e) => cr("second_delay_hours", Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Máx. avisos</Label><Input type="number" min={1} max={2} value={s.cart_recovery.max_reminders} onChange={(e) => cr("max_reminders", Number(e.target.value))} /></div>
                </div>
                <div><Label className="text-xs">Cupón opcional en el correo</Label><Input placeholder="Ej: VUELVE10" value={s.cart_recovery.coupon_code} onChange={(e) => cr("coupon_code", e.target.value)} /></div>
                <div><Label className="text-xs">Diseño del correo</Label>
                  <Select value={s.cart_recovery.template_id || "default"} onValueChange={(v) => cr("template_id", v === "default" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="default">Diseño estándar de Kizkka</SelectItem>{designs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Crea diseños en el Diseñador. Puedes usar {"{nombre}"}, {"{productos}"}, {"{total}"} y {"{enlace_carrito}"} en los textos.</p>
                </div>
                <Row label="Enviar por correo" checked={s.cart_recovery.email} onChange={(v) => cr("email", v)} />
                <Row label="Enviar por WhatsApp" checked={s.cart_recovery.whatsapp} onChange={(v) => cr("whatsapp", v)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Avisos a vendedores</CardTitle>
                <CardDescription>Notifica a cada tienda sus ventas pagadas y productos por agotarse.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Row label="Activar avisos" checked={s.seller_alerts.enabled} onChange={(v) => sa("enabled", v)} />
                <Row label="Nueva venta pagada" desc="Artículos, monto neto y datos de envío" checked={s.seller_alerts.new_sale} onChange={(v) => sa("new_sale", v)} />
                <Row label="Stock crítico" desc="Máximo un aviso por tienda al día" checked={s.seller_alerts.low_stock} onChange={(v) => sa("low_stock", v)} />
                <div><Label className="text-xs">Avisar cuando el stock sea igual o menor a</Label><Input type="number" min={0} value={s.seller_alerts.low_stock_threshold} onChange={(e) => sa("low_stock_threshold", Number(e.target.value))} /></div>
                <Row label="Enviar por correo" checked={s.seller_alerts.email} onChange={(v) => sa("email", v)} />
                <Row label="Enviar por WhatsApp" checked={s.seller_alerts.whatsapp} onChange={(v) => sa("whatsapp", v)} />
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Últimos recordatorios</CardTitle></CardHeader>
          <CardContent>
            {!stats ? <Skeleton className="h-32" /> : stats.recent.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><PackageX className="h-4 w-4" />Aún no se han enviado recordatorios.</p>
            ) : (
              <div className="divide-y">
                {stats.recent.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>{new Date(r.created_at).toLocaleString()} · {r.cart_type.toUpperCase()} · aviso {r.attempt}</span>
                    <span className="flex items-center gap-2">
                      {money(r.cart_total)}
                      {r.email_sent && <Mail className="h-4 w-4 text-muted-foreground" />}
                      {r.whatsapp_sent && <MessageCircle className="h-4 w-4 text-muted-foreground" />}
                      {r.recovered_at ? <Badge>Recuperado</Badge> : <Badge variant="outline">Pendiente</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
