import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Scale, Edit2, Calculator, Layers, Globe, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useRateTemplates,
  useSaveRateTemplate,
  useDeleteRateTemplate,
  usePickupEarnings,
  usePreviewCommission,
  type RateTemplate,
  type CommissionPreview,
} from "@/hooks/usePickupRates";

interface TierDraft { min_kg: string; max_kg: string; rate: string }

const EMPTY_TIERS: TierDraft[] = [
  { min_kg: "0", max_kg: "10", rate: "1.00" },
  { min_kg: "10.01", max_kg: "25", rate: "2.00" },
  { min_kg: "25.01", max_kg: "40", rate: "3.50" },
];

const scopeMeta: Record<string, { label: string; icon: typeof Globe }> = {
  global: { label: "Global", icon: Globe },
  segment: { label: "Segmento", icon: Layers },
  individual: { label: "Individual", icon: User },
};

const AdminPickupRatesPage = () => {
  const { data: templates, isLoading } = useRateTemplates();
  const saveTemplate = useSaveRateTemplate();
  const deleteTemplate = useDeleteRateTemplate();
  const { data: earnings } = usePickupEarnings();
  const previewCommission = usePreviewCommission();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateTemplate | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"global" | "segment" | "individual">("global");
  const [segmentKey, setSegmentKey] = useState("");
  const [pickupPointId, setPickupPointId] = useState("");
  const [extraBlockKg, setExtraBlockKg] = useState("5");
  const [extraBlockRate, setExtraBlockRate] = useState("0.50");
  const [currency, setCurrency] = useState("USD");
  const [isActive, setIsActive] = useState(true);
  const [tiers, setTiers] = useState<TierDraft[]>(EMPTY_TIERS);

  const [simPoint, setSimPoint] = useState("");
  const [simWeight, setSimWeight] = useState("12");
  const [simResult, setSimResult] = useState<CommissionPreview | null>(null);

  const { data: pickupPoints } = useQuery({
    queryKey: ["pickup-points-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("id, name, point_code, segment_key")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const list = templates ?? [];
    return {
      global: list.filter((t) => t.scope === "global"),
      segment: list.filter((t) => t.scope === "segment"),
      individual: list.filter((t) => t.scope === "individual"),
    };
  }, [templates]);

  const openNew = (initialScope: "global" | "segment" | "individual") => {
    setEditing(null);
    setName("");
    setScope(initialScope);
    setSegmentKey("");
    setPickupPointId("");
    setExtraBlockKg("5");
    setExtraBlockRate("0.50");
    setCurrency("USD");
    setIsActive(true);
    setTiers(EMPTY_TIERS);
    setDialogOpen(true);
  };

  const openEdit = (template: RateTemplate) => {
    setEditing(template);
    setName(template.name);
    setScope(template.scope);
    setSegmentKey(template.segment_key ?? "");
    setPickupPointId(template.pickup_point_id ?? "");
    setExtraBlockKg(String(template.extra_block_kg));
    setExtraBlockRate(String(template.extra_block_rate));
    setCurrency(template.currency);
    setIsActive(template.is_active);
    setTiers(
      template.tiers.length
        ? template.tiers.map((tier) => ({ min_kg: String(tier.min_kg), max_kg: String(tier.max_kg), rate: String(tier.rate) }))
        : EMPTY_TIERS,
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    await saveTemplate.mutateAsync({
      id: editing?.id,
      name: name.trim() || "Matriz sin nombre",
      scope,
      segment_key: segmentKey,
      pickup_point_id: pickupPointId,
      extra_block_kg: Number(extraBlockKg) || 5,
      extra_block_rate: Number(extraBlockRate) || 0,
      currency,
      is_active: isActive,
      tiers: tiers
        .filter((tier) => tier.max_kg !== "")
        .map((tier) => ({ min_kg: Number(tier.min_kg) || 0, max_kg: Number(tier.max_kg) || 0, rate: Number(tier.rate) || 0 })),
    });
    setDialogOpen(false);
  };

  const runSimulation = async () => {
    if (!simPoint) return;
    const result = await previewCommission.mutateAsync({ pickupPointId: simPoint, weightKg: Number(simWeight) || 0 });
    setSimResult(result);
  };

  const renderTemplateCard = (template: RateTemplate) => {
    const Icon = scopeMeta[template.scope].icon;
    const point = pickupPoints?.find((p) => p.id === template.pickup_point_id);
    return (
      <Card key={template.id} className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="truncate">{template.name}</span>
              </CardTitle>
              <CardDescription className="mt-1">
                {template.scope === "segment" && `Segmento: ${template.segment_key ?? "-"}`}
                {template.scope === "individual" && `Punto: ${point?.name ?? "-"}`}
                {template.scope === "global" && "Aplica a todos los puntos de entrega"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={template.is_active ? "default" : "secondary"}>{template.is_active ? "Activa" : "Inactiva"}</Badge>
              <Button size="icon" variant="ghost" onClick={() => openEdit(template)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteTemplate.mutate(template.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {template.tiers.map((tier) => (
              <div key={tier.id} className="flex justify-between border-b border-border/50 py-1">
                <span className="text-muted-foreground">
                  {tier.min_kg} – {tier.max_kg} kg
                </span>
                <span className="font-medium">
                  {template.currency} {Number(tier.rate).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-xs text-muted-foreground">
              <span>Bloque extra de {template.extra_block_kg} kg</span>
              <span>
                + {template.currency} {Number(template.extra_block_rate).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="Tarifas por peso">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Tarifas por peso — Puntos de entrega
            </h1>
            <p className="text-muted-foreground text-sm">
              Matriz global, plantillas por segmento y tarifas personalizadas por punto.
            </p>
          </div>
          <Button onClick={() => openNew("global")}>
            <Plus className="h-4 w-4 mr-2" /> Nueva matriz
          </Button>
        </div>

        <Tabs defaultValue="global">
          <TabsList>
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="segment">Por segmento</TabsTrigger>
            <TabsTrigger value="individual">Personalizadas</TabsTrigger>
            <TabsTrigger value="earnings">Comisiones</TabsTrigger>
            <TabsTrigger value="simulator">Simulador</TabsTrigger>
          </TabsList>

          {(["global", "segment", "individual"] as const).map((key) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => openNew(key)}>
                  <Plus className="h-4 w-4 mr-2" /> Agregar {scopeMeta[key].label.toLowerCase()}
                </Button>
              </div>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : grouped[key].length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">Sin matrices en este nivel.</CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{grouped[key].map(renderTemplateCard)}</div>
              )}
            </TabsContent>
          ))}

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comisiones registradas</CardTitle>
                <CardDescription>Calculadas automáticamente cuando el pedido queda listo para retiro.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Punto</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Bloques extra</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(earnings ?? []).map((row) => {
                      const point = row.pickup_points as { name?: string } | null;
                      return (
                        <TableRow key={row.id as string}>
                          <TableCell>{point?.name ?? "-"}</TableCell>
                          <TableCell>{Number(row.total_weight_kg).toFixed(2)} kg</TableCell>
                          <TableCell>
                            {row.currency} {Number(row.base_rate).toFixed(2)}
                          </TableCell>
                          <TableCell>{row.extra_blocks}</TableCell>
                          <TableCell className="font-semibold">
                            {row.currency} {Number(row.commission_amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{row.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(earnings ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Aún no hay comisiones registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulator">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Simulador de comisión
                </CardTitle>
                <CardDescription>Comprueba qué matriz se aplica y cuánto cobra el punto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Punto de entrega</Label>
                  <Select value={simPoint} onValueChange={setSimPoint}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un punto" />
                    </SelectTrigger>
                    <SelectContent>
                      {(pickupPoints ?? []).map((point) => (
                        <SelectItem key={point.id} value={point.id}>
                          {point.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Peso total (kg)</Label>
                  <Input type="number" step="0.01" value={simWeight} onChange={(e) => setSimWeight(e.target.value)} />
                </div>
                <Button onClick={runSimulation} disabled={!simPoint || previewCommission.isPending}>
                  Calcular
                </Button>
                {simResult && (
                  <div className="rounded-lg border border-border p-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Matriz aplicada</span>
                      <span>{simResult.template_name ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tarifa base</span>
                      <span>
                        {simResult.currency} {Number(simResult.base_rate).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bloques extra</span>
                      <span>
                        {simResult.extra_blocks} ({simResult.currency} {Number(simResult.extra_amount).toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t border-border">
                      <span>Comisión total</span>
                      <span>
                        {simResult.currency} {Number(simResult.commission).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar matriz de tarifas" : "Nueva matriz de tarifas"}</DialogTitle>
            <DialogDescription>Define los tramos de peso y la tarifa por bloque extra.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Matriz Norte" />
              </div>
              <div className="space-y-2">
                <Label>Nivel</Label>
                <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="segment">Por segmento</SelectItem>
                    <SelectItem value="individual">Individual (por punto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scope === "segment" && (
              <div className="space-y-2">
                <Label>Clave del segmento</Label>
                <Input value={segmentKey} onChange={(e) => setSegmentKey(e.target.value)} placeholder="Ej. norte, urbano, premium" />
                <p className="text-xs text-muted-foreground">
                  Debe coincidir con el segmento asignado en la ficha del punto de entrega.
                </p>
              </div>
            )}

            {scope === "individual" && (
              <div className="space-y-2">
                <Label>Punto de entrega</Label>
                <Select value={pickupPointId} onValueChange={setPickupPointId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un punto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pickupPoints ?? []).map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tramos de peso</Label>
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.min_kg}
                    onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, min_kg: e.target.value } : t)))}
                    placeholder="Desde kg"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.max_kg}
                    onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, max_kg: e.target.value } : t)))}
                    placeholder="Hasta kg"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.rate}
                    onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, rate: e.target.value } : t)))}
                    placeholder="Tarifa"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTiers([...tiers, { min_kg: "", max_kg: "", rate: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar tramo
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Bloque extra (kg)</Label>
                <Input type="number" step="0.1" value={extraBlockKg} onChange={(e) => setExtraBlockKg(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tarifa por bloque extra</Label>
                <Input type="number" step="0.01" value={extraBlockRate} onChange={(e) => setExtraBlockRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Matriz activa</Label>
                <p className="text-xs text-muted-foreground">Solo las matrices activas se usan en el cálculo.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveTemplate.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPickupRatesPage;
