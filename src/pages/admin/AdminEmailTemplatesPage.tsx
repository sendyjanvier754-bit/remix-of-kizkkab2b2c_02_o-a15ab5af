import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, FileText, Globe, Send, Loader2, Eye, Plus, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Code, TestTube
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface EmailTemplate {
  id: string;
  purpose: string;
  destination_country_id: string | null;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailSender {
  id: string;
  purpose: string;
  sender_email: string;
  sender_name: string;
  is_active: boolean;
  destination_country_id: string | null;
}

interface DestinationCountry {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

const PURPOSE_OPTIONS = [
  { value: "authentication", label: "Autenticación", icon: "🔐" },
  { value: "orders", label: "Pedidos / Ventas", icon: "📦" },
  { value: "notifications", label: "Notificaciones", icon: "🔔" },
  { value: "marketing", label: "Marketing", icon: "📢" },
  { value: "support", label: "Soporte", icon: "🎧" },
];

const DEFAULT_VARIABLES: Record<string, string[]> = {
  authentication: ["name", "verification_url", "otp_code"],
  orders: ["name", "order_number", "total", "items_summary", "tracking_url"],
  notifications: ["subject", "title", "message", "cta_url", "cta_text"],
  marketing: ["subject", "title", "message", "cta_url", "cta_text", "unsubscribe_url"],
  support: ["name", "ticket_subject", "message", "ticket_id"],
};

const AdminEmailTemplatesPage = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [countries, setCountries] = useState<DestinationCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Filters
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Test dialog
  const [testOpen, setTestOpen] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes, cRes] = await Promise.all([
        (supabase as any).from("email_templates").select("*").order("purpose"),
        (supabase as any).from("email_senders").select("*").order("purpose"),
        supabase.from("destination_countries").select("*").eq("is_active", true).order("name"),
      ]);

      if (tRes.error) throw tRes.error;
      if (sRes.error) throw sRes.error;
      if (cRes.error) throw cRes.error;

      setTemplates((tRes.data || []).map((t: any) => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : JSON.parse(t.variables || "[]"),
      })));
      setSenders(sRes.data || []);
      setCountries(cRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTemplates = templates.filter(t => {
    if (filterPurpose !== "all" && t.purpose !== filterPurpose) return false;
    if (filterCountry !== "all") {
      if (filterCountry === "global" && t.destination_country_id !== null) return false;
      if (filterCountry !== "global" && t.destination_country_id !== filterCountry) return false;
    }
    return true;
  });

  const openNewTemplate = () => {
    setEditTemplate({
      purpose: "notifications",
      destination_country_id: null,
      name: "",
      subject: "",
      html_content: "",
      text_content: "",
      variables: [],
      is_active: true,
    });
    setIsNew(true);
    setEditOpen(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditTemplate({ ...t });
    setIsNew(false);
    setEditOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!editTemplate) return;
    if (!editTemplate.name || !editTemplate.subject || !editTemplate.html_content) {
      toast.error("Nombre, asunto y contenido HTML son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        purpose: editTemplate.purpose,
        destination_country_id: editTemplate.destination_country_id || null,
        name: editTemplate.name,
        subject: editTemplate.subject,
        html_content: editTemplate.html_content,
        text_content: editTemplate.text_content || null,
        variables: editTemplate.variables || [],
        is_active: editTemplate.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { error } = await (supabase as any).from("email_templates").insert(payload);
        if (error) throw error;
        toast.success("Plantilla creada");
      } else {
        const { error } = await (supabase as any).from("email_templates").update(payload).eq("id", editTemplate.id);
        if (error) throw error;
        toast.success("Plantilla actualizada");
      }
      setEditOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Error saving template:", err);
      toast.error(err.message || "Error al guardar plantilla");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      const { error } = await (supabase as any).from("email_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Plantilla eliminada");
      fetchData();
    } catch (err) {
      toast.error("Error al eliminar");
    }
  };

  const openPreview = (html: string) => {
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  const openTest = (template: EmailTemplate) => {
    setTestTemplateId(template.id);
    const vars: Record<string, string> = {};
    (template.variables || []).forEach(v => { vars[v] = `[${v}]`; });
    setTestVariables(vars);
    setTestEmail("");
    setTestOpen(true);
  };

  const handleSendTest = async () => {
    if (!testEmail) { toast.error("Ingresa email de destino"); return; }
    const template = templates.find(t => t.id === testTemplateId);
    if (!template) return;

    setTesting(true);
    try {
      // Replace variables in subject and content
      let subject = template.subject;
      let htmlContent = template.html_content;
      Object.entries(testVariables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        subject = subject.replace(regex, value);
        htmlContent = htmlContent.replace(regex, value);
      });

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject,
          htmlContent,
          type: template.purpose,
          destination_country_id: template.destination_country_id,
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success("Email de prueba enviado");
        setTestOpen(false);
      } else {
        toast.error(data?.error || "Error al enviar");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al enviar email de prueba");
    } finally {
      setTesting(false);
    }
  };

  const getCountryName = (id: string | null) => {
    if (!id) return "Global";
    return countries.find(c => c.id === id)?.name || "Desconocido";
  };

  const getSenderForTemplate = (template: EmailTemplate) => {
    return senders.find(s =>
      s.purpose === template.purpose &&
      s.destination_country_id === template.destination_country_id &&
      s.is_active
    ) || senders.find(s =>
      s.purpose === template.purpose &&
      s.destination_country_id === null &&
      s.is_active
    );
  };

  const purposeLabel = (p: string) => PURPOSE_OPTIONS.find(o => o.value === p)?.label || p;
  const purposeIcon = (p: string) => PURPOSE_OPTIONS.find(o => o.value === p)?.icon || "📧";

  if (loading) {
    return (
      <AdminLayout title="Plantillas de Email" subtitle="Gestiona las plantillas de contenido para cada tipo de email">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Plantillas de Email" subtitle="Gestiona las plantillas de contenido para cada tipo de email">
    <div className="space-y-6 p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7" /> Plantillas de Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura las plantillas de contenido para cada tipo de email y país de mercado.
          </p>
        </div>
        <Button onClick={openNewTemplate} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva Plantilla
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterPurpose} onValueChange={setFilterPurpose}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {PURPOSE_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los países</SelectItem>
            <SelectItem value="global">🌐 Global (fallback)</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay plantillas para los filtros seleccionados.</p>
            <Button variant="outline" className="mt-4" onClick={openNewTemplate}>
              Crear plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map(template => {
            const sender = getSenderForTemplate(template);
            return (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{purposeIcon(template.purpose)}</span>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {purposeLabel(template.purpose)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={template.is_active ? "default" : "secondary"} className="text-[10px]">
                      {template.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    <span>{getCountryName(template.destination_country_id)}</span>
                  </div>

                  <div className="text-xs">
                    <span className="text-muted-foreground">Asunto: </span>
                    <span className="font-medium text-foreground">{template.subject}</span>
                  </div>

                  {sender && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Remitente: </span>
                      <span className="font-medium text-foreground">{sender.sender_name} &lt;{sender.sender_email}&gt;</span>
                    </div>
                  )}

                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map(v => (
                        <Badge key={v} variant="outline" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => openPreview(template.html_content)}>
                      <Eye className="w-3 h-3" /> Vista previa
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => openTest(template)}>
                      <TestTube className="w-3 h-3" /> Probar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEditTemplate(template)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nueva Plantilla" : "Editar Plantilla"}</DialogTitle>
            <DialogDescription>
              {isNew ? "Crea una nueva plantilla de email." : "Modifica la plantilla de email."}
            </DialogDescription>
          </DialogHeader>
          {editTemplate && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo (Propósito)</Label>
                  <Select
                    value={editTemplate.purpose || "notifications"}
                    onValueChange={v => setEditTemplate({ ...editTemplate, purpose: v, variables: DEFAULT_VARIABLES[v] || [] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PURPOSE_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>País de Mercado</Label>
                  <Select
                    value={editTemplate.destination_country_id || "global"}
                    onValueChange={v => setEditTemplate({ ...editTemplate, destination_country_id: v === "global" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">🌐 Global (fallback)</SelectItem>
                      {countries.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nombre de la plantilla</Label>
                <Input
                  value={editTemplate.name || ""}
                  onChange={e => setEditTemplate({ ...editTemplate, name: e.target.value })}
                  placeholder="Ej: Confirmación de Pedido"
                />
              </div>

              <div className="space-y-2">
                <Label>Asunto del email</Label>
                <Input
                  value={editTemplate.subject || ""}
                  onChange={e => setEditTemplate({ ...editTemplate, subject: e.target.value })}
                  placeholder="Ej: Tu pedido #{{order_number}} ha sido confirmado"
                />
                <p className="text-xs text-muted-foreground">Puedes usar variables con {"{{variable}}"}</p>
              </div>

              <Tabs defaultValue="html" className="space-y-2">
                <TabsList>
                  <TabsTrigger value="html" className="gap-1"><Code className="w-3 h-3" /> HTML</TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1"><Eye className="w-3 h-3" /> Vista Previa</TabsTrigger>
                </TabsList>
                <TabsContent value="html">
                  <Textarea
                    value={editTemplate.html_content || ""}
                    onChange={e => setEditTemplate({ ...editTemplate, html_content: e.target.value })}
                    placeholder="<div>...</div>"
                    className="min-h-[300px] font-mono text-xs"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="border rounded-lg overflow-hidden bg-background">
                    <iframe
                      srcDoc={editTemplate.html_content || "<p>Sin contenido</p>"}
                      className="w-full h-[400px] border-0"
                      sandbox=""
                      title="Email preview"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Texto alternativo (opcional)</Label>
                <Textarea
                  value={editTemplate.text_content || ""}
                  onChange={e => setEditTemplate({ ...editTemplate, text_content: e.target.value })}
                  placeholder="Versión texto plano del email"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Variables disponibles</Label>
                <div className="flex flex-wrap gap-1">
                  {(editTemplate.variables || []).map(v => (
                    <Badge key={v} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                  ))}
                </div>
                <Input
                  placeholder="Agregar variable (presiona Enter)"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !(editTemplate.variables || []).includes(val)) {
                        setEditTemplate({ ...editTemplate, variables: [...(editTemplate.variables || []), val] });
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                  className="text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={editTemplate.is_active ?? true}
                  onCheckedChange={checked => setEditTemplate({ ...editTemplate, is_active: checked })}
                />
                <Label>Plantilla activa</Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveTemplate} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {isNew ? "Crear Plantilla" : "Guardar Cambios"}
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista Previa del Email</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-background">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[500px] border-0"
              sandbox=""
              title="Email preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" /> Enviar Email de Prueba
            </DialogTitle>
            <DialogDescription>
              Completa las variables y envía un email de prueba con la plantilla y remitente asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Email de destino</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>

            {Object.entries(testVariables).length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Variables de la plantilla</Label>
                {Object.entries(testVariables).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-mono text-muted-foreground">{`{{${key}}}`}</Label>
                    <Input
                      value={value}
                      onChange={e => setTestVariables(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleSendTest} disabled={testing} className="w-full gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Prueba
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
};

export default AdminEmailTemplatesPage;
