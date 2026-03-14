import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { BrandingImageUpload } from '@/components/admin/BrandingImageUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Palette, Globe, Share2, Search, CreditCard, FileText, Image, ShieldCheck, Plus, X, MonitorPlay } from 'lucide-react';

const PAYMENT_ICONS = [
  { key: 'payment_icon_visa',       label: 'VISA',                default: '/visa.png' },
  { key: 'payment_icon_mastercard', label: 'Mastercard',          default: '/mastercard.png' },
  { key: 'payment_icon_amex',       label: 'American Express',    default: '/american express.png' },
  { key: 'payment_icon_applepay',   label: 'Apple Pay',           default: '/apple pay.png' },
  { key: 'payment_icon_googlepay',  label: 'Google Pay',          default: '/google pay.png' },
  { key: 'payment_icon_moncash',    label: 'MonCash',             default: '' },
  { key: 'payment_icon_natcash',    label: 'NatCash',             default: '' },
  { key: 'payment_icon_transfer',   label: 'Transferencia Bancaria', default: '' },
];

const LEGAL_FIELDS = [
  { key: 'legal_terms',       label: 'Términos y Condiciones' },
  { key: 'legal_privacy',     label: 'Política de Privacidad' },
  { key: 'legal_cookies',     label: 'Política de Cookies' },
  { key: 'legal_returns',     label: 'Devoluciones' },
  { key: 'legal_refunds',     label: 'Reembolsos' },
  { key: 'legal_exchanges',   label: 'Cambios' },
  { key: 'about_content',     label: 'Sobre Nosotros' },
  { key: 'affiliate_program', label: 'Programa de Afiliados' },
];

export default function AdminBrandingPage() {
  const { settings, isLoading, updateMultiple } = useBrandingSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [topbarMessages, setTopbarMessages] = useState<string[]>(['']);

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach(s => { map[s.key] = s.value; });
      setForm(map);
      try {
        const msgs = JSON.parse(map.topbar_messages || '[]');
        setTopbarMessages(Array.isArray(msgs) && msgs.length > 0 ? msgs : ['']);
      } catch {
        setTopbarMessages(['']);
      }
    }
  }, [settings]);

  const syncTopbarMessages = (msgs: string[]) => {
    setTopbarMessages(msgs);
    setForm(prev => ({ ...prev, topbar_messages: JSON.stringify(msgs.filter(m => m.trim())) }));
  };

  const addTopbarMessage = () => setTopbarMessages(prev => [...prev, '']);

  const updateTopbarMessage = (i: number, value: string) => {
    const updated = [...topbarMessages];
    updated[i] = value;
    syncTopbarMessages(updated);
  };

  const removeTopbarMessage = (i: number) => {
    const updated = topbarMessages.filter((_, idx) => idx !== i);
    syncTopbarMessages(updated.length > 0 ? updated : ['']);
  };

  const set = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await updateMultiple(form);
    setSaving(false);
  };

  const field = (key: string, label: string, placeholder = '', multiline = false) => (
    <div key={key} className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      {multiline ? (
        <Textarea id={key} value={form[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <Input id={key} value={form[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );

  const SaveButton = () => (
    <div className="flex justify-end pt-2">
      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar Cambios
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout title="Identidad de la Plataforma" subtitle="Configura nombre, logo, colores y más">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Identidad de la Plataforma" subtitle="Configura nombre, logo, colores y más">
      <div className="max-w-4xl space-y-6">

        {/* Live preview */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-contain bg-white p-1" />
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">{form.platform_name || 'Tu Plataforma'}</h2>
              <p className="text-sm text-muted-foreground">{form.platform_slogan || ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Identity ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Identidad</CardTitle>
            <CardDescription>Nombre, slogan, logo y favicon de la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('platform_name', 'Nombre de la Plataforma', 'Ej: Mi Marketplace')}
              {field('platform_slogan', 'Slogan', 'Tu slogan aquí')}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <BrandingImageUpload id="logo_url" label="Logo" value={form.logo_url || ''} onChange={v => set('logo_url', v)} previewSize="lg" />
              <BrandingImageUpload id="favicon_url" label="Favicon" value={form.favicon_url || ''} onChange={v => set('favicon_url', v)} previewSize="sm" />
            </div>
          </CardContent>
        </Card>

        {/* ── Colors ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Colores de Marca</CardTitle>
            <CardDescription>Colores principales para la identidad visual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('primary_color', 'Color Primario', '#3B82F6')}
              {field('secondary_color', 'Color Secundario', '#10B981')}
            </div>
          </CardContent>
        </Card>

        {/* ── Contact ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Contacto</CardTitle>
            <CardDescription>Información de contacto visible en la plataforma, facturas y páginas legales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('contact_email', 'Email de Contacto', 'info@tuempresa.com')}
              {field('contact_phone', 'Teléfono', '+509 ...')}
            </div>
          </CardContent>
        </Card>

        {/* ── Top Bar ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MonitorPlay className="h-5 w-5" /> Barra Superior</CardTitle>
            <CardDescription>Color e mensajes rotativos que aparecen en la barra superior del sitio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Colors */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Color de Fondo</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.topbar_bg_color || '#f9fafb'}
                    onChange={e => set('topbar_bg_color', e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer p-1 bg-white"
                  />
                  <Input
                    value={form.topbar_bg_color || ''}
                    onChange={e => set('topbar_bg_color', e.target.value)}
                    placeholder="#f9fafb"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color de Texto</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.topbar_text_color || '#4b5563'}
                    onChange={e => set('topbar_text_color', e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer p-1 bg-white"
                  />
                  <Input
                    value={form.topbar_text_color || ''}
                    onChange={e => set('topbar_text_color', e.target.value)}
                    placeholder="#4b5563"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div
              className="rounded border text-xs px-4 h-10 flex items-center justify-between font-medium"
              style={{
                backgroundColor: form.topbar_bg_color || '#f9fafb',
                color: form.topbar_text_color || '#4b5563',
              }}
            >
              <span>{topbarMessages.filter(m => m.trim())[0] || 'Vista previa del mensaje...'}</span>
              <span className="opacity-60 text-[10px]">Centro de Ayuda | Vender</span>
            </div>

            {/* Messages */}
            <div className="space-y-2">
              <Label>Mensajes Rotativos</Label>
              <p className="text-xs text-muted-foreground">Se mostrarán uno tras otro en la barra superior. Si no hay mensajes se usarán los textos por defecto del sistema.</p>
              <div className="space-y-2">
                {topbarMessages.map((msg, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={msg}
                      onChange={e => updateTopbarMessage(i, e.target.value)}
                      placeholder={`Mensaje ${i + 1}, ej: Envío internacional disponible`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTopbarMessage(i)}
                      disabled={topbarMessages.length === 1}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addTopbarMessage}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Mensaje
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Social ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Redes Sociales</CardTitle>
            <CardDescription>Enlaces a tus redes sociales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('social_facebook', 'Facebook', 'https://facebook.com/...')}
              {field('social_instagram', 'Instagram', 'https://instagram.com/...')}
              {field('social_whatsapp', 'WhatsApp', '+509...')}
            </div>
          </CardContent>
        </Card>

        {/* ── SEO ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> SEO</CardTitle>
            <CardDescription>Optimización para motores de búsqueda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('meta_title', 'Meta Título', 'Título para buscadores')}
              {field('meta_description', 'Meta Descripción', 'Descripción para buscadores', true)}
            </div>
          </CardContent>
        </Card>

        {/* ── Payment Method Icons ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Iconos de Métodos de Pago</CardTitle>
            <CardDescription>
              Sube el logo de cada método de pago. Se mostrará en el footer, carrito y checkout.
              Deja en blanco para usar el badge de texto por defecto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              {PAYMENT_ICONS.map(p => (
                <BrandingImageUpload
                  key={p.key}
                  id={p.key}
                  label={p.label}
                  value={form[p.key] ?? p.default}
                  onChange={v => set(p.key, v)}
                  previewSize="md"
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Trust Badges ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Garantías / Banners de Confianza</CardTitle>
            <CardDescription>Los 3 mensajes de confianza que aparecen en el footer del sitio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { t: 'trust_badge_1_title', d: 'trust_badge_1_desc', label: 'Garantía 1', tph: 'Ej: Envío desde el extranjero', dph: 'Ej: Recibe tus productos en 7-15 días' },
                { t: 'trust_badge_2_title', d: 'trust_badge_2_desc', label: 'Garantía 2', tph: 'Ej: Devolución Gratis', dph: 'Ej: Devuelve fácilmente en 30 días' },
                { t: 'trust_badge_3_title', d: 'trust_badge_3_desc', label: 'Garantía 3', tph: 'Ej: Pago Seguro', dph: 'Ej: Múltiples opciones de pago' },
              ].map(b => (
                <div key={b.t} className="grid gap-3 sm:grid-cols-2 p-3 border rounded-lg">
                  <div className="sm:col-span-2 text-sm font-medium text-muted-foreground">{b.label}</div>
                  {field(b.t, 'Título', b.tph)}
                  {field(b.d, 'Descripción', b.dph)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Legal Content ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Contenido Legal</CardTitle>
            <CardDescription>
              Personaliza el texto de las páginas legales. Si lo dejas vacío se mostrará el texto genérico del sistema.
              Puedes usar HTML básico (h2, p, ul, li, strong).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="legal_terms">
              <TabsList className="mb-4">
                {LEGAL_FIELDS.map(lf => (
                  <TabsTrigger key={lf.key} value={lf.key}>{lf.label}</TabsTrigger>
                ))}
              </TabsList>
              {LEGAL_FIELDS.map(lf => (
                <TabsContent key={lf.key} value={lf.key}>
                  <Textarea
                    value={form[lf.key] || ''}
                    onChange={e => set(lf.key, e.target.value)}
                    placeholder={`Pega aquí el HTML del contenido de "${lf.label}"...`}
                    rows={16}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Vacío = contenido por defecto. Con contenido = reemplaza todo el cuerpo de la página.
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <SaveButton />
      </div>
    </AdminLayout>
  );
}
