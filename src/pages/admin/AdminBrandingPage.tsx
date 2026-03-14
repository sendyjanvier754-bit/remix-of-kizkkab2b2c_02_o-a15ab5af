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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Save, Palette, Globe, Share2, Search, CreditCard, FileText, Image, ShieldCheck, Plus, X, MonitorPlay, Pencil } from 'lucide-react';

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
  const [identityOpen, setIdentityOpen] = useState(false);
  // Draft used inside the Identity dialog — only committed on save
  const [identityDraft, setIdentityDraft] = useState<Record<string, string>>({});

  // Each message: { text: string; url: string }
  const [topbarMessages, setTopbarMessages] = useState<{ text: string; url: string }[]>([{ text: '', url: '' }]);
  // Right-side links: [{ text, url }]
  const [topbarRightLinks, setTopbarRightLinks] = useState<{ text: string; url: string }[]>([
    { text: 'Centro de Ayuda', url: '' },
    { text: 'Vender', url: '/admin/login' },
  ]);

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach(s => { map[s.key] = s.value; });
      setForm(map);
      try {
        const msgs = JSON.parse(map.topbar_messages || '[]');
        if (Array.isArray(msgs) && msgs.length > 0) {
          // Support both legacy string[] and new {text,url}[]
          setTopbarMessages(msgs.map((m: any) =>
            typeof m === 'string' ? { text: m, url: '' } : m
          ));
        } else {
          setTopbarMessages([{ text: '', url: '' }]);
        }
      } catch { setTopbarMessages([{ text: '', url: '' }]); }
      try {
        const rl = JSON.parse(map.topbar_right_links || '[]');
        if (Array.isArray(rl) && rl.length > 0) setTopbarRightLinks(rl);
      } catch {}
    }
  }, [settings]);

  const syncMessages = (msgs: { text: string; url: string }[]) => {
    setTopbarMessages(msgs);
    setForm(prev => ({ ...prev, topbar_messages: JSON.stringify(msgs.filter(m => m.text.trim())) }));
  };
  const syncRightLinks = (links: { text: string; url: string }[]) => {
    setTopbarRightLinks(links);
    setForm(prev => ({ ...prev, topbar_right_links: JSON.stringify(links.filter(l => l.text.trim())) }));
  };

  const addMessage = () => syncMessages([...topbarMessages, { text: '', url: '' }]);
  const updateMessage = (i: number, field: 'text' | 'url', value: string) => {
    const updated = [...topbarMessages];
    updated[i] = { ...updated[i], [field]: value };
    syncMessages(updated);
  };
  const removeMessage = (i: number) => {
    const updated = topbarMessages.filter((_, idx) => idx !== i);
    syncMessages(updated.length > 0 ? updated : [{ text: '', url: '' }]);
  };

  const addRightLink = () => syncRightLinks([...topbarRightLinks, { text: '', url: '' }]);
  const updateRightLink = (i: number, field: 'text' | 'url', value: string) => {
    const updated = [...topbarRightLinks];
    updated[i] = { ...updated[i], [field]: value };
    syncRightLinks(updated);
  };
  const removeRightLink = (i: number) => {
    const updated = topbarRightLinks.filter((_, idx) => idx !== i);
    syncRightLinks(updated.length > 0 ? updated : [{ text: '', url: '' }]);
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

        {/* ── Identity ── (read-only card + edit dialog) */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Identidad</CardTitle>
              <CardDescription>Nombre, slogan, logo y favicon de la plataforma</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setIdentityDraft({
                  platform_name:   form.platform_name   || '',
                  platform_slogan: form.platform_slogan || '',
                  logo_url:        form.logo_url        || '',
                  favicon_url:     form.favicon_url     || '',
                });
                setIdentityOpen(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Name & Slogan */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nombre de la Plataforma</p>
                  <p className="font-semibold text-base">{form.platform_name || <span className="text-muted-foreground italic text-sm">Sin configurar</span>}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Slogan</p>
                  <p className="text-sm">{form.platform_slogan || <span className="text-muted-foreground italic">Sin configurar</span>}</p>
                </div>
              </div>
              {/* Logo & Favicon previews */}
              <div className="flex items-center gap-6">
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Logo</p>
                  {form.logo_url
                    ? <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-lg object-contain border bg-white p-1" />
                    : <div className="h-14 w-14 rounded-lg border-2 border-dashed flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground" /></div>
                  }
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Favicon</p>
                  {form.favicon_url
                    ? <img src={form.favicon_url} alt="Favicon" className="h-8 w-8 rounded object-contain border bg-white p-0.5" />
                    : <div className="h-8 w-8 rounded border-2 border-dashed flex items-center justify-center"><Image className="h-4 w-4 text-muted-foreground" /></div>
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity edit dialog */}
        <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Editar Identidad</DialogTitle>
              <DialogDescription>Modifica nombre, slogan, logo y favicon. Los cambios solo se guardan al hacer clic en Guardar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la Plataforma</Label>
                  <Input
                    value={identityDraft.platform_name || ''}
                    onChange={e => setIdentityDraft(d => ({ ...d, platform_name: e.target.value }))}
                    placeholder="Ej: Mi Marketplace"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slogan</Label>
                  <Input
                    value={identityDraft.platform_slogan || ''}
                    onChange={e => setIdentityDraft(d => ({ ...d, platform_slogan: e.target.value }))}
                    placeholder="Tu slogan aquí"
                  />
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <BrandingImageUpload
                  id="dialog_logo_url"
                  label="Logo"
                  value={identityDraft.logo_url || ''}
                  onChange={v => setIdentityDraft(d => ({ ...d, logo_url: v }))}
                  previewSize="lg"
                />
                <BrandingImageUpload
                  id="dialog_favicon_url"
                  label="Favicon"
                  value={identityDraft.favicon_url || ''}
                  onChange={v => setIdentityDraft(d => ({ ...d, favicon_url: v }))}
                  previewSize="sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIdentityOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  setForm(prev => ({ ...prev, ...identityDraft }));
                  setIdentityOpen(false);
                }}
              >
                <Save className="h-4 w-4 mr-1" /> Aplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Colors ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Colores de la Plataforma</CardTitle>
            <CardDescription>Colores de marca, encabezado y footer del sitio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Brand colors */}
            <div>
              <p className="text-sm font-medium mb-3">Colores de Marca</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('primary_color', 'Color Primario', '#3B82F6')}
                {field('secondary_color', 'Color Secundario', '#10B981')}
              </div>
            </div>

            {/* Header colors */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-1">Encabezado (Header)</p>
              <p className="text-xs text-muted-foreground mb-3">Aplica al encabezado principal del sitio (escritorio y móvil).</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Fondo del Encabezado</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.header_bg || '#ffdcdc'} onChange={e => set('header_bg', e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
                    <Input value={form.header_bg || ''} onChange={e => set('header_bg', e.target.value)} placeholder="#ffdcdc" className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color de Acento</Label>
                  <p className="text-xs text-muted-foreground">Barra categorías, hover, badge, botón B2B</p>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.header_accent || '#071d7f'} onChange={e => set('header_accent', e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
                    <Input value={form.header_accent || ''} onChange={e => set('header_accent', e.target.value)} placeholder="#071d7f" className="font-mono" />
                  </div>
                </div>
              </div>
              {/* Header preview */}
              <div className="mt-3 rounded border overflow-hidden" style={{ backgroundColor: form.header_bg || '#ffdcdc' }}>
                <div className="flex items-center justify-between px-4 h-10">
                  <div className="w-20 h-4 rounded" style={{ backgroundColor: form.header_accent || '#071d7f', opacity: 0.3 }} />
                  <div className="flex gap-3">
                    {['', '', ''].map((_, i) => <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: form.header_accent || '#071d7f', opacity: 0.25 }} />)}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: form.header_accent || '#071d7f' }}>
                  {['Cat 1', 'Cat 2', 'Cat 3'].map(c => <span key={c} className="text-[10px] text-white px-2">{c}</span>)}
                </div>
              </div>
            </div>

            {/* Footer colors */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-1">Footer</p>
              <p className="text-xs text-muted-foreground mb-3">Colores del footer del sitio.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Fondo del Footer</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.footer_bg || '#111827'} onChange={e => set('footer_bg', e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
                    <Input value={form.footer_bg || ''} onChange={e => set('footer_bg', e.target.value)} placeholder="#111827" className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color de Texto / Links</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.footer_text || '#9ca3af'} onChange={e => set('footer_text', e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
                    <Input value={form.footer_text || ''} onChange={e => set('footer_text', e.target.value)} placeholder="#9ca3af" className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color de Títulos</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.footer_heading || '#ffffff'} onChange={e => set('footer_heading', e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
                    <Input value={form.footer_heading || ''} onChange={e => set('footer_heading', e.target.value)} placeholder="#ffffff" className="font-mono" />
                  </div>
                </div>
              </div>
              {/* Footer preview */}
              <div className="mt-3 rounded border px-4 py-3 space-y-1" style={{ backgroundColor: form.footer_bg || '#111827' }}>
                <p className="text-xs font-bold" style={{ color: form.footer_heading || '#ffffff' }}>Título de sección</p>
                <p className="text-xs" style={{ color: form.footer_text || '#9ca3af' }}>Link de ejemplo &middot; Link de ejemplo &middot; Otro link</p>
              </div>
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
            <CardDescription>Color, mensajes rotativos y enlaces configurables de la barra superior del sitio</CardDescription>
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
              <span>{topbarMessages.find(m => m.text.trim())?.text || 'Vista previa del mensaje...'}</span>
              <div className="flex items-center gap-3 opacity-70">
                {topbarRightLinks.filter(l => l.text.trim()).map((l, i) => (
                  <span key={i}>{l.text}</span>
                ))}
              </div>
            </div>

            {/* Left — Rotating messages */}
            <div className="space-y-3">
              <Label>Mensajes Rotativos (izquierda)</Label>
              <p className="text-xs text-muted-foreground">Se muestran uno tras otro. Puedes agregar un enlace opcional a cada mensaje.</p>
              <div className="space-y-2">
                {topbarMessages.map((msg, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={msg.text}
                        onChange={e => updateMessage(i, 'text', e.target.value)}
                        placeholder={`Texto, ej: Envío internacional`}
                      />
                      <Input
                        value={msg.url}
                        onChange={e => updateMessage(i, 'url', e.target.value)}
                        placeholder="URL (opcional), ej: /tendencias"
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeMessage(i)}
                      disabled={topbarMessages.length === 1}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addMessage}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Mensaje
              </Button>
            </div>

            {/* Right — Action links */}
            <div className="space-y-3 border-t pt-4">
              <Label>Enlaces del Lado Derecho</Label>
              <p className="text-xs text-muted-foreground">Texto e URL de cada enlace que aparece a la derecha de la barra (ej: Centro de Ayuda, Vender).</p>
              <div className="space-y-2">
                {topbarRightLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={link.text}
                        onChange={e => updateRightLink(i, 'text', e.target.value)}
                        placeholder={`Texto, ej: Centro de Ayuda`}
                      />
                      <Input
                        value={link.url}
                        onChange={e => updateRightLink(i, 'url', e.target.value)}
                        placeholder="URL, ej: /contacto"
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeRightLink(i)}
                      disabled={topbarRightLinks.length === 1}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addRightLink}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Enlace
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
            <Tabs defaultValue="legal_terms" orientation="vertical">
              <div className="flex gap-4">
                {/* Sidebar nav */}
                <TabsList className="flex flex-col h-auto w-52 shrink-0 items-stretch gap-0.5 bg-muted/50 p-1 rounded-lg">
                  {LEGAL_FIELDS.map(lf => (
                    <TabsTrigger
                      key={lf.key}
                      value={lf.key}
                      className="justify-start text-left text-sm px-3 py-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      {lf.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {/* Content panels */}
                <div className="flex-1 min-w-0">
                  {LEGAL_FIELDS.map(lf => (
                    <TabsContent key={lf.key} value={lf.key} className="mt-0">
                      <Textarea
                        value={form[lf.key] || ''}
                        onChange={e => set(lf.key, e.target.value)}
                        placeholder={`Pega aquí el HTML del contenido de "${lf.label}"...`}
                        rows={18}
                        className="font-mono text-xs w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Vacío = contenido por defecto. Con contenido = reemplaza todo el cuerpo de la página.
                      </p>
                    </TabsContent>
                  ))}
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <SaveButton />
      </div>
    </AdminLayout>
  );
}
