import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { BrandingImageUpload } from '@/components/admin/BrandingImageUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Save, Palette, Globe, Share2, Search, CreditCard, FileText, Image, ShieldCheck, Plus, X, MonitorPlay, Pencil } from 'lucide-react';

const PAYMENT_ICONS = [
  { key: 'payment_icon_visa',       label: 'VISA',                default: '/visa.png' },
  { key: 'payment_icon_mastercard', label: 'Mastercard',          default: '/mastercard.png' },
  { key: 'payment_icon_amex',       label: 'American Express',    default: '/american-express.png' },
  { key: 'payment_icon_applepay',   label: 'Apple Pay',           default: '/apple-pay.png' },
  { key: 'payment_icon_googlepay',  label: 'Google Pay',          default: '/google-pay.png' },
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

const TRUST_BADGES = [
  { t: 'trust_badge_1_title', d: 'trust_badge_1_desc', label: 'Garantía 1', tph: 'Ej: Envío desde el extranjero', dph: 'Ej: Recibe tus productos en 7-15 días' },
  { t: 'trust_badge_2_title', d: 'trust_badge_2_desc', label: 'Garantía 2', tph: 'Ej: Devolución Gratis', dph: 'Ej: Devuelve fácilmente en 30 días' },
  { t: 'trust_badge_3_title', d: 'trust_badge_3_desc', label: 'Garantía 3', tph: 'Ej: Pago Seguro', dph: 'Ej: Múltiples opciones de pago' },
];

type EditorId =
  | 'identity' | 'colors' | 'contact' | 'topbar' | 'social'
  | 'seo' | 'payments' | 'trust' | 'legal' | null;

export default function AdminBrandingPage() {
  const { settings, isLoading, updateMultiple } = useBrandingSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Which section modal is open, and the draft being edited inside it. */
  const [editor, setEditor] = useState<EditorId>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [legalKey, setLegalKey] = useState<string>('legal_terms');

  const [topbarMessages, setTopbarMessages] = useState<{ text: string; url: string }[]>([{ text: '', url: '' }]);
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
          setTopbarMessages(msgs.map((m: any) => (typeof m === 'string' ? { text: m, url: '' } : m)));
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

  /** Opens a section modal with a draft pre-filled from the saved values. */
  const openEditor = (id: Exclude<EditorId, null>, keys: string[], defaults: Record<string, string> = {}) => {
    const d: Record<string, string> = {};
    keys.forEach(k => { d[k] = form[k] ?? defaults[k] ?? ''; });
    setDraft(d);
    setEditor(id);
  };

  /** Saves only the keys of the open section, then closes the modal. */
  const saveDraft = async (extra: Record<string, string> = {}) => {
    const payload = { ...draft, ...extra };
    setSaving(true);
    try {
      const ok = await updateMultiple(payload);
      if (ok) {
        setForm(prev => ({ ...prev, ...payload }));
        setEditor(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const d = (key: string) => draft[key] ?? '';
  const setD = (key: string, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

  /** Text field bound to the draft of the open modal. */
  const dField = (key: string, label: string, placeholder = '', multiline = false) => (
    <div key={key} className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      {multiline
        ? <Textarea id={key} value={d(key)} onChange={e => setD(key, e.target.value)} placeholder={placeholder} rows={3} />
        : <Input id={key} value={d(key)} onChange={e => setD(key, e.target.value)} placeholder={placeholder} />}
    </div>
  );

  /** Color field (picker + hex input) bound to the draft. */
  const dColor = (key: string, label: string, fallback: string, hint?: string) => (
    <div key={key} className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2 items-center">
        <input type="color" value={d(key) || fallback} onChange={e => setD(key, e.target.value)} className="h-10 w-12 rounded border cursor-pointer p-1 bg-white" />
        <Input value={d(key)} onChange={e => setD(key, e.target.value)} placeholder={fallback} className="font-mono" />
      </div>
    </div>
  );

  const EditButton = ({ onClick }: { onClick: () => void }) => (
    <Button variant="outline" size="sm" className="shrink-0" onClick={onClick}>
      <Pencil className="h-4 w-4 mr-1" /> Editar
    </Button>
  );

  const ReadRow = ({ label, value }: { label: string; value?: string }) => (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value || <span className="text-muted-foreground italic">Sin configurar</span>}</p>
    </div>
  );

  const Swatch = ({ label, color, fallback }: { label: string; color?: string; fallback: string }) => (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 rounded border shrink-0" style={{ backgroundColor: color || fallback }} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xs font-mono">{color || fallback}</p>
      </div>
    </div>
  );

  // ── Top bar list helpers (used inside the topbar modal) ──
  const addMessage = () => setTopbarMessages(m => [...m, { text: '', url: '' }]);
  const updateMessage = (i: number, f: 'text' | 'url', v: string) =>
    setTopbarMessages(m => m.map((x, idx) => (idx === i ? { ...x, [f]: v } : x)));
  const removeMessage = (i: number) =>
    setTopbarMessages(m => (m.length > 1 ? m.filter((_, idx) => idx !== i) : m));

  const addRightLink = () => setTopbarRightLinks(l => [...l, { text: '', url: '' }]);
  const updateRightLink = (i: number, f: 'text' | 'url', v: string) =>
    setTopbarRightLinks(l => l.map((x, idx) => (idx === i ? { ...x, [f]: v } : x)));
  const removeRightLink = (i: number) =>
    setTopbarRightLinks(l => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l));

  const saveTopbar = () =>
    saveDraft({
      topbar_messages: JSON.stringify(topbarMessages.filter(m => m.text.trim())),
      topbar_right_links: JSON.stringify(topbarRightLinks.filter(l => l.text.trim())),
    });

  if (isLoading) {
    return (
      <AdminLayout title="Identidad de la Plataforma" subtitle="Configura nombre, logo, colores y más">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const DialogSaveFooter = ({ onSave }: { onSave: () => void }) => (
    <DialogFooter className="gap-2">
      <Button variant="outline" onClick={() => setEditor(null)} disabled={saving}>Cancelar</Button>
      <Button onClick={onSave} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4 mr-1" /> Guardar</>}
      </Button>
    </DialogFooter>
  );

  return (
    <AdminLayout title="Identidad de la Plataforma" subtitle="Cada sección se edita y se guarda en su propio modal">
      <div className="max-w-4xl space-y-6">

        {/* Live preview */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-full object-cover bg-white p-0.5 border" />
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">{form.platform_name || 'Tu Plataforma'}</h2>
              <p className="text-sm text-muted-foreground">{form.platform_slogan || ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Identity ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Identidad</CardTitle>
              <CardDescription>Nombre, slogan, loader, texto del navegador y previsualización al compartir</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('identity', [
              'platform_name', 'platform_slogan', 'logo_url', 'favicon_url',
              'loader_media_url', 'loader_media_type', 'loader_media_fit',
              'loader_ring_color', 'loader_ring_size', 'loader_ring_width',
              'browser_tab_title', 'browser_meta_description',
              'share_title', 'share_description', 'share_image_url',
            ], {
              loader_media_type: 'image', loader_media_fit: 'cover',
              loader_ring_color: '#1d4ed8', loader_ring_size: '96', loader_ring_width: '4',
            })} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <ReadRow label="Nombre de la Plataforma" value={form.platform_name} />
                <ReadRow label="Slogan" value={form.platform_slogan} />
                <ReadRow label="Título de Pestaña" value={form.browser_tab_title} />
                <ReadRow label="Texto del Navegador / Compartir" value={form.browser_meta_description || form.share_description} />
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Logo</p>
                  {form.logo_url
                    ? <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-full object-cover border bg-white p-0.5" />
                    : <div className="h-14 w-14 rounded-full border-2 border-dashed flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground" /></div>}
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Favicon</p>
                  {form.favicon_url
                    ? <img src={form.favicon_url} alt="Favicon" className="h-8 w-8 rounded-full object-cover border bg-white p-0.5" />
                    : <div className="h-8 w-8 rounded-full border-2 border-dashed flex items-center justify-center"><Image className="h-4 w-4 text-muted-foreground" /></div>}
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Loader</p>
                  {form.loader_media_url
                    ? (form.loader_media_type === 'video'
                      ? <video src={form.loader_media_url} className="h-8 w-8 rounded object-contain border bg-white p-0.5" muted loop playsInline />
                      : <img src={form.loader_media_url} alt="Loader" className="h-8 w-8 rounded object-contain border bg-white p-0.5" />)
                    : <div className="h-8 w-8 rounded border-2 border-dashed flex items-center justify-center"><MonitorPlay className="h-4 w-4 text-muted-foreground" /></div>}
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">Imagen Share</p>
                  {form.share_image_url
                    ? <img src={form.share_image_url} alt="Imagen para compartir" className="h-10 w-10 rounded object-cover border bg-white p-0.5" />
                    : <div className="h-10 w-10 rounded border-2 border-dashed flex items-center justify-center"><Share2 className="h-4 w-4 text-muted-foreground" /></div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Colors ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Colores de la Plataforma</CardTitle>
              <CardDescription>Colores de marca, encabezado y footer del sitio</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('colors', [
              'primary_color', 'secondary_color', 'header_bg', 'header_accent',
              'footer_bg', 'footer_text', 'footer_heading',
            ])} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Swatch label="Primario" color={form.primary_color} fallback="#3B82F6" />
            <Swatch label="Secundario" color={form.secondary_color} fallback="#10B981" />
            <Swatch label="Fondo Encabezado" color={form.header_bg} fallback="#ffdcdc" />
            <Swatch label="Acento Encabezado" color={form.header_accent} fallback="#071d7f" />
            <Swatch label="Fondo Footer" color={form.footer_bg} fallback="#111827" />
            <Swatch label="Texto Footer" color={form.footer_text} fallback="#9ca3af" />
          </CardContent>
        </Card>

        {/* ── Contact ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Contacto</CardTitle>
              <CardDescription>Información de contacto visible en la plataforma, facturas y páginas legales</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('contact', [
              'contact_email', 'contact_phone', 'whatsapp_support_link', 'whatsapp_support_number', 'whatsapp_support_message',
            ])} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Email de Contacto" value={form.contact_email} />
            <ReadRow label="Teléfono" value={form.contact_phone} />
            <ReadRow label="Enlace de WhatsApp" value={form.whatsapp_support_link} />
            <ReadRow label="WhatsApp de Soporte/Ventas" value={form.whatsapp_support_number} />
            <ReadRow label="Mensaje predeterminado de WhatsApp" value={form.whatsapp_support_message} />
          </CardContent>

        </Card>

        {/* ── Top Bar ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><MonitorPlay className="h-5 w-5" /> Barra Superior</CardTitle>
              <CardDescription>Color, mensajes rotativos y enlaces configurables</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('topbar', ['topbar_bg_color', 'topbar_text_color'])} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="rounded border text-xs px-4 h-10 flex items-center justify-between font-medium"
              style={{ backgroundColor: form.topbar_bg_color || '#f9fafb', color: form.topbar_text_color || '#4b5563' }}
            >
              <span>{topbarMessages.find(m => m.text.trim())?.text || 'Vista previa del mensaje...'}</span>
              <div className="flex items-center gap-3 opacity-70">
                {topbarRightLinks.filter(l => l.text.trim()).map((l, i) => <span key={i}>{l.text}</span>)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {topbarMessages.filter(m => m.text.trim()).length} mensaje(s) rotativo(s) · {topbarRightLinks.filter(l => l.text.trim()).length} enlace(s) a la derecha
            </p>
          </CardContent>
        </Card>

        {/* ── Social ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Redes Sociales</CardTitle>
              <CardDescription>Enlaces a tus redes sociales</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('social', ['social_facebook', 'social_instagram', 'social_whatsapp'])} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Facebook" value={form.social_facebook} />
            <ReadRow label="Instagram" value={form.social_instagram} />
            <ReadRow label="WhatsApp" value={form.social_whatsapp} />
          </CardContent>
        </Card>

        {/* ── SEO ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> SEO</CardTitle>
              <CardDescription>Optimización para motores de búsqueda</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('seo', ['meta_title', 'meta_description'])} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Meta Título" value={form.meta_title} />
            <ReadRow label="Meta Descripción" value={form.meta_description} />
          </CardContent>
        </Card>

        {/* ── Payment icons ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Iconos de Métodos de Pago</CardTitle>
              <CardDescription>Logos mostrados en footer, carrito y checkout</CardDescription>
            </div>
            <EditButton onClick={() => openEditor(
              'payments',
              PAYMENT_ICONS.map(p => p.key),
              Object.fromEntries(PAYMENT_ICONS.map(p => [p.key, p.default])),
            )} />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {PAYMENT_ICONS.map(p => {
              const src = form[p.key] ?? p.default;
              return (
                <div key={p.key} className="text-center space-y-1 w-20">
                  {src
                    ? <img src={src} alt={p.label} className="h-10 w-16 object-contain mx-auto border rounded bg-white p-0.5" />
                    : <div className="h-10 w-16 mx-auto border-2 border-dashed rounded flex items-center justify-center"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>}
                  <p className="text-[11px] text-muted-foreground truncate">{p.label}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Trust badges ── */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Garantías / Banners de Confianza</CardTitle>
              <CardDescription>Los 3 mensajes de confianza que aparecen en el footer</CardDescription>
            </div>
            <EditButton onClick={() => openEditor('trust', TRUST_BADGES.flatMap(b => [b.t, b.d]))} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {TRUST_BADGES.map(b => (
              <div key={b.t} className="p-3 border rounded-lg space-y-1">
                <p className="text-xs text-muted-foreground">{b.label}</p>
                <p className="text-sm font-medium">{form[b.t] || <span className="text-muted-foreground italic">Sin título</span>}</p>
                <p className="text-xs text-muted-foreground">{form[b.d] || 'Sin descripción'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Legal content ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Contenido Legal</CardTitle>
            <CardDescription>
              Personaliza el texto de las páginas legales. Cada documento se edita y guarda en su propio modal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {LEGAL_FIELDS.map(lf => (
              <div key={lf.key} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{lf.label}</p>
                  <Badge variant={form[lf.key] ? 'default' : 'secondary'} className="mt-1 text-[10px]">
                    {form[lf.key] ? 'Personalizado' : 'Texto por defecto'}
                  </Badge>
                </div>
                <EditButton onClick={() => { setLegalKey(lf.key); openEditor('legal', [lf.key]); }} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ══════════ Section modals ══════════ */}

        {/* Identity */}
        <Dialog open={editor === 'identity'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Editar Identidad</DialogTitle>
              <DialogDescription>Los cambios solo se guardan al hacer clic en Guardar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {dField('platform_name', 'Nombre de la Plataforma', 'Ej: Mi Marketplace')}
                {dField('platform_slogan', 'Slogan', 'Tu slogan aquí')}
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <BrandingImageUpload
                  id="dialog_logo_url" label="Logo" value={d('logo_url')}
                  onChange={v => setD('logo_url', v)} previewSize="lg" circular
                  minWidth={512} minHeight={512}
                  helperText="Calidad recomendada: mínimo 512x512 px."
                />
                <BrandingImageUpload
                  id="dialog_favicon_url" label="Favicon" value={d('favicon_url')}
                  onChange={v => setD('favicon_url', v)} previewSize="sm" circular
                  minWidth={256} minHeight={256}
                  helperText="Mínimo 256x256 px para la pestaña del navegador."
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5"><MonitorPlay className="h-4 w-4" /> Pantalla de carga</Label>
                <BrandingImageUpload
                  id="dialog_loader_media_url" label="Media (imagen / GIF / video)"
                  value={d('loader_media_url')} onChange={v => setD('loader_media_url', v)}
                  previewSize="sm" accept="image/*,video/mp4,video/webm,video/ogg" maxSizeMB={15}
                  helperText="Sube desde tu ordenador (imagen, GIF o video)."
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de media</Label>
                  <div className="flex gap-3">
                    {(['image', 'gif', 'video'] as const).map(t => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input type="radio" name="loader_media_type" value={t}
                          checked={(d('loader_media_type') || 'image') === t}
                          onChange={() => setD('loader_media_type', t)} className="accent-primary" />
                        {t === 'image' ? 'Imagen' : t === 'gif' ? 'GIF' : 'Video'}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ajuste dentro del círculo</Label>
                  <div className="flex gap-4">
                    {(['cover', 'contain'] as const).map(fit => (
                      <label key={fit} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input type="radio" name="loader_media_fit" value={fit}
                          checked={(d('loader_media_fit') || 'cover') === fit}
                          onChange={() => setD('loader_media_fit', fit)} className="accent-primary" />
                        {fit === 'cover' ? 'Llenar círculo (cover)' : 'Mostrar completa (contain)'}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dColor('loader_ring_color', 'Color del círculo giratorio', '#1d4ed8')}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tamaño del círculo (px)</Label>
                    <Input type="number" min={48} max={240} value={d('loader_ring_size') || '96'}
                      onChange={e => setD('loader_ring_size', e.target.value)} placeholder="96" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Grosor del borde giratorio (px)</Label>
                    <Input type="number" min={2} max={12} value={d('loader_ring_width') || '4'}
                      onChange={e => setD('loader_ring_width', e.target.value)} placeholder="4" />
                    <p className="text-[11px] text-muted-foreground">Rango recomendado: 2 a 12 px.</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium">Texto del navegador</Label>
                {dField('browser_tab_title', 'Título de la pestaña', 'Ej: Siver Market 509 | Marketplace')}
                {dField('browser_meta_description', 'Descripción (tooltip y meta por defecto)', 'Ej: Mayorista B2B en Haití', true)}
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Vista previa al compartir</Label>
                {dField('share_title', 'Título para compartir', 'Título OG/Twitter')}
                {dField('share_description', 'Descripción para compartir', 'Descripción OG/Twitter', true)}
                <BrandingImageUpload
                  id="dialog_share_image_url" label="Imagen para compartir link"
                  value={d('share_image_url')} onChange={v => setD('share_image_url', v)} previewSize="md"
                />
              </div>
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Colors */}
        <Dialog open={editor === 'colors'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Editar Colores</DialogTitle>
              <DialogDescription>Marca, encabezado y footer del sitio.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {dColor('primary_color', 'Color Primario', '#3B82F6')}
                {dColor('secondary_color', 'Color Secundario', '#10B981')}
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Encabezado (Header)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {dColor('header_bg', 'Fondo del Encabezado', '#ffdcdc')}
                  {dColor('header_accent', 'Color de Acento', '#071d7f', 'Barra categorías, hover, badge, botón B2B')}
                </div>
                <div className="rounded border overflow-hidden" style={{ backgroundColor: d('header_bg') || '#ffdcdc' }}>
                  <div className="flex items-center justify-between px-4 h-10">
                    <div className="w-20 h-4 rounded" style={{ backgroundColor: d('header_accent') || '#071d7f', opacity: 0.3 }} />
                    <div className="flex gap-3">
                      {[0, 1, 2].map(i => <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: d('header_accent') || '#071d7f', opacity: 0.25 }} />)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: d('header_accent') || '#071d7f' }}>
                    {['Cat 1', 'Cat 2', 'Cat 3'].map(c => <span key={c} className="text-[10px] text-white px-2">{c}</span>)}
                  </div>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Footer</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {dColor('footer_bg', 'Fondo del Footer', '#111827')}
                  {dColor('footer_text', 'Color de Texto / Links', '#9ca3af')}
                  {dColor('footer_heading', 'Color de Títulos', '#ffffff')}
                </div>
                <div className="rounded border px-4 py-3 space-y-1" style={{ backgroundColor: d('footer_bg') || '#111827' }}>
                  <p className="text-xs font-bold" style={{ color: d('footer_heading') || '#ffffff' }}>Título de sección</p>
                  <p className="text-xs" style={{ color: d('footer_text') || '#9ca3af' }}>Link de ejemplo · Link de ejemplo · Otro link</p>
                </div>
              </div>
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Contact */}
        <Dialog open={editor === 'contact'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Editar Contacto</DialogTitle>
              <DialogDescription>Datos visibles en la plataforma, facturas y páginas legales.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2 py-2">
              {dField('contact_email', 'Email de Contacto', 'info@tuempresa.com')}
              {dField('contact_phone', 'Teléfono', '+509 ...')}
              {dField('whatsapp_support_number', 'WhatsApp de Soporte/Ventas', '+509...')}
              {dField('whatsapp_support_message', 'Mensaje predeterminado de WhatsApp', 'Hola, necesito ayuda con mi compra.')}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Si dejas vacío el WhatsApp de soporte se usará el número de redes sociales o el teléfono de contacto.
              </p>
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Top bar */}
        <Dialog open={editor === 'topbar'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><MonitorPlay className="h-5 w-5" /> Editar Barra Superior</DialogTitle>
              <DialogDescription>Colores, mensajes rotativos y enlaces del lado derecho.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {dColor('topbar_bg_color', 'Color de Fondo', '#f9fafb')}
                {dColor('topbar_text_color', 'Color de Texto', '#4b5563')}
              </div>
              <div
                className="rounded border text-xs px-4 h-10 flex items-center justify-between font-medium"
                style={{ backgroundColor: d('topbar_bg_color') || '#f9fafb', color: d('topbar_text_color') || '#4b5563' }}
              >
                <span>{topbarMessages.find(m => m.text.trim())?.text || 'Vista previa del mensaje...'}</span>
                <div className="flex items-center gap-3 opacity-70">
                  {topbarRightLinks.filter(l => l.text.trim()).map((l, i) => <span key={i}>{l.text}</span>)}
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label>Mensajes Rotativos (izquierda)</Label>
                {topbarMessages.map((msg, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input value={msg.text} onChange={e => updateMessage(i, 'text', e.target.value)} placeholder="Texto, ej: Envío internacional" />
                      <Input value={msg.url} onChange={e => updateMessage(i, 'url', e.target.value)} placeholder="URL (opcional)" className="font-mono text-xs" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMessage(i)} disabled={topbarMessages.length === 1}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMessage}><Plus className="h-4 w-4 mr-1" /> Agregar Mensaje</Button>
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label>Enlaces del Lado Derecho</Label>
                {topbarRightLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input value={link.text} onChange={e => updateRightLink(i, 'text', e.target.value)} placeholder="Texto, ej: Centro de Ayuda" />
                      <Input value={link.url} onChange={e => updateRightLink(i, 'url', e.target.value)} placeholder="URL, ej: /contacto" className="font-mono text-xs" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRightLink(i)} disabled={topbarRightLinks.length === 1}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addRightLink}><Plus className="h-4 w-4 mr-1" /> Agregar Enlace</Button>
              </div>
            </div>
            <DialogSaveFooter onSave={saveTopbar} />
          </DialogContent>
        </Dialog>

        {/* Social */}
        <Dialog open={editor === 'social'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Editar Redes Sociales</DialogTitle>
              <DialogDescription>Enlaces mostrados en el footer y páginas de contacto.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {dField('social_facebook', 'Facebook', 'https://facebook.com/...')}
              {dField('social_instagram', 'Instagram', 'https://instagram.com/...')}
              {dField('social_whatsapp', 'WhatsApp', '+509...')}
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* SEO */}
        <Dialog open={editor === 'seo'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Editar SEO</DialogTitle>
              <DialogDescription>Metadatos para motores de búsqueda.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {dField('meta_title', 'Meta Título', 'Título para buscadores')}
              {dField('meta_description', 'Meta Descripción', 'Descripción para buscadores', true)}
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Payment icons */}
        <Dialog open={editor === 'payments'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Editar Iconos de Pago</DialogTitle>
              <DialogDescription>Deja en blanco para usar el badge de texto por defecto.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 py-2">
              {PAYMENT_ICONS.map(p => (
                <BrandingImageUpload
                  key={p.key} id={`dlg_${p.key}`} label={p.label}
                  value={d(p.key)} onChange={v => setD(p.key, v)} previewSize="md"
                />
              ))}
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Trust badges */}
        <Dialog open={editor === 'trust'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Editar Garantías</DialogTitle>
              <DialogDescription>Mensajes de confianza mostrados en el footer.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {TRUST_BADGES.map(b => (
                <div key={b.t} className="grid gap-3 sm:grid-cols-2 p-3 border rounded-lg">
                  <div className="sm:col-span-2 text-sm font-medium text-muted-foreground">{b.label}</div>
                  {dField(b.t, 'Título', b.tph)}
                  {dField(b.d, 'Descripción', b.dph)}
                </div>
              ))}
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

        {/* Legal (one document at a time) */}
        <Dialog open={editor === 'legal'} onOpenChange={o => !o && setEditor(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> {LEGAL_FIELDS.find(l => l.key === legalKey)?.label}
              </DialogTitle>
              <DialogDescription>Puedes usar HTML básico (h2, p, ul, li, strong). Vacío = contenido por defecto.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Textarea
                value={d(legalKey)}
                onChange={e => setD(legalKey, e.target.value)}
                placeholder={`Pega aquí el HTML del contenido de "${LEGAL_FIELDS.find(l => l.key === legalKey)?.label}"...`}
                rows={16}
                className="font-mono text-xs w-full"
              />
            </div>
            <DialogSaveFooter onSave={() => saveDraft()} />
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}
