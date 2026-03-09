import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Palette, Globe, Share2, Search } from 'lucide-react';

const FIELDS = {
  identity: [
    { key: 'platform_name', label: 'Nombre de la Plataforma', placeholder: 'Ej: Mi Marketplace' },
    { key: 'platform_slogan', label: 'Slogan', placeholder: 'Tu slogan aquí' },
    { key: 'logo_url', label: 'URL del Logo', placeholder: 'https://...' },
    { key: 'favicon_url', label: 'URL del Favicon', placeholder: 'https://...' },
  ],
  colors: [
    { key: 'primary_color', label: 'Color Primario', placeholder: '#3B82F6' },
    { key: 'secondary_color', label: 'Color Secundario', placeholder: '#10B981' },
  ],
  contact: [
    { key: 'contact_email', label: 'Email de Contacto', placeholder: 'info@tuempresa.com' },
    { key: 'contact_phone', label: 'Teléfono', placeholder: '+509 ...' },
  ],
  social: [
    { key: 'social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
    { key: 'social_instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
    { key: 'social_whatsapp', label: 'WhatsApp', placeholder: '+509...' },
  ],
  seo: [
    { key: 'meta_title', label: 'Meta Título (SEO)', placeholder: 'Título para buscadores' },
    { key: 'meta_description', label: 'Meta Descripción (SEO)', placeholder: 'Descripción para buscadores', multiline: true },
  ],
};

export default function AdminBrandingPage() {
  const { settings, isLoading, getValue, updateMultiple } = useBrandingSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach(s => { map[s.key] = s.value; });
      setForm(map);
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateMultiple(form);
    setSaving(false);
  };

  const renderFields = (fields: typeof FIELDS.identity) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(f => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          {'multiline' in f && f.multiline ? (
            <Textarea
              id={f.key}
              value={form[f.key] || ''}
              onChange={e => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={3}
            />
          ) : (
            <Input
              id={f.key}
              value={form[f.key] || ''}
              onChange={e => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          )}
        </div>
      ))}
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
        {/* Preview */}
        {(form.logo_url || form.platform_name) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-4">
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
              )}
              <div>
                <h2 className="text-xl font-bold text-foreground">{form.platform_name || 'Tu Plataforma'}</h2>
                <p className="text-sm text-muted-foreground">{form.platform_slogan || ''}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Identidad</CardTitle>
            <CardDescription>Nombre, slogan, logo y favicon de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>{renderFields(FIELDS.identity)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Colores de Marca</CardTitle>
            <CardDescription>Colores principales para la identidad visual</CardDescription>
          </CardHeader>
          <CardContent>{renderFields(FIELDS.colors)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Contacto</CardTitle>
            <CardDescription>Información de contacto visible en la plataforma</CardDescription>
          </CardHeader>
          <CardContent>{renderFields(FIELDS.contact)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Redes Sociales</CardTitle>
            <CardDescription>Enlaces a tus redes sociales</CardDescription>
          </CardHeader>
          <CardContent>{renderFields(FIELDS.social)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> SEO</CardTitle>
            <CardDescription>Optimización para motores de búsqueda</CardDescription>
          </CardHeader>
          <CardContent>{renderFields(FIELDS.seo)}</CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Cambios
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
