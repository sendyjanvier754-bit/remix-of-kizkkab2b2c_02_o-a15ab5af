import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, ScanLine, Package, Printer, Download, Weight, Building2, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHubBoxes, useHubBoxItems, useReceiveBox, useProcessBox, type HubBox } from "@/hooks/useHubCentral";
import { downloadShippingLabel, printShippingLabel } from "@/lib/shippingLabel";

const statusVariant = (status: string) => {
  if (status === "processed") return "default" as const;
  if (status === "received") return "secondary" as const;
  return "outline" as const;
};

const addressLine = (address: Record<string, unknown> | null) => {
  if (!address) return null;
  const parts = [address.address, address.street, address.city, address.commune, address.department, address.country]
    .filter(Boolean)
    .map(String);
  return parts.join(", ") || null;
};

const AdminHubCentralPage = () => {
  const [scanCode, setScanCode] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBox, setSelectedBox] = useState<HubBox | null>(null);

  const { data: boxes, isLoading } = useHubBoxes(statusFilter);
  const { data: items, isLoading: itemsLoading } = useHubBoxItems(selectedBox?.id);
  const receiveBox = useReceiveBox();
  const processBox = useProcessBox();

  const { data: countries } = useQuery({
    queryKey: ["destination-countries-hub"],
    queryFn: async () => {
      const { data, error } = await supabase.from("destination_countries").select("code, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pickupPoints } = useQuery({
    queryKey: ["pickup-points-basic"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pickup_points").select("id, name, address, phone").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const list = boxes ?? [];
    return {
      boxes: list.length,
      pending: list.filter((b) => b.status !== "processed").length,
      weight: list.reduce((sum, b) => sum + Number(b.total_weight_kg || 0), 0),
      items: list.reduce((sum, b) => sum + Number(b.items_count || 0), 0),
    };
  }, [boxes]);

  const handleScan = async () => {
    const boxId = await receiveBox.mutateAsync({ trackingId: scanCode, originCountry: originCountry || undefined });
    setScanCode("");
    const { data } = await supabase.from("hub_boxes").select("*").eq("id", boxId).maybeSingle();
    if (data) setSelectedBox(data as unknown as HubBox);
  };

  const labelDataFor = (item: NonNullable<typeof items>[number]) => {
    const point = pickupPoints?.find((p) => p.id === item.pickup_point_id);
    return {
      trackingId: item.tracking_id || item.order_number || item.id,
      orderNumber: item.order_number,
      buyerName: item.buyer_name,
      buyerPhone: item.buyer_phone,
      pickupPointName: point?.name ?? null,
      addressLine: addressLine(item.shipping_address) ?? point?.address ?? null,
      weightKg: (Number(item.unit_weight_grams) * item.quantity) / 1000,
      itemsSummary: [`${item.quantity} × ${item.product_name ?? item.sku ?? ""}`],
      originCountry: selectedBox?.origin_country ?? null,
      boxTracking: selectedBox?.internal_tracking_id ?? null,
    };
  };

  return (
    <AdminLayout title="Hub Central" subtitle="Recepción de cajas, desglose de contenido y guías con QR">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Cajas", value: totals.boxes, icon: Boxes },
            { label: "Pendientes", value: totals.pending, icon: Package },
            { label: "Artículos", value: totals.items, icon: Building2 },
            { label: "Peso acumulado", value: `${totals.weight.toFixed(2)} kg`, icon: Weight },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <metric.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-lg font-semibold">{metric.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-primary" /> Recepción de caja
            </CardTitle>
            <CardDescription>
              Escanea o escribe el ID de rastreo interno de la caja (contiene el rastreo de China).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>ID de rastreo interno / China</Label>
              <Input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="Ej. HT-ORD1234-OU-PO-2026-01..."
              />
            </div>
            <div className="space-y-2">
              <Label>País de origen</Label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona país" />
                </SelectTrigger>
                <SelectContent>
                  {(countries ?? []).map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleScan} disabled={receiveBox.isPending || !scanCode.trim()}>
              Procesar caja
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Cajas en el Hub</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="received">Recibidas</SelectItem>
                <SelectItem value="processed">Procesadas</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID interno</TableHead>
                    <TableHead>Rastreo China</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Artículos</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(boxes ?? []).map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="font-mono text-xs">{box.internal_tracking_id}</TableCell>
                      <TableCell className="font-mono text-xs">{box.china_tracking_id ?? "-"}</TableCell>
                      <TableCell>{box.origin_country ?? "-"}</TableCell>
                      <TableCell>{box.items_count}</TableCell>
                      <TableCell>{Number(box.total_weight_kg).toFixed(2)} kg</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(box.status)}>{box.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedBox(box)}>
                          Ver contenido
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(boxes ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aún no hay cajas registradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedBox} onOpenChange={(open) => !open && setSelectedBox(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{selectedBox?.internal_tracking_id}</DialogTitle>
            <DialogDescription>
              Rastreo China: {selectedBox?.china_tracking_id ?? "-"} · Peso {Number(selectedBox?.total_weight_kg ?? 0).toFixed(2)} kg
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => selectedBox && processBox.mutate(selectedBox.id)}
              disabled={processBox.isPending || selectedBox?.status === "processed"}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar pedidos como "preparing"
            </Button>
          </div>

          {itemsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-3">
              {(items ?? []).map((item) => {
                const point = pickupPoints?.find((p) => p.id === item.pickup_point_id);
                return (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.product_name ?? item.sku}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.sku} · {item.quantity} u · {Number(item.unit_weight_grams)} g/u ·{" "}
                            {((Number(item.unit_weight_grams) * item.quantity) / 1000).toFixed(3)} kg
                          </p>
                        </div>
                        <Badge variant="outline">Pedido {item.order_number ?? "-"}</Badge>
                      </div>

                      <div className="grid gap-1 text-sm sm:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {item.buyer_name ?? "Comprador"}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {item.buyer_phone ?? "-"}
                        </p>
                        <p className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {point ? `Punto de entrega: ${point.name}` : addressLine(item.shipping_address) ?? "Sin dirección"}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => downloadShippingLabel(labelDataFor(item))}>
                          <Download className="h-4 w-4 mr-2" /> Guía PDF
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => printShippingLabel(labelDataFor(item))}>
                          <Printer className="h-4 w-4 mr-2" /> Imprimir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(items ?? []).length === 0 && (
                <p className="text-center text-muted-foreground py-8">Esta caja no tiene artículos desglosados.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminHubCentralPage;
