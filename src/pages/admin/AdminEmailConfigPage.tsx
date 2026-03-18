import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Key, Send, Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Users, AlertTriangle, FileText, Globe, Plus } from "lucide-react";

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

const PURPOSE_LABELS: Record<string, { label: string; description: string }> = {
  authentication: { label: "Autenticación", description: "Emails de verificación, reseteo de contraseña" },
  orders: { label: "Pedidos", description: "Confirmaciones de pedido, actualizaciones de envío" },
  notifications: { label: "Notificaciones", description: "Alertas del sistema, avisos importantes" },
  marketing: { label: "Marketing", description: "Promociones, newsletters, campañas" },
  support: { label: "Soporte", description: "Respuestas de soporte, tickets" },
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
  const navigate = useNavigate();
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

  useEffect(() => {
    fetchConfig();
    fetchSenders();
    fetchCountries();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No se encontró configuración de email.</p>
      </div>
    );
  }

  const isConfigured = config.api_key && config.api_secret && config.sender_email;
  const apiKeyWarning = validateApiKey(config.api_key);
  const apiSecretWarning = validateApiKey(config.api_secret);
  const senderEmailWarning = validateEmail(config.sender_email);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
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

      <Tabs defaultValue="credentials" className="space-y-4">
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
                <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate("/admin/email-templates")}>
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
      </Tabs>
    </div>
  );
};

export default AdminEmailConfigPage;
