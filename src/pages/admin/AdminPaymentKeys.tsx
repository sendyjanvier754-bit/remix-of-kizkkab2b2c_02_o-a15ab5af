import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  ShieldAlert,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface StripeSettings {
  id: string;
  mode: 'test' | 'live';
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
  is_active: boolean;
}

const PROJECT_REF = 'fonvunyiaxcjkodrnpox';
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`;

function mask(value: string) {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 7)}••••${value.slice(-4)}`;
}

const AdminPaymentKeys = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StripeSettings | null>(null);
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [pk, setPk] = useState('');
  const [sk, setSk] = useState('');
  const [ws, setWs] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showSk, setShowSk] = useState(false);
  const [showWs, setShowWs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; data?: any } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stripe_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettings(data as StripeSettings);
      setMode(data.mode as 'test' | 'live');
      setPk(data.publishable_key || '');
      setSk(data.secret_key || '');
      setWs(data.webhook_secret || '');
      setIsActive(data.is_active);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!pk.trim() || !sk.trim()) {
      toast.error('Publishable key y Secret key son obligatorios');
      return;
    }
    if (mode === 'live' && (!pk.startsWith('pk_live_') || !sk.startsWith('sk_live_'))) {
      toast.error('En modo Live las llaves deben empezar con pk_live_ / sk_live_');
      return;
    }
    if (mode === 'test' && (!pk.startsWith('pk_test_') || !sk.startsWith('sk_test_'))) {
      toast.error('En modo Test las llaves deben empezar con pk_test_ / sk_test_');
      return;
    }
    setSaving(true);
    try {
      // If activating, deactivate any other active row first
      if (isActive) {
        await supabase.from('stripe_settings').update({ is_active: false }).neq('id', settings?.id ?? '00000000-0000-0000-0000-000000000000');
      }
      const payload = {
        mode,
        publishable_key: pk.trim(),
        secret_key: sk.trim(),
        webhook_secret: ws.trim(),
        is_active: isActive,
        updated_by: user?.id ?? null,
      };
      if (settings?.id) {
        const { error } = await supabase.from('stripe_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stripe_settings').insert(payload);
        if (error) throw error;
      }
      toast.success('Configuración guardada');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-test-connection');
      if (error) throw error;
      if (data?.ok) {
        setTestResult({
          ok: true,
          message: `Conectado a la cuenta ${data.account_id} (${data.country?.toUpperCase()}) en modo ${data.mode}`,
          data,
        });
      } else {
        setTestResult({ ok: false, message: data?.error || 'Error desconocido' });
      }
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success('URL copiada');
  };

  return (
    <AdminLayout title="Llaves de Pago">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Llaves de Pago (Stripe)</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona las llaves de Stripe usadas por todos los checkouts (B2B y B2C).
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Las llaves secret y webhook se guardan en la base de datos. Restringe estrictamente el rol <b>admin</b>.
            Solo personas de máxima confianza deben tener acceso.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Configuración de Stripe</span>
                  {settings?.is_active && <Badge variant="default">Activo</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Modo</Label>
                  <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'test' | 'live')} className="flex gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="test" id="mode-test" />
                      <Label htmlFor="mode-test" className="cursor-pointer">Test (pruebas)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="live" id="mode-live" />
                      <Label htmlFor="mode-live" className="cursor-pointer text-destructive font-medium">Live (producción)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="pk">Publishable Key (pk_…)</Label>
                  <Input
                    id="pk"
                    value={pk}
                    onChange={(e) => setPk(e.target.value)}
                    placeholder={mode === 'live' ? 'pk_live_…' : 'pk_test_…'}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Pública. Se expone al navegador.</p>
                </div>

                <div>
                  <Label htmlFor="sk">Secret Key (sk_…)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sk"
                      type={showSk ? 'text' : 'password'}
                      value={sk}
                      onChange={(e) => setSk(e.target.value)}
                      placeholder={mode === 'live' ? 'sk_live_…' : 'sk_test_…'}
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowSk(s => !s)}>
                      {showSk ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!showSk && sk && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{mask(sk)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="ws">Webhook Signing Secret (whsec_…)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ws"
                      type={showWs ? 'text' : 'password'}
                      value={ws}
                      onChange={(e) => setWs(e.target.value)}
                      placeholder="whsec_…"
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowWs(s => !s)}>
                      {showWs ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!showWs && ws && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{mask(ws)}</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="font-medium">Activar configuración</Label>
                    <p className="text-xs text-muted-foreground">
                      Cuando está activa, todos los checkouts la usan automáticamente.
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={handleTest} disabled={testing || !settings?.id}>
                    {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Probar conexión
                  </Button>
                </div>

                {testResult && (
                  <Alert variant={testResult.ok ? 'default' : 'destructive'}>
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook de Stripe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ve a Stripe Dashboard → Developers → Webhooks → "Add endpoint" y pega esta URL:
                </p>
                <div className="flex gap-2">
                  <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyWebhook}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Eventos a suscribir:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li><code>payment_intent.succeeded</code></li>
                    <li><code>payment_intent.payment_failed</code></li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Luego copia el <b>Signing secret</b> (empieza con <code>whsec_</code>) y pégalo arriba.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentKeys;
