import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Plus, Send, TestTube, Users, Trash2, Pencil, Loader2, Upload } from "lucide-react";

type Campaign = {
  id: string; name: string; subject: string; preheader: string | null; html_content: string;
  cta_label: string | null; cta_url: string | null; segment: string; language: string; status: string;
  recipients_count: number; sent_count: number; failed_count: number; sent_at: string | null; created_at: string;
};
type Subscriber = { id: string; email: string; full_name: string | null; language: string; source: string; status: string; created_at: string };

const SEGMENTS: Record<string, string> = { all: "Todos (clientes + suscriptores)", subscribers: "Solo suscriptores newsletter", buyers: "Compradores (B2C)", sellers: "Vendedores / Mayoristas (B2B)" };
const LANGS: Record<string, string> = { all: "Todos los idiomas", es: "Español", en: "English", fr: "Français", ht: "Kreyòl" };
const STATUS: Record<string, string> = { draft: "Borrador", sending: "Enviando", sent: "Enviada" };
const empty = { name: "", subject: "", preheader: "", html_content: "<p>Hola {nombre},</p>\n<p></p>", cta_label: "Ver ofertas", cta_url: "https://kizkka.com", segment: "all", language: "all" };
const db = supabase as any;

export default function AdminEmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [subs, setSubs] = useState<Subscriber[] | null>(null);
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [newSub, setNewSub] = useState({ email: "", full_name: "", language: "es" });
  const [bulk, setBulk] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      db.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      db.from("email_subscribers").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setCampaigns(c || []); setSubs(s || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!campaigns?.some((c) => c.status === "sending")) return;
    const t = setInterval(load, 4000); return () => clearInterval(t);
  }, [campaigns, load]);

  useEffect(() => {
    if (!edit) return;
    setCount(null);
    supabase.functions.invoke("email-campaigns", { body: { action: "count", segment: edit.segment, language: edit.language } })
      .then(({ data }) => setCount(data?.count ?? null));
  }, [edit?.segment, edit?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!edit?.name || !edit.subject) return toast.error("Nombre y asunto son obligatorios");
    const { id, ...row } = edit;
    const { error } = id ? await db.from("email_campaigns").update(row).eq("id", id) : await db.from("email_campaigns").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Campaña guardada"); setEdit(null); load();
    return undefined;
  };

  const act = async (c: Campaign, action: "test" | "send") => {
    if (action === "send" && !confirm(`¿Enviar "${c.name}" ahora? Esta acción no se puede deshacer.`)) return;
    setBusy(c.id + action);
    const { data, error } = await supabase.functions.invoke("email-campaigns", { body: { action, campaign_id: c.id, email: testEmail || undefined } });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error === "not_configured" ? "Configura Mailjet primero" : (data?.error || error?.message));
    toast.success(action === "test" ? "Correo de prueba enviado" : `Envío iniciado a ${data.recipients} destinatarios`);
    load();
    return undefined;
  };

  const remove = async (id: string) => { if (!confirm("¿Eliminar campaña?")) return; await db.from("email_campaigns").delete().eq("id", id); load(); };

  const addSub = async () => {
    if (!newSub.email.includes("@")) return toast.error("Email inválido");
    const { error } = await db.from("email_subscribers").upsert({ ...newSub, email: newSub.email.trim().toLowerCase(), source: "manual", status: "subscribed", unsubscribed_at: null }, { onConflict: "email" });
    if (error) return toast.error(error.message);
    setNewSub({ email: "", full_name: "", language: "es" }); load();
    return undefined;
  };
  const importBulk = async () => {
    const rows = bulk.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
      .map((email) => ({ email, source: "import", language: "es" }));
    if (!rows.length) return toast.error("No se encontraron emails válidos");
    const { error } = await db.from("email_subscribers").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} emails importados`); setBulk(""); load();
    return undefined;
  };
  const toggleSub = async (s: Subscriber) => {
    const unsub = s.status === "subscribed";
    await db.from("email_subscribers").update({ status: unsub ? "unsubscribed" : "subscribed", unsubscribed_at: unsub ? new Date().toISOString() : null }).eq("id", s.id);
    load();
    return undefined;
  };

  const active = subs?.filter((s) => s.status === "subscribed").length ?? 0;

  return (
    <AdminLayout title="Campañas de Email">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-primary" />
            <div><h1 className="text-2xl font-bold">Campañas de Email</h1><p className="text-sm text-muted-foreground">Boletines y promociones para tus clientes</p></div>
          </div>
          <Button onClick={() => setEdit({ ...empty })}><Plus className="w-4 h-4 mr-1" /> Nueva campaña</Button>
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList><TabsTrigger value="campaigns">Campañas</TabsTrigger><TabsTrigger value="subs">Suscriptores ({active})</TabsTrigger></TabsList>

          <TabsContent value="campaigns" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 max-w-sm"><Input placeholder="Email para pruebas (opcional)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /></div>
            {!campaigns ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />) :
              campaigns.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">Aún no hay campañas. Crea la primera.</CardContent></Card> :
              campaigns.map((c) => (
                <Card key={c.id}><CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold truncate">{c.name}</h3>
                      <Badge variant={c.status === "sent" ? "default" : "secondary"}>{STATUS[c.status] || c.status}</Badge></div>
                    <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">{SEGMENTS[c.segment]} · {LANGS[c.language]}
                      {c.status !== "draft" && <> · {c.sent_count}/{c.recipients_count} enviados{c.failed_count > 0 && `, ${c.failed_count} fallidos`}</>}
                      {c.sent_at && <> · {new Date(c.sent_at).toLocaleString()}</>}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(c, "test")}>{busy === c.id + "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}</Button>
                    {c.status === "draft" && <>
                      <Button size="sm" variant="outline" onClick={() => setEdit({ ...empty, ...c, preheader: c.preheader || "", cta_label: c.cta_label || "", cta_url: c.cta_url || "" })}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" disabled={!!busy} onClick={() => act(c, "send")}>{busy === c.id + "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}Enviar</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </>}
                  </div>
                </CardContent></Card>
              ))}
          </TabsContent>

          <TabsContent value="subs" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base flex gap-2 items-center"><Users className="w-4 h-4" />Añadir suscriptor</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input placeholder="email@ejemplo.com" value={newSub.email} onChange={(e) => setNewSub({ ...newSub, email: e.target.value })} />
                  <Input placeholder="Nombre (opcional)" value={newSub.full_name} onChange={(e) => setNewSub({ ...newSub, full_name: e.target.value })} />
                  <Select value={newSub.language} onValueChange={(v) => setNewSub({ ...newSub, language: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(LANGS).filter(([k]) => k !== "all").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                  <Button onClick={addSub} className="w-full">Añadir</Button>
                </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base flex gap-2 items-center"><Upload className="w-4 h-4" />Importar lista</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Textarea rows={6} placeholder="Pega emails separados por coma o salto de línea" value={bulk} onChange={(e) => setBulk(e.target.value)} />
                  <Button onClick={importBulk} variant="outline" className="w-full">Importar</Button>
                </CardContent></Card>
            </div>
            <Card><CardContent className="p-0 divide-y">
              {!subs ? <Skeleton className="h-40 m-4" /> : subs.length === 0 ? <p className="p-6 text-center text-muted-foreground">Sin suscriptores todavía.</p> :
                subs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{s.email}</p><p className="text-xs text-muted-foreground">{s.full_name || "—"} · {s.language.toUpperCase()} · {s.source}</p></div>
                    <Button size="sm" variant={s.status === "subscribed" ? "outline" : "secondary"} onClick={() => toggleSub(s)}>{s.status === "subscribed" ? "Dar de baja" : "Reactivar"}</Button>
                  </div>))}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar campaña" : "Nueva campaña"}</DialogTitle></DialogHeader>
          {edit && <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div><Label>Nombre interno</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Asunto</Label><Input value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="¡{nombre}, ofertas de temporada!" /></div>
              <div><Label>Pre-encabezado</Label><Input value={edit.preheader} onChange={(e) => setEdit({ ...edit, preheader: e.target.value })} /></div>
              <div><Label>Contenido (HTML)</Label><Textarea rows={8} className="font-mono text-xs" value={edit.html_content} onChange={(e) => setEdit({ ...edit, html_content: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Variables: {"{nombre}"}, {"{enlace_tienda}"}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Texto del botón</Label><Input value={edit.cta_label} onChange={(e) => setEdit({ ...edit, cta_label: e.target.value })} /></div>
                <div><Label>Enlace del botón</Label><Input value={edit.cta_url} onChange={(e) => setEdit({ ...edit, cta_url: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Audiencia</Label><Select value={edit.segment} onValueChange={(v) => setEdit({ ...edit, segment: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SEGMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Idioma</Label><Select value={edit.language} onValueChange={(v) => setEdit({ ...edit, language: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(LANGS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <p className="text-sm">Destinatarios estimados: <strong>{count ?? "…"}</strong></p>
              <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Guardar borrador</Button></div>
            </div>
            <div className="border rounded-lg overflow-hidden bg-muted">
              <iframe title="preview" className="w-full h-[560px] bg-background" srcDoc={`<div style="font-family:Arial;max-width:600px;margin:auto;padding:16px"><div style="background:#071d7f;color:#fff;padding:18px;text-align:center;font-weight:800;border-radius:12px 12px 0 0">Kizkka</div><div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;line-height:1.6">${edit.html_content.replace(/\{nombre\}/g, "María")}${edit.cta_label ? `<p style="text-align:center"><a style="display:inline-block;padding:10px 22px;background:#ce2e2e;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">${edit.cta_label}</a></p>` : ""}</div></div>`} />
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
