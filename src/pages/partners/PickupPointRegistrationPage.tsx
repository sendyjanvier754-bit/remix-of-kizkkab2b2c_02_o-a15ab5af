import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CheckCircle2, Store, Loader2 } from "lucide-react";
import { useSubmitPartnerApplication, useDepartmentsAndCommunes } from "@/hooks/usePartnerApplication";
import { PartnerLogoUpload } from "@/components/partners/PartnerLogoUpload";

const PickupPointRegistrationPage = () => {
  const navigate = useNavigate();
  const submit = useSubmitPartnerApplication();
  const { departments, communes } = useDepartmentsAndCommunes();
  const [submitted, setSubmitted] = useState<{ token: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    national_id: "",
    business_name: "",
    address: "",
    department_id: "",
    commune_id: "",
    estimated_capacity: "",
    has_storage_space: true,
    notes: "",
    logo_url: "",
  });

  const filteredCommunes = useMemo(
    () => (communes.data ?? []).filter((c: any) => !form.department_id || c.department_id === form.department_id),
    [communes.data, form.department_id]
  );

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await submit.mutateAsync({
      application_type: "pickup_point",
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      data: {
        national_id: form.national_id,
        business_name: form.business_name,
        address: form.address,
        department_id: form.department_id,
        commune_id: form.commune_id,
        estimated_capacity: form.estimated_capacity,
        has_storage_space: form.has_storage_space,
        notes: form.notes,
        photo_url: form.logo_url,
      },
    });
    setSubmitted({ token: result.tracking_token });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Solicitud enviada!</h2>
            <p className="text-muted-foreground mb-6">
              Hemos recibido tu solicitud. Nuestro equipo la revisará y te contactaremos por correo electrónico.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Código de seguimiento: <span className="font-mono">{submitted.token.slice(0, 12)}…</span>
            </p>
            <Button onClick={() => navigate("/")} className="w-full">Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link to="/socios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Registro de punto de retiro</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Completa tus datos. Te contactaremos para activar tu punto.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre completo *</Label>
                  <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
                </div>
                <div>
                  <Label>Documento de identidad</Label>
                  <Input value={form.national_id} onChange={(e) => update("national_id", e.target.value)} />
                </div>
                <div>
                  <Label>Correo electrónico *</Label>
                  <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                </div>
                <div>
                  <Label>Teléfono *</Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                </div>
              </div>

              <div>
                <Label>Nombre del negocio / local *</Label>
                <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} required />
              </div>

              <PartnerLogoUpload
                label="Logo del punto de retiro"
                value={form.logo_url}
                onChange={(logo_url) => update("logo_url", logo_url)}
                slug="pickup-registration"
              />

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Departamento *</Label>
                  <Select value={form.department_id} onValueChange={(v) => { update("department_id", v); update("commune_id", ""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {(departments.data ?? []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comuna *</Label>
                  <Select value={form.commune_id} onValueChange={(v) => update("commune_id", v)} disabled={!form.department_id}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {filteredCommunes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Dirección exacta y referencias *</Label>
                <Textarea value={form.address} onChange={(e) => update("address", e.target.value)} required rows={2} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Capacidad estimada (paquetes/día)</Label>
                  <Input type="number" value={form.estimated_capacity} onChange={(e) => update("estimated_capacity", e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Tengo espacio de almacenamiento</Label>
                    <p className="text-xs text-muted-foreground">Para guardar paquetes varios días</p>
                  </div>
                  <Switch checked={form.has_storage_space} onCheckedChange={(v) => update("has_storage_space", v)} />
                </div>
              </div>

              <div>
                <Label>Notas adicionales</Label>
                <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} placeholder="Horarios, accesos, etc." />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submit.isPending}>
                {submit.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar solicitud
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PickupPointRegistrationPage;
