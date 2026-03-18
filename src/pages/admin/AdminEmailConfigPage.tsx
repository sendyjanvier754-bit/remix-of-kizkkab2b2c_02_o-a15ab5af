import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Key, Send, Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Users, AlertTriangle, FileText, Globe, Plus, Pencil, Trash2, Code, TestTube } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface EmailConfig {
  id: string;
  provider: string;
  api_key: string;
  api_secret: string;
  sender_email: string;
  sender_name: string;
  is_active: boolean;
  settings: Record<string, any>;
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
}

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

const PURPOSE_LABELS: Record<string, { label: string; description: string }> = {
  authentication: { label: "Autenticación", description: "Emails de verificación, reseteo de contraseña" },
  orders: { label: "Pedidos", description: "Confirmaciones de pedido, actualizaciones de envío" },
  notifications: { label: "Notificaciones", description: "Alertas del sistema, avisos importantes" },
  marketing: { label: "Marketing", description: "Promociones, newsletters, campañas" },
  support: { label: "Soporte", description: "Respuestas de soporte, tickets" },
};

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

const validateApiKey = (key: string): string | null => {
  if (!key) return null;
  if (/\s/.test(key)) return "La API Key no debe contener espacios";
  if (/[Ss]ecret/i.test(key)) return "La API Key parece contener texto extra ('Secret'). Verifica que solo pegaste la clave.";
  if (key.length < 20) return "La API Key parece demasiado corta";
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email) return null;
  if (!email.includes("@")) return "El email debe contener @";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Formato de email inválido";
  return null;
};

const AdminEmailConfigPage = () => {
  const [activeTab, setActiveTab] = useState("credentials");
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [countries, setCountries] = useState<DestinationCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSenders, setSavingSenders] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  // Template management state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState<string>("");
  const [tplTestEmail, setTplTestEmail] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchSenders();
    fetchCountries();
    fetchTemplates();
  }, []);

  const fetchCountries = async () => {
    try {
      const { data, error } = await supabase
        .from("destination_countries")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setCountries(data || []);
    } catch (err) {
      console.error("Error loading countries:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_configuration")
        .select("*")
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) setConfig(data[0]);
    } catch (err) {
      console.error("Error loading email config:", err);
      toast.error("Error al cargar la configuración de email");
    } finally {
      setLoading(false);
    }
  };

  const fetchSenders = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_senders")
        .select("*")
        .order("purpose");

      if (error) throw error;
      setSenders(data || []);
    } catch (err) {
      console.error("Error loading email senders:", err);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validate
    const apiKeyError = validateApiKey(config.api_key);
    if (apiKeyError) { toast.error(apiKeyError); return; }

    const apiSecretError = validateApiKey(config.api_secret);
    if (apiSecretError) { toast.error(`API Secret: ${apiSecretError}`); return; }

    const emailError = validateEmail(config.sender_email);
    if (emailError) { toast.error(`Email remitente: ${emailError}`); return; }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("email_configuration")
        .update({
          api_key: config.api_key.trim(),
          api_secret: config.api_secret.trim(),
          sender_email: config.sender_email.trim(),
          sender_name: config.sender_name.trim(),
          is_active: config.is_active,
          settings: config.settings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (error) throw error;
      toast.success("Configuración guardada correctamente");
    } catch (err) {
      console.error("Error saving config:", err);
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSenders = async () => {
    // Validate all non-empty sender emails
    for (const sender of senders) {
      if (sender.sender_email) {
        const err = validateEmail(sender.sender_email);
        if (err) {
          toast.error(`${PURPOSE_LABELS[sender.purpose]?.label || sender.purpose}: ${err}`);
          return;
        }
      }
    }

    setSavingSenders(true);
    try {
      for (const sender of senders) {
        const { error } = await (supabase as any)
          .from("email_senders")
          .update({
            sender_email: sender.sender_email.trim(),
            sender_name: sender.sender_name.trim(),
            is_active: sender.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sender.id);

        if (error) throw error;
      }
      toast.success("Remitentes guardados correctamente");
    } catch (err) {
      console.error("Error saving senders:", err);
      toast.error("Error al guardar los remitentes");
    } finally {
      setSavingSenders(false);
    }
  };

  const updateSender = (id: string, field: keyof EmailSender, value: any) => {
    setSenders(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddSender = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_senders")
        .insert({
          purpose: "notifications",
          sender_email: config?.sender_email || "",
          sender_name: config?.sender_name || "Siver",
          is_active: false,
          destination_country_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      setSenders(prev => [...prev, data]);
      toast.success("Nuevo remitente creado");
    } catch (err: any) {
      toast.error(err.message || "Error al crear remitente");
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Ingresa un email de destino para la prueba");
      return;
    }
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: "🧪 Email de prueba - Siver",
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #071d7f;">¡Prueba exitosa! ✅</h1>
              <p>Este es un email de prueba enviado desde tu plataforma Siver.</p>
              <p>La configuración de Mailjet está funcionando correctamente.</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #888; font-size: 12px;">Enviado desde Siver Email System</p>
            </div>
          `,
          type: "test",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Email de prueba enviado correctamente");
      } else {
        toast.error(data?.error || "Error al enviar email de prueba");
      }
    } catch (err: any) {
      console.error("Test email error:", err);
      toast.error(err.message || "Error al enviar email de prueba");
    } finally {
      setTesting(false);
    }
  };

  // ─── Template handlers ───────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).from("email_templates").select("*").order("purpose");
      if (error) throw error;
      setTemplates((data || []).map((t: any) => ({
        ...t,
        variables: Array.isArray(t.variables) ? t.variables : JSON.parse(t.variables || "[]"),
      })));
    } catch (err) {
      console.error("Error loading templates:", err);
    }
  }, []);

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
    setIsNewTemplate(true);
    setEditOpen(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditTemplate({ ...t });
    setIsNewTemplate(false);
    setEditOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!editTemplate) return;
    if (!editTemplate.name || !editTemplate.subject || !editTemplate.html_content) {
      toast.error("Nombre, asunto y contenido HTML son obligatorios");
      return;
    }
    setSavingTemplate(true);
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
      if (isNewTemplate) {
        const { error } = await (supabase as any).from("email_templates").insert(payload);
        if (error) throw error;
        toast.success("Plantilla creada");
      } else {
        const { error } = await (supabase as any).from("email_templates").update(payload).eq("id", editTemplate.id);
        if (error) throw error;
        toast.success("Plantilla actualizada");
      }
      setEditOpen(false);
      fetchTemplates();
    } catch (err: any) {
      console.error("Error saving template:", err);
      toast.error(err.message || "Error al guardar plantilla");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      const { error } = await (supabase as any).from("email_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Plantilla eliminada");
      fetchTemplates();
    } catch (err) {
      toast.error("Error al eliminar");
    }
  };

  const openPreview = (html: string) => {
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  const openTestTemplate = (template: EmailTemplate) => {
    setTestTemplateId(template.id);
    const vars: Record<string, string> = {};
    (template.variables || []).forEach(v => { vars[v] = `[${v}]`; });
    setTestVariables(vars);
    setTplTestEmail("");
    setTestOpen(true);
  };

  const handleSendTestTemplate = async () => {
    if (!tplTestEmail) { toast.error("Ingresa email de destino"); return; }
    const template = templates.find(t => t.id === testTemplateId);
    if (!template) return;
    setTestingTemplate(true);
    try {
      let subject = template.subject;
      let htmlContent = template.html_content;
      Object.entries(testVariables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        subject = subject.replace(regex, value);
        htmlContent = htmlContent.replace(regex, value);
      });
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: tplTestEmail, subject, htmlContent, type: template.purpose, destination_country_id: template.destination_country_id },
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
      setTestingTemplate(false);
    }
  };

  const getCountryName = (id: string | null) => {
    if (!id) return "Global";
    return countries.find(c => c.id === id)?.name || "Desconocido";
  };

  const getSenderForTemplate = (template: EmailTemplate) => {
    return senders.find(s =>
      s.purpose === template.purpose && s.destination_country_id === template.destination_country_id && s.is_active
    ) || senders.find(s =>
      s.purpose === template.purpose && s.destination_country_id === null && s.is_active
    );
  };

  const purposeLabel = (p: string) => PURPOSE_OPTIONS.find(o => o.value === p)?.label || p;
  const purposeIcon = (p: string) => PURPOSE_OPTIONS.find(o => o.value === p)?.icon || "📧";

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout title="Configuración de Email" subtitle="Configura Mailjet y gestiona plantillas de email">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!config) {
    return (
      <AdminLayout title="Configuración de Email" subtitle="Configura Mailjet y gestiona plantillas de email">
        <div className="p-6">
          <p className="text-muted-foreground">No se encontró configuración de email.</p>
        </div>
      </AdminLayout>
    );
  }

  const isConfigured = config.api_key && config.api_secret && config.sender_email;
  const apiKeyWarning = validateApiKey(config.api_key);
  const apiSecretWarning = validateApiKey(config.api_secret);
  const senderEmailWarning = validateEmail(config.sender_email);

  return (
    <AdminLayout title="Configuración de Email" subtitle="Configura Mailjet y gestiona plantillas de email">
    <div className="space-y-6 p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-7 h-7" />
            Configuración de Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura Mailjet para el envío de emails de autenticación, marketing y comunicación.
          </p>
        </div>
        <Badge variant={config.is_active && isConfigured ? "default" : "secondary"} className="text-sm">
          {config.is_active && isConfigured ? (
            <><CheckCircle2 className="w-4 h-4 mr-1" /> Activo</>
          ) : (
            <><XCircle className="w-4 h-4 mr-1" /> Inactivo</>
          )}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="credentials" className="flex items-center gap-1">
            <Key className="w-4 h-4" /> Credenciales
          </TabsTrigger>
          <TabsTrigger value="sender" className="flex items-center gap-1">
            <Send className="w-4 h-4" /> Remitente Principal
          </TabsTrigger>
          <TabsTrigger value="senders" className="flex items-center gap-1">
            <Users className="w-4 h-4" /> Remitentes por Tipo
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-1">
            <Shield className="w-4 h-4" /> Prueba
          </TabsTrigger>
          <TabsTrigger value="plantillas" className="flex items-center gap-1">
            <FileText className="w-4 h-4" /> Plantillas
          </TabsTrigger>
        </TabsList>

        {/* Credentials Tab */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle>Credenciales de Mailjet</CardTitle>
              <CardDescription>
                Obtén tus API Keys desde{" "}
                <a
                  href="https://app.mailjet.com/account/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  app.mailjet.com/account/apikeys
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api_key"
                    type={showApiKey ? "text" : "password"}
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    placeholder="Tu API Key de Mailjet"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {apiKeyWarning && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {apiKeyWarning}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_secret">API Secret</Label>
                <div className="relative">
                  <Input
                    id="api_secret"
                    type={showApiSecret ? "text" : "password"}
                    value={config.api_secret}
                    onChange={(e) => setConfig({ ...config, api_secret: e.target.value })}
                    placeholder="Tu API Secret de Mailjet"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {apiSecretWarning && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {apiSecretWarning}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                />
                <Label>Activar envío de emails</Label>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar Credenciales
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Main Sender Tab */}
        <TabsContent value="sender">
          <Card>
            <CardHeader>
              <CardTitle>Remitente Principal</CardTitle>
              <CardDescription>
                Email y nombre por defecto para todos los emails. Los remitentes por tipo (pestaña siguiente) tienen prioridad cuando están configurados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sender_email">Email del Remitente</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={config.sender_email}
                  onChange={(e) => setConfig({ ...config, sender_email: e.target.value })}
                  placeholder="noreply@tudominio.com"
                />
                {senderEmailWarning && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {senderEmailWarning}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_name">Nombre del Remitente</Label>
                <Input
                  id="sender_name"
                  type="text"
                  value={config.sender_name}
                  onChange={(e) => setConfig({ ...config, sender_name: e.target.value })}
                  placeholder="Siver"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar Remitente
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-Sender Tab */}
        <TabsContent value="senders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Remitentes por Tipo de Email</CardTitle>
                  <CardDescription>
                    Configura un email remitente diferente para cada tipo de comunicación y país.
                    Si un tipo está vacío o inactivo, se usará el remitente principal.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setActiveTab("plantillas")}>
                  <FileText className="w-4 h-4" /> Plantillas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {senders.length === 0 ? (
                <p className="text-muted-foreground text-sm">No se encontraron remitentes configurados.</p>
              ) : (
                senders.map((sender) => {
                  const info = PURPOSE_LABELS[sender.purpose] || { label: sender.purpose, description: "" };
                  const emailErr = sender.sender_email ? validateEmail(sender.sender_email) : null;
                  const countryName = sender.destination_country_id
                    ? countries.find(c => c.id === sender.destination_country_id)?.name || "País"
                    : "Global";
                  return (
                    <div key={sender.id} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{info.label}</h3>
                            <p className="text-xs text-muted-foreground">{info.description}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Globe className="w-3 h-3" /> {countryName}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={sender.is_active}
                            onCheckedChange={(checked) => updateSender(sender.id, "is_active", checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {sender.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={sender.sender_email}
                            onChange={(e) => updateSender(sender.id, "sender_email", e.target.value)}
                            placeholder={config.sender_email || "noreply@tudominio.com"}
                            className="text-sm"
                          />
                          {emailErr && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {emailErr}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nombre</Label>
                          <Input
                            type="text"
                            value={sender.sender_name}
                            onChange={(e) => updateSender(sender.id, "sender_name", e.target.value)}
                            placeholder={config.sender_name || "Siver"}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">País</Label>
                          <Select
                            value={sender.destination_country_id || "global"}
                            onValueChange={(v) => updateSender(sender.id, "destination_country_id", v === "global" ? null : v)}
                          >
                            <SelectTrigger className="text-sm h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="global">🌐 Global</SelectItem>
                              {countries.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="flex gap-3">
                <Button onClick={handleSaveSenders} disabled={savingSenders} className="flex-1">
                  {savingSenders ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar Remitentes
                </Button>
                <Button variant="outline" onClick={handleAddSender} className="gap-1">
                  <Plus className="w-4 h-4" /> Nuevo Remitente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Email de Prueba</CardTitle>
              <CardDescription>
                Verifica que la configuración funciona enviando un email de prueba.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isConfigured && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  Debes configurar las credenciales y el remitente antes de enviar un email de prueba.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="test_email">Email de Destino</Label>
                <Input
                  id="test_email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="tu@email.com"
                  disabled={!isConfigured}
                />
              </div>

              <Button
                onClick={handleTestEmail}
                disabled={testing || !isConfigured}
                className="w-full"
                variant="outline"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Email de Prueba
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="plantillas">
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-6 h-6" /> Plantillas de Email
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
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
                          <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => openTestTemplate(template)}>
                            <TestTube className="w-3 h-3" /> Probar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEditTemplate(template)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>

      {/* Edit/Create Template Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewTemplate ? "Nueva Plantilla" : "Editar Plantilla"}</DialogTitle>
            <DialogDescription>
              {isNewTemplate ? "Crea una nueva plantilla de email." : "Modifica la plantilla de email."}
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
                <Button onClick={handleSaveTemplate} disabled={savingTemplate} className="flex-1">
                  {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {isNewTemplate ? "Crear Plantilla" : "Guardar Cambios"}
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

      {/* Test Template Dialog */}
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
                value={tplTestEmail}
                onChange={e => setTplTestEmail(e.target.value)}
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
            <Button onClick={handleSendTestTemplate} disabled={testingTemplate} className="w-full gap-2">
              {testingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Prueba
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminEmailConfigPage;
