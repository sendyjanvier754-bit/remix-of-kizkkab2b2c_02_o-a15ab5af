import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Store, Mail, Phone, MapPin, Calendar, CheckCircle2, XCircle, Loader2, UserSearch } from "lucide-react";
import { usePartnerApplications, useApprovePartnerApplication, useRejectPartnerApplication } from "@/hooks/usePartnerApplication";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  approved: { label: "Aprobada", variant: "default" },
  rejected: { label: "Rechazada", variant: "destructive" },
};

const TYPE_META: Record<string, { label: string; Icon: any }> = {
  pickup_point: { label: "Punto de retiro", Icon: Store },
  driver: { label: "Conductor", Icon: Truck },
};

const AdminPartnerApplicationsPage = () => {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data, isLoading, refetch } = usePartnerApplications(tab);
  const approve = useApprovePartnerApplication();
  const reject = useRejectPartnerApplication();
  const { toast } = useToast();

  const [selected, setSelected] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleSearchUser = async () => {
    const targetEmail = (searchEmail || selected?.email || "").trim().toLowerCase();
    if (!targetEmail) return;
    setSearching(true);
    setFoundUserId(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", targetEmail)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        setFoundUserId(data.id);
        toast({ title: "Usuario encontrado", description: data.email ?? targetEmail });
      } else {
        toast({
          title: "No encontrado",
          description: "Este correo no tiene cuenta. Pídele al socio que se registre primero.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleApprove = async () => {
    if (!selected || !foundUserId) return;
    await approve.mutateAsync({ application_id: selected.id, approved_user_id: foundUserId });
    setSelected(null);
    setFoundUserId(null);
    setSearchEmail("");
  };

  const handleReject = async () => {
    if (!selected || !rejectReason) return;
    await reject.mutateAsync({ application_id: selected.id, reason: rejectReason });
    setSelected(null);
    setRejectReason("");
  };

  return (
    <AdminLayout title="Solicitudes de socios">
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground">Aprueba o rechaza nuevas postulaciones de puntos de retiro y conductores.</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">No hay solicitudes en este estado.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {data!.map((app: any) => {
                  const meta = TYPE_META[app.application_type];
                  const status = STATUS_LABEL[app.status];
                  return (
                    <Card key={app.id} className="hover:shadow-md transition cursor-pointer" onClick={() => setSelected(app)}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <meta.Icon className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold truncate">{app.full_name}</h3>
                              <Badge variant="outline">{meta.label}</Badge>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {app.email}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone}</span>
                              </div>
                              {app.business_name && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {app.business_name}</div>}
                              <div className="flex items-center gap-1 text-xs">
                                <Calendar className="w-3 h-3" /> {new Date(app.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setFoundUserId(null); setRejectReason(""); }}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Detalle de solicitud — {TYPE_META[selected.application_type]?.label}</DialogTitle>
                <DialogDescription>{selected.full_name} · {selected.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <DetailRow label="Teléfono" value={selected.phone} />
                <DetailRow label="Documento" value={selected.national_id} />
                {selected.application_type === "pickup_point" && (
                  <>
                    <DetailRow label="Negocio" value={selected.business_name} />
                    <DetailRow label="Dirección" value={selected.address} />
                    <DetailRow label="Capacidad" value={selected.estimated_capacity ? `${selected.estimated_capacity} paquetes/día` : null} />
                    <DetailRow label="Almacenamiento" value={selected.has_storage_space ? "Sí" : "No"} />
                  </>
                )}
                {selected.application_type === "driver" && (
                  <>
                    <DetailRow label="Vehículo" value={selected.vehicle_type} />
                    <DetailRow label="Placa" value={selected.vehicle_plate} />
                    <DetailRow label="Capacidad" value={selected.vehicle_capacity_kg ? `${selected.vehicle_capacity_kg} kg` : null} />
                    <DetailRow label="Licencia" value={selected.license_number} />
                    <DetailRow label="Departamentos" value={selected.coverage_department_ids?.length ? `${selected.coverage_department_ids.length} seleccionados` : null} />
                  </>
                )}
                <DetailRow label="Notas" value={selected.notes} />
              </div>

              {selected.status === "pending" && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Buscar usuario por correo (debe tener cuenta creada)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={searchEmail || selected.email} onChange={(e) => setSearchEmail(e.target.value)} placeholder={selected.email} />
                      <Button type="button" variant="outline" onClick={handleSearchUser} disabled={searching}>
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserSearch className="w-4 h-4" />}
                      </Button>
                    </div>
                    {foundUserId && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Usuario detectado
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Motivo de rechazo (opcional, si rechazas)</Label>
                    <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
                  </div>
                </div>
              )}

              {selected.status === "rejected" && selected.rejection_reason && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                  <strong>Motivo del rechazo:</strong> {selected.rejection_reason}
                </div>
              )}

              <DialogFooter>
                {selected.status === "pending" ? (
                  <>
                    <Button variant="destructive" onClick={handleReject} disabled={!rejectReason || reject.isPending}>
                      <XCircle className="w-4 h-4 mr-2" /> Rechazar
                    </Button>
                    <Button onClick={handleApprove} disabled={!foundUserId || approve.isPending}>
                      {approve.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Aprobar
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const DetailRow = ({ label, value }: { label: string; value: any }) =>
  value ? (
    <div className="flex justify-between gap-4 py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  ) : null;

export default AdminPartnerApplicationsPage;
