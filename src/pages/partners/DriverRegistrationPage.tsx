import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle2, Truck, Loader2 } from "lucide-react";
import { useSubmitPartnerApplication, useDepartmentsAndCommunes } from "@/hooks/usePartnerApplication";

const VEHICLE_TYPES = [
  { value: "moto", label: "Motocicleta" },
  { value: "car", label: "Automóvil" },
  { value: "van", label: "Camioneta" },
  { value: "truck", label: "Camión" },
  { value: "bicycle", label: "Bicicleta" },
];

const DriverRegistrationPage = () => {
  const navigate = useNavigate();
  const submit = useSubmitPartnerApplication();
  const { departments } = useDepartmentsAndCommunes();
  const [submitted, setSubmitted] = useState<{ token: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    national_id: "",
    vehicle_type: "",
    vehicle_plate: "",
    vehicle_capacity_kg: "",
    license_number: "",
    coverage_department_ids: [] as string[],
    notes: "",
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDept = (id: string) => {
    setForm((f) => ({
      ...f,
      coverage_department_ids: f.coverage_department_ids.includes(id)
        ? f.coverage_department_ids.filter((x) => x !== id)
        : [...f.coverage_department_ids, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.coverage_department_ids.length === 0) {
      alert("Selecciona al menos un departamento de cobertura");
      return;
    }
    const result = await submit.mutateAsync({
      application_type: "driver",
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      data: {
        national_id: form.national_id,
        vehicle_type: form.vehicle_type,
        vehicle_plate: form.vehicle_plate,
        vehicle_capacity_kg: form.vehicle_capacity_kg,
        license_number: form.license_number,
        coverage_department_ids: form.coverage_department_ids,
        notes: form.notes,
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
              Revisaremos tu información y documentación. Te contactaremos por correo cuando esté lista.
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
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Registro de conductor</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Completa tus datos y los de tu vehículo.</p>
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
                <div>
                  <Label>Tipo de vehículo *</Label>
                  <Select value={form.vehicle_type} onValueChange={(v) => update("vehicle_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Placa del vehículo</Label>
                  <Input value={form.vehicle_plate} onChange={(e) => update("vehicle_plate", e.target.value)} />
                </div>
                <div>
                  <Label>Capacidad de carga (kg)</Label>
                  <Input type="number" value={form.vehicle_capacity_kg} onChange={(e) => update("vehicle_capacity_kg", e.target.value)} />
                </div>
                <div>
                  <Label>Número de licencia</Label>
                  <Input value={form.license_number} onChange={(e) => update("license_number", e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Departamentos donde puedes operar *</Label>
                <p className="text-xs text-muted-foreground mb-2">Selecciona todos los que apliquen</p>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto rounded-lg border p-3">
                  {(departments.data ?? []).map((d: any) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted rounded">
                      <Checkbox
                        checked={form.coverage_department_ids.includes(d.id)}
                        onCheckedChange={() => toggleDept(d.id)}
                      />
                      <span className="text-sm">{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notas adicionales</Label>
                <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} placeholder="Disponibilidad, experiencia, etc." />
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

export default DriverRegistrationPage;
