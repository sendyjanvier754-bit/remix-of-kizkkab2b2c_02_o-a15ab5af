import { useState, useEffect } from "react";
import { GrossisteLayout } from "@/components/grossiste/GrossisteLayout";
import { useGrossisteProfile } from "@/hooks/useGrossisteProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function GrossisteProfilePage() {
  const { profile, isLoading, update } = useGrossisteProfile();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (profile) setForm({
      business_name: profile.business_name || '',
      legal_name: profile.legal_name || '',
      tax_id: profile.tax_id || '',
      country: profile.country || '',
      city: profile.city || '',
      address: profile.address || '',
      phone: profile.phone || '',
      description: profile.description || '',
    });
  }, [profile]);

  if (isLoading) return <GrossisteLayout title="Perfil del negocio"><p className="text-muted-foreground">Cargando…</p></GrossisteLayout>;

  return (
    <GrossisteLayout title="Perfil del negocio" subtitle="Datos comerciales y verificación">
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Estado de verificación</CardTitle>
            {profile?.verification_status === 'verified' ? <Badge className="bg-emerald-600">Verificado</Badge>
              : <Badge variant="outline">Pendiente</Badge>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Comisión de la plataforma: <strong>{profile?.commission_rate}%</strong></p>
            {profile?.verification_notes && <p className="text-xs mt-2 italic">"{profile.verification_notes}"</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Información del negocio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre comercial</Label><Input value={form.business_name || ''} onChange={e => setForm({ ...form, business_name: e.target.value })} /></div>
              <div><Label>Razón social</Label><Input value={form.legal_name || ''} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
              <div><Label>NIF / Tax ID</Label><Input value={form.tax_id || ''} onChange={e => setForm({ ...form, tax_id: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>País</Label><Input value={form.country || ''} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
              <div><Label>Ciudad</Label><Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div><Label>Dirección</Label><Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex justify-end">
              <Button onClick={() => update.mutate(form)} disabled={update.isPending}>{update.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </GrossisteLayout>
  );
}
