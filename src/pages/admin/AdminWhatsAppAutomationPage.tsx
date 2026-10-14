import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageCircle, Send, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

type Kind = 'pending' | 'paid' | 'shipped' | 'ready_pickup' | 'delivered';
interface Cfg { enabled: boolean; events: Record<Kind, boolean> }
const DEFAULT: Cfg = { enabled: true, events: { pending: true, paid: true, shipped: true, ready_pickup: true, delivered: true } };
const KEY = 'whatsapp_automation';

const EVENTS: { k: Kind; label: string; desc: string }[] = [
  { k: 'pending', label: 'Pedido pendiente de pago', desc: 'Al crear un pedido con MonCash, NatCash o transferencia; incluye enlace para subir comprobante.' },
  { k: 'paid', label: 'Pago confirmado', desc: 'Pago con tarjeta exitoso o comprobante validado por un administrador.' },
  { k: 'shipped', label: 'Pedido despachado / en camino', desc: 'Cuando el pedido pasa a enviado; incluye número de rastreo si existe.' },
  { k: 'ready_pickup', label: 'Listo para recoger', desc: 'Cuando llega al punto de entrega elegido por el cliente.' },
  { k: 'delivered', label: 'Pedido entregado', desc: 'Confirmación final de entrega.' },
];

export default function AdminWhatsAppAutomationPage() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState('es');

  const { data: saved } = useQuery({
    queryKey: ['platform-setting', KEY],
    queryFn: async (): Promise<Cfg> => {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', KEY).maybeSingle();
      try { const v = data?.value ? JSON.parse(data.value) : {}; return { ...DEFAULT, ...v, events: { ...DEFAULT.events, ...(v.events || {}) } }; }
      catch { return DEFAULT; }
    },
  });
  useEffect(() => { if (saved) setCfg(saved); }, [saved]);

  const { data: status } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('send-transactional-email', { body: { event: 'whatsapp_status' } });
      return { configured: !!data?.configured };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(cfg);
      const { data: ex } = await supabase.from('platform_settings').select('id').eq('key', KEY).maybeSingle();
      const { error } = ex
        ? await supabase.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', ex.id)
        : await supabase.from('platform_settings').insert({ key: KEY, value, description: 'Automatización de notificaciones WhatsApp' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Configuración guardada'); qc.invalidateQueries({ queryKey: ['platform-setting', KEY] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-transactional-email', { body: { event: 'whatsapp_test', phone, lang } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error === 'whatsapp_not_configured' ? 'WhatsApp no está configurado' : data?.error === 'invalid_phone' ? 'Número inválido' : `Meta rechazó el envío (${data?.error}). Recuerda: el primer contacto requiere que el cliente haya escrito antes o una plantilla aprobada.`);
    },
    onSuccess: () => toast.success('Mensaje de prueba enviado'),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Automatización WhatsApp" subtitle="Avisos automáticos a clientes en su idioma (ES, EN, FR, HT)">
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" /> Conexión con WhatsApp Business</CardTitle>
              <CardDescription>Credenciales de Meta Cloud API guardadas de forma segura en el servidor.</CardDescription>
            </div>
            {status?.configured
              ? <Badge className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</Badge>
              : <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Sin configurar</Badge>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-[1fr_110px_auto] gap-2 items-end">
              <div><Label>Número de prueba (con código de país)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509..." /></div>
              <div><Label>Idioma</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="es">ES</option><option value="en">EN</option><option value="fr">FR</option><option value="ht">HT</option>
                </select>
              </div>
              <Button onClick={() => test.mutate()} disabled={!phone || test.isPending} className="gap-2"><Send className="w-4 h-4" /> Enviar prueba</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Eventos automáticos</CardTitle><CardDescription>Cada aviso se envía una sola vez por pedido al teléfono del perfil o de la dirección.</CardDescription></div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {EVENTS.map((e) => (
              <div key={e.k} className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-medium text-sm">{e.label}</p><p className="text-xs text-muted-foreground">{e.desc}</p></div>
                <Switch disabled={!cfg.enabled} checked={cfg.events[e.k]} onCheckedChange={(v) => setCfg({ ...cfg, events: { ...cfg.events, [e.k]: v } })} />
              </div>
            ))}
            <div className="pt-4 flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2"><Save className="w-4 h-4" /> Guardar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
