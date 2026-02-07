import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCountriesRoutes, TransitHub, DestinationCountry, ShippingRoute, RouteLogisticsCost } from "@/hooks/useCountriesRoutes";
import { useShippingOrigins, ShippingOrigin } from "@/hooks/useShippingOrigins";
import { Plus, Edit, Globe, Plane, DollarSign, Loader2, ArrowRight, Building2, MapPin, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCountriesRoutesPage() {
  const {
    transitHubs,
    countries,
    routes,
    logisticsCosts,
    isLoading,
    createHub,
    updateHub,
    createCountry,
    updateCountry,
    createRoute,
    updateRoute,
    createCost,
    updateCost,
  } = useCountriesRoutes();

  const {
    origins,
    isLoading: loadingOrigins,
    createOrigin,
    updateOrigin,
    deleteOrigin,
  } = useShippingOrigins();

  // Dialog states
  const [showHubDialog, setShowHubDialog] = useState(false);
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showOriginDialog, setShowOriginDialog] = useState(false);

  // Editing states
  const [editingHub, setEditingHub] = useState<TransitHub | null>(null);
  const [editingCountry, setEditingCountry] = useState<DestinationCountry | null>(null);
  const [editingRoute, setEditingRoute] = useState<ShippingRoute | null>(null);
  const [editingCost, setEditingCost] = useState<RouteLogisticsCost | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<ShippingOrigin | null>(null);

  // Form states
  const [hubForm, setHubForm] = useState({ name: "", code: "", description: "", is_active: true });
  const [countryForm, setCountryForm] = useState({ name: "", code: "", currency: "USD", is_active: true });
  const [routeForm, setRouteForm] = useState({ destination_country_id: "", transit_hub_id: "", is_direct: false, is_active: true });
  const [originForm, setOriginForm] = useState({ name: "", code: "", description: "", is_active: true });
  const [costForm, setCostForm] = useState({ 
    shipping_route_id: "", 
    segment: "china_to_transit", 
    cost_per_kg: 0,
    cost_per_cbm: 0,
    min_cost: 0,
    estimated_days_min: 7,
    estimated_days_max: 21,
    notes: "",
    is_active: true 
  });

  // ========== ORIGIN HANDLERS ==========
  const openOriginDialog = (origin?: ShippingOrigin) => {
    if (origin) {
      setEditingOrigin(origin);
      setOriginForm({ name: origin.name, code: origin.code, description: origin.description || "", is_active: origin.is_active });
    } else {
      setEditingOrigin(null);
      setOriginForm({ name: "", code: "", description: "", is_active: true });
    }
    setShowOriginDialog(true);
  };

  const handleOriginSubmit = () => {
    const data = { ...originForm, description: originForm.description || null };
    if (editingOrigin) {
      updateOrigin.mutate({ id: editingOrigin.id, ...data }, { onSuccess: () => setShowOriginDialog(false) });
    } else {
      createOrigin.mutate(data, { onSuccess: () => setShowOriginDialog(false) });
    }
  };

  const handleDeleteOrigin = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este país de origen?")) {
      deleteOrigin.mutate(id);
    }
  };

  // ========== HUB HANDLERS ==========
  const openHubDialog = (hub?: TransitHub) => {
    if (hub) {
      setEditingHub(hub);
      setHubForm({ name: hub.name, code: hub.code, description: hub.description || "", is_active: hub.is_active });
    } else {
      setEditingHub(null);
      setHubForm({ name: "", code: "", description: "", is_active: true });
    }
    setShowHubDialog(true);
  };

  const handleHubSubmit = () => {
    const data = { ...hubForm, description: hubForm.description || null };
    if (editingHub) {
      updateHub.mutate({ id: editingHub.id, ...data }, { onSuccess: () => setShowHubDialog(false) });
    } else {
      createHub.mutate(data, { onSuccess: () => setShowHubDialog(false) });
    }
  };

  // ========== COUNTRY HANDLERS ==========
  const openCountryDialog = (country?: DestinationCountry) => {
    if (country) {
      setEditingCountry(country);
      setCountryForm({ name: country.name, code: country.code, currency: country.currency, is_active: country.is_active });
    } else {
      setEditingCountry(null);
      setCountryForm({ name: "", code: "", currency: "USD", is_active: true });
    }
    setShowCountryDialog(true);
  };

  const handleCountrySubmit = () => {
    if (editingCountry) {
      updateCountry.mutate({ id: editingCountry.id, ...countryForm }, { onSuccess: () => setShowCountryDialog(false) });
    } else {
      createCountry.mutate(countryForm, { onSuccess: () => setShowCountryDialog(false) });
    }
  };

  // ========== ROUTE HANDLERS ==========
  const openRouteDialog = (route?: ShippingRoute) => {
    if (route) {
      setEditingRoute(route);
      setRouteForm({
        destination_country_id: route.destination_country_id,
        transit_hub_id: route.transit_hub_id || "",
        is_direct: route.is_direct,
        is_active: route.is_active,
      });
    } else {
      setEditingRoute(null);
      setRouteForm({ destination_country_id: "", transit_hub_id: "", is_direct: false, is_active: true });
    }
    setShowRouteDialog(true);
  };

  const handleRouteSubmit = () => {
    const routeData = {
      destination_country_id: routeForm.destination_country_id,
      transit_hub_id: routeForm.is_direct ? null : routeForm.transit_hub_id || null,
      is_direct: routeForm.is_direct,
      is_active: routeForm.is_active,
    };
    
    if (editingRoute) {
      updateRoute.mutate({ id: editingRoute.id, ...routeData }, { onSuccess: () => setShowRouteDialog(false) });
    } else {
      createRoute.mutate(routeData, { onSuccess: () => setShowRouteDialog(false) });
    }
  };

  // ========== COST HANDLERS ==========
  const openCostDialog = (cost?: RouteLogisticsCost, routeId?: string) => {
    if (cost) {
      setEditingCost(cost);
      setCostForm({
        shipping_route_id: cost.shipping_route_id,
        segment: cost.segment,
        cost_per_kg: cost.cost_per_kg,
        cost_per_cbm: cost.cost_per_cbm || 0,
        min_cost: cost.min_cost || 0,
        estimated_days_min: cost.estimated_days_min,
        estimated_days_max: cost.estimated_days_max,
        notes: cost.notes || "",
        is_active: cost.is_active,
      });
    } else {
      setEditingCost(null);
      setCostForm({
        shipping_route_id: routeId || "",
        segment: "china_to_transit",
        cost_per_kg: 0,
        cost_per_cbm: 0,
        min_cost: 0,
        estimated_days_min: 7,
        estimated_days_max: 21,
        notes: "",
        is_active: true,
      });
    }
    setShowCostDialog(true);
  };

  const handleCostSubmit = () => {
    const costData = {
      ...costForm,
      notes: costForm.notes || null,
    };
    if (editingCost) {
      updateCost.mutate({ id: editingCost.id, ...costData }, { onSuccess: () => setShowCostDialog(false) });
    } else {
      createCost.mutate(costData, { onSuccess: () => setShowCostDialog(false) });
    }
  };

  // Get costs for a specific route
  const getRouteCosts = (routeId: string) => logisticsCosts?.filter((c) => c.shipping_route_id === routeId) || [];

  const segmentLabels: Record<string, string> = {
    china_to_transit: "China → Tránsito",
    transit_to_destination: "Tránsito → Destino",
    china_to_destination: "China → Destino (Directo)",
  };

  if (isLoading) {
    return (
      <AdminLayout title="Países y Rutas" subtitle="Cargando configuración...">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Países y Rutas de Tránsito" subtitle="Configura países destino, hubs de tránsito y costos logísticos">
      <Tabs defaultValue="origins" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="origins" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Orígenes</span>
          </TabsTrigger>
          <TabsTrigger value="countries" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Destinos</span>
          </TabsTrigger>
          <TabsTrigger value="hubs" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Hubs</span>
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            <span className="hidden sm:inline">Rutas</span>
          </TabsTrigger>
        </TabsList>

        {/* ========== ORIGINS TAB ========== */}
        <TabsContent value="origins">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Orígenes</CardTitle>
                <CardDescription>Países de origen para compra de productos (fuentes de abastecimiento)</CardDescription>
              </div>
              <Button onClick={() => openOriginDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar Origen
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {origins?.map((origin) => (
                    <TableRow key={origin.id}>
                      <TableCell className="font-mono font-bold">{origin.code}</TableCell>
                      <TableCell>{origin.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{origin.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={origin.is_active ? "default" : "secondary"}>
                          {origin.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openOriginDialog(origin)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteOrigin(origin.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!origins?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay países de origen configurados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== COUNTRIES TAB ========== */}
        <TabsContent value="countries">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Países Destino</CardTitle>
                <CardDescription>Configura los países habilitados para envío</CardDescription>
              </div>
              <Button onClick={() => openCountryDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar País
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries?.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell className="font-mono font-bold">{country.code}</TableCell>
                      <TableCell>{country.name}</TableCell>
                      <TableCell>{country.currency}</TableCell>
                      <TableCell>
                        <Badge variant={country.is_active ? "default" : "secondary"}>
                          {country.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openCountryDialog(country)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!countries?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay países configurados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== HUBS TAB ========== */}
        <TabsContent value="hubs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Hubs de Tránsito</CardTitle>
                <CardDescription>Países intermedios para consolidación de envíos</CardDescription>
              </div>
              <Button onClick={() => openHubDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar Hub
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transitHubs?.map((hub) => (
                    <TableRow key={hub.id}>
                      <TableCell className="font-mono font-bold">{hub.code}</TableCell>
                      <TableCell>{hub.name}</TableCell>
                      <TableCell className="text-muted-foreground">{hub.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={hub.is_active ? "default" : "secondary"}>
                          {hub.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openHubDialog(hub)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!transitHubs?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay hubs configurados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ROUTES TAB ========== */}
        <TabsContent value="routes">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Rutas de Envío</h3>
                <p className="text-sm text-muted-foreground">Define las rutas y costos logísticos por tramo</p>
              </div>
              <Button onClick={() => openRouteDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Ruta
              </Button>
            </div>

            {routes?.map((route) => (
              <Card key={route.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-primary">China</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        {!route.is_direct && route.transit_hub && (
                          <>
                            <Badge variant="outline">{route.transit_hub.name}</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </>
                        )}
                        <span className="text-primary font-bold">{route.destination_country?.name}</span>
                      </div>
                      <Badge variant={route.is_direct ? "secondary" : "default"}>
                        {route.is_direct ? "Directo" : "Con Tránsito"}
                      </Badge>
                      <Badge variant={route.is_active ? "default" : "destructive"}>
                        {route.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openCostDialog(undefined, route.id)}>
                        <DollarSign className="h-4 w-4 mr-1" />
                        Agregar Costo
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openRouteDialog(route)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-sm font-medium mb-2 text-muted-foreground">Costos por Tramo:</div>
                  {getRouteCosts(route.id).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tramo</TableHead>
                          <TableHead>Costo/KG</TableHead>
                          <TableHead>Días Est.</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getRouteCosts(route.id).map((cost) => (
                          <TableRow key={cost.id}>
                            <TableCell className="font-medium">{segmentLabels[cost.segment] || cost.segment}</TableCell>
                            <TableCell>${cost.cost_per_kg.toFixed(2)}</TableCell>
                            <TableCell>{cost.estimated_days_min}-{cost.estimated_days_max} días</TableCell>
                            <TableCell>
                              <Badge variant={cost.is_active ? "default" : "secondary"}>
                                {cost.is_active ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openCostDialog(cost)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sin costos configurados</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {!routes?.length && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay rutas configuradas. Crea una para empezar.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== HUB DIALOG ========== */}
      <Dialog open={showHubDialog} onOpenChange={setShowHubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHub ? "Editar Hub" : "Nuevo Hub de Tránsito"}</DialogTitle>
            <DialogDescription>Define un país de tránsito para consolidación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hub-code">Código</Label>
                <Input id="hub-code" placeholder="PA" value={hubForm.code} onChange={(e) => setHubForm({ ...hubForm, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-name">Nombre</Label>
                <Input id="hub-name" placeholder="Panamá Hub" value={hubForm.name} onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-description">Descripción</Label>
              <Textarea id="hub-description" placeholder="Descripción del hub..." value={hubForm.description} onChange={(e) => setHubForm({ ...hubForm, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hubForm.is_active} onCheckedChange={(checked) => setHubForm({ ...hubForm, is_active: checked })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHubDialog(false)}>Cancelar</Button>
            <Button onClick={handleHubSubmit} disabled={createHub.isPending || updateHub.isPending}>
              {(createHub.isPending || updateHub.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== COUNTRY DIALOG ========== */}
      <Dialog open={showCountryDialog} onOpenChange={setShowCountryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCountry ? "Editar País" : "Nuevo País Destino"}</DialogTitle>
            <DialogDescription>Habilita un país para recibir envíos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country-code">Código ISO</Label>
                <Input id="country-code" placeholder="HT" value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country-name">Nombre</Label>
                <Input id="country-name" placeholder="Haiti" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country-currency">Moneda</Label>
              <Select value={countryForm.currency} onValueChange={(v) => setCountryForm({ ...countryForm, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                  <SelectItem value="HTG">HTG - Gourde Haitiano</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="DOP">DOP - Peso Dominicano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={countryForm.is_active} onCheckedChange={(checked) => setCountryForm({ ...countryForm, is_active: checked })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountryDialog(false)}>Cancelar</Button>
            <Button onClick={handleCountrySubmit} disabled={createCountry.isPending || updateCountry.isPending}>
              {(createCountry.isPending || updateCountry.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ROUTE DIALOG ========== */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoute ? "Editar Ruta" : "Nueva Ruta de Envío"}</DialogTitle>
            <DialogDescription>Define el trayecto desde China hasta el destino</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>País Destino</Label>
              <Select value={routeForm.destination_country_id} onValueChange={(v) => setRouteForm({ ...routeForm, destination_country_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un país" />
                </SelectTrigger>
                <SelectContent>
                  {countries?.filter((c) => c.is_active).map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={routeForm.is_direct} onCheckedChange={(checked) => setRouteForm({ ...routeForm, is_direct: checked })} />
              <Label>Envío Directo (Sin Tránsito)</Label>
            </div>
            {!routeForm.is_direct && (
              <div className="space-y-2">
                <Label>Hub de Tránsito</Label>
                <Select value={routeForm.transit_hub_id} onValueChange={(v) => setRouteForm({ ...routeForm, transit_hub_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {transitHubs?.filter((h) => h.is_active).map((hub) => (
                      <SelectItem key={hub.id} value={hub.id}>
                        {hub.name} ({hub.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={routeForm.is_active} onCheckedChange={(checked) => setRouteForm({ ...routeForm, is_active: checked })} />
              <Label>Ruta Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteDialog(false)}>Cancelar</Button>
            <Button onClick={handleRouteSubmit} disabled={createRoute.isPending || updateRoute.isPending}>
              {(createRoute.isPending || updateRoute.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== COST DIALOG ========== */}
      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCost ? "Editar Costo" : "Nuevo Costo Logístico"}</DialogTitle>
            <DialogDescription>Define el costo por tramo para esta ruta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tramo</Label>
              <Select value={costForm.segment} onValueChange={(v) => setCostForm({ ...costForm, segment: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="china_to_transit">China → Tránsito</SelectItem>
                  <SelectItem value="transit_to_destination">Tránsito → Destino</SelectItem>
                  <SelectItem value="china_to_destination">China → Destino (Directo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Costo/KG ($)</Label>
                <Input type="number" step="0.01" value={costForm.cost_per_kg} onChange={(e) => setCostForm({ ...costForm, cost_per_kg: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Días Mínimos</Label>
                <Input type="number" value={costForm.estimated_days_min} onChange={(e) => setCostForm({ ...costForm, estimated_days_min: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Días Máximos</Label>
                <Input type="number" value={costForm.estimated_days_max} onChange={(e) => setCostForm({ ...costForm, estimated_days_max: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea placeholder="Notas adicionales..." value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={costForm.is_active} onCheckedChange={(checked) => setCostForm({ ...costForm, is_active: checked })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostDialog(false)}>Cancelar</Button>
            <Button onClick={handleCostSubmit} disabled={createCost.isPending || updateCost.isPending}>
              {(createCost.isPending || updateCost.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ORIGIN DIALOG ========== */}
      <Dialog open={showOriginDialog} onOpenChange={setShowOriginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrigin ? "Editar País de Origen" : "Nuevo País de Origen"}</DialogTitle>
            <DialogDescription>Define un país desde donde se compran productos (fuente de abastecimiento)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input placeholder="Ej: China" value={originForm.name} onChange={(e) => setOriginForm({ ...originForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Código ISO</Label>
                <Input placeholder="Ej: CN" maxLength={3} value={originForm.code} onChange={(e) => setOriginForm({ ...originForm, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea placeholder="Descripción del país de origen..." value={originForm.description} onChange={(e) => setOriginForm({ ...originForm, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={originForm.is_active} onCheckedChange={(checked) => setOriginForm({ ...originForm, is_active: checked })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOriginDialog(false)}>Cancelar</Button>
            <Button onClick={handleOriginSubmit} disabled={createOrigin.isPending || updateOrigin.isPending}>
              {(createOrigin.isPending || updateOrigin.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
