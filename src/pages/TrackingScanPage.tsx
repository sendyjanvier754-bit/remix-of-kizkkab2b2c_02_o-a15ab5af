import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PackageSearch, MapPin, Clock, Truck, CheckCircle2 } from "lucide-react";
import { useTrackingLookup, useUpdatePackageStatus } from "@/hooks/useHubCentral";
import { useAuth } from "@/hooks/useAuth";

const STATUS_OPTIONS = [
  { value: "preparing", label: "En preparación" },
  { value: "in_transit", label: "En tránsito" },
  { value: "at_hub", label: "En Hub Central" },
  { value: "ready_for_pickup", label: "Listo para entregar" },
  { value: "delivered", label: "Entregado" },
];

const TrackingScanPage = () => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, roles } = useAuth() as { user: unknown; isAdmin?: boolean; roles?: string[] };
  const [code, setCode] = useState(trackingId ?? "");
  const [query, setQuery] = useState(trackingId ?? "");
  const { data, isLoading } = useTrackingLookup(query);
  const updateStatus = useUpdatePackageStatus();

  const [newStatus, setNewStatus] = useState("");
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (trackingId) {
      setCode(trackingId);
      setQuery(trackingId);
    }
  }, [trackingId]);

  const canOperate =
    !!user && (isAdmin || (roles ?? []).some((role) => ["admin", "pickup_partner", "driver_partner"].includes(role)));

  const handleSearch = () => {
    setQuery(code.trim());
    if (code.trim()) navigate(`/rastreo/${encodeURIComponent(code.trim())}`, { replace: true });
  };

  const handleUpdate = async () => {
    if (!data?.order_id || !newStatus) return;
    await updateStatus.mutateAsync({
      trackingId: data.tracking_id,
      orderId: data.order_id,
      status: newStatus,
      eta: eta || null,
      note,
    });
    setNote("");
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold flex items-center justify-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" /> Rastreo de paquete
          </h1>
          <p className="text-sm text-muted-foreground">Escanea el QR de la guía o escribe el ID de seguimiento.</p>
        </div>

        <Card>
          <CardContent className="p-4 flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ID de seguimiento o número de pedido"
              className="h-11"
            />
            <Button className="h-11" onClick={handleSearch}>
              Buscar
            </Button>
          </CardContent>
        </Card>

        {isLoading && <Skeleton className="h-48 w-full" />}

        {!isLoading && query && !data && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No encontramos ningún paquete con ese ID.
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Pedido {data.order_number ?? "-"}</CardTitle>
                    <CardDescription className="font-mono text-xs break-all">{data.tracking_id}</CardDescription>
                  </div>
                  <Badge>{STATUS_OPTIONS.find((s) => s.value === data.status)?.label ?? data.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.pickup_point && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{data.pickup_point.name}</p>
                      <p className="text-muted-foreground">{data.pickup_point.address ?? ""}</p>
                      <p className="text-muted-foreground">{data.pickup_point.phone ?? ""}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{data.delivery_method === "pickup_point" ? "Retiro en punto" : "Entrega a domicilio"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>ETA: {data.eta ?? "Por definir"}</span>
                </div>
                {data.payment_status && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span>Pago: {data.payment_status}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {canOperate && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Actualizar paquete</CardTitle>
                  <CardDescription>Cambia el estado y ajusta el tiempo estimado de arribo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nuevo estado</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecciona estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ETA</Label>
                    <Input type="date" className="h-11" value={eta} onChange={(e) => setEta(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nota</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </div>
                  <Button className="w-full h-11" onClick={handleUpdate} disabled={!newStatus || updateStatus.isPending}>
                    Guardar actualización
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.events.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>}
                {data.events.map((event, index) => (
                  <div key={index} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="font-medium">{STATUS_OPTIONS.find((s) => s.value === event.status)?.label ?? event.status}</p>
                      {event.note && <p className="text-muted-foreground">{event.note}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default TrackingScanPage;
