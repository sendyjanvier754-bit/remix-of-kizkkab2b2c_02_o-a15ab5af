import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Key, Send, Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

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

const AdminEmailConfigPage = () => {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_configuration")
        .select("*")
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setConfig(data[0]);
      }
    } catch (err) {
      console.error("Error loading email config:", err);
      toast.error("Error al cargar la configuración de email");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const { error } = await (supabase as any)
        .from("email_configuration")
        .update({
          api_key: config.api_key,
          api_secret: config.api_secret,
          sender_email: config.sender_email,
          sender_name: config.sender_name,
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
            <Send className="w-4 h-4" /> Remitente
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

        {/* Sender Tab */}
        <TabsContent value="sender">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Remitente</CardTitle>
              <CardDescription>
                El email y nombre que aparecerán como remitente en todos los emails enviados.
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
