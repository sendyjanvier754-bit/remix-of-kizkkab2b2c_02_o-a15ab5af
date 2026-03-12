import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Ship, Plane, Package, Zap, Edit, Trash2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ShippingRoute {
  id: string;
  route_name: string;
  origin_country: string;
  destination_country: string;
  is_active: boolean;
  created_at: string;
}

interface ShippingTier {
  id: string;
  route_id: string;
  tier_type: string;
  tier_name: string;
  custom_tier_name?: string;
  tier_origin_country?: string;
  tier_destination_country?: string;
  transport_type: 'maritimo' | 'aereo' | 'terrestre';
  tramo_a_cost_per_kg: number;
  tramo_a_eta_min: number;
  tramo_a_eta_max: number;
  tramo_b_cost_per_lb: number;
  tramo_b_eta_min: number;
  tramo_b_eta_max: number;
  allows_oversize: boolean;
  allows_sensitive: boolean;
  is_active: boolean;
  priority_order: number;
}

export default function AdminLogisticaRutas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'routes' | 'tiers'>('routes');
  const [openRouteDialog, setOpenRouteDialog] = useState(false);
  const [openTierDialog, setOpenTierDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ShippingRoute | null>(null);
  const [editingTier, setEditingTier] = useState<ShippingTier | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // Fetch shipping routes
  const { data: routes, isLoading: loadingRoutes } = useQuery({
    queryKey: ['shipping_routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_routes')
        .select('*')
        .order('created_at', { ascending: false});
      if (error) throw error;
      return data as ShippingRoute[];
    },
  });

  // Fetch ALL shipping tiers (not filtered by route)
  const { data: allTiers, isLoading: loadingTiers } = useQuery({
    queryKey: ['shipping_tiers_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_tiers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShippingTier[];
    },
  });

  // Create/Update Route
  const saveRouteMutation = useMutation({
    mutationFn: async (route: Partial<ShippingRoute>) => {
      if (route.id) {
        const { data, error } = await supabase
          .from('shipping_routes')
          .update(route)
          .eq('id', route.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('shipping_routes')
          .insert([route])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping_routes'] });
      toast({ title: 'Ruta guardada exitosamente' });
      setOpenRouteDialog(false);
      setEditingRoute(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error al guardar ruta', description: error.message, variant: 'destructive' });
    },
  });

  // Create/Update Tier
  const saveTierMutation = useMutation({
    mutationFn: async (tier: Partial<ShippingTier>) => {
      if (tier.id) {
        const { data, error } = await supabase
          .from('shipping_tiers')
          .update(tier)
          .eq('id', tier.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Tier now includes route_id in the form
        const { data, error } = await supabase
          .from('shipping_tiers')
          .insert([tier])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping_routes'] });
      queryClient.invalidateQueries({ queryKey: ['shipping_tiers_all'] });
      if (selectedRouteId) {
        queryClient.invalidateQueries({ queryKey: ['shipping_tiers', selectedRouteId] });
      }
      toast({ title: 'Configuración de envío guardada' });
      setOpenTierDialog(false);
      setEditingTier(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error al guardar configuración', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <AdminLayout title="Configuración de Logística Global" subtitle="Rutas y Tipos de Envío">
      <div className="space-y-6">
        {/* Tabs */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setActiveTab('routes')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'routes'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Rutas de Envío
                </div>
              </button>
              <button
                onClick={() => setActiveTab('tiers')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'tiers'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Tipos de Envío
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Routes Tab */}
        {activeTab === 'routes' && (
          <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Rutas de Envío
            </CardTitle>
            <Dialog open={openRouteDialog} onOpenChange={setOpenRouteDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingRoute(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Ruta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRoute ? 'Editar' : 'Nueva'} Ruta de Envío</DialogTitle>
                </DialogHeader>
                <RouteForm
                  route={editingRoute}
                  onSave={(data) => saveRouteMutation.mutate(data)}
                  isSaving={saveRouteMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingRoutes ? (
              <p>Cargando rutas...</p>
            ) : !routes || routes.length === 0 ? (
              <p className="text-muted-foreground">No hay rutas configuradas</p>
            ) : (
              <div className="space-y-2">
                {routes.map((route) => {
                  // Contar tiers por tipo para esta ruta
                  const routeTiers = allTiers?.filter(t => t.route_id === route.id) || [];
                  const standardTiers = routeTiers.filter(t => t.tier_type === 'standard');
                  const expressTiers = routeTiers.filter(t => t.tier_type === 'express');
                  const hasStandard = standardTiers.length > 0;
                  const hasExpress = expressTiers.length > 0;
                  const hasTiers = hasStandard || hasExpress;
                  const isReadyToUse = hasTiers && route.is_active;
                  
                  return (
                    <div
                      key={route.id}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRouteId === route.id 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : hasTiers 
                            ? 'border-green-200 hover:border-primary/50 bg-green-50/50 dark:bg-green-950/20' 
                            : 'border-orange-200 hover:border-primary/50 bg-orange-50/50 dark:bg-orange-950/20'
                      }`}
                      onClick={() => setSelectedRouteId(route.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{route.route_name}</h4>
                          {isReadyToUse ? (
                            <Badge className="bg-green-600 hover:bg-green-700">
                              ✓ Lista para usar
                            </Badge>
                          ) : hasTiers && !route.is_active ? (
                            <Badge variant="secondary">
                              Inactiva
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-600 hover:bg-orange-700">
                              ⚠ Necesita configuración
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {route.origin_country} → {route.destination_country}
                        </p>
                        <div className="flex items-center gap-2">
                          {hasStandard && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 border-blue-300 text-blue-700">
                              <Package className="h-3 w-3" />
                              Standard ({standardTiers.length})
                            </Badge>
                          )}
                          {hasExpress && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1 bg-amber-50 border-amber-300 text-amber-700">
                              <Zap className="h-3 w-3" />
                              Express ({expressTiers.length})
                            </Badge>
                          )}
                          {!hasTiers && (
                            <Badge variant="outline" className="text-xs bg-gray-50 border-gray-300 text-gray-600">
                              Sin tipos de envío configurados
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoute(route);
                            setOpenRouteDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Tiers Tab */}
        {activeTab === 'tiers' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Todos los Tipos de Envío
              </CardTitle>
              <Dialog open={openTierDialog} onOpenChange={setOpenTierDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingTier(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Tipo de Envío
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTier ? 'Editar' : 'Nuevo'} Tipo de Envío</DialogTitle>
                  </DialogHeader>
                  <TierForm
                    tier={editingTier}
                    routes={routes || []}
                    allTiers={allTiers || []}
                    onSave={(data) => saveTierMutation.mutate(data)}
                    isSaving={saveTierMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingTiers ? (
                <p>Cargando tipos de envío...</p>
              ) : !allTiers || allTiers.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">No hay tipos de envío configurados</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crea tu primer tipo de envío (Standard o Express) para comenzar
                  </p>
                  <Button onClick={() => setOpenTierDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Tipo de Envío
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {allTiers.map((tier) => {
                    const route = routes?.find(r => r.id === tier.route_id);
                    return (
                      <div key={tier.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {tier.tier_type === 'express' ? (
                              <div className="p-2 rounded-full bg-amber-100">
                                <Zap className="h-4 w-4 text-amber-600" />
                              </div>
                            ) : (
                              <div className="p-2 rounded-full bg-blue-100">
                                <Package className="h-4 w-4 text-blue-600" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium">{tier.tier_name}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant={tier.tier_type === 'express' ? 'default' : 'secondary'}>
                                {tier.tier_type === 'express' ? 'Express'
                                  : tier.tier_type === 'economy' ? 'Economy'
                                  : tier.tier_type === 'fast' ? 'Fast'
                                  : tier.tier_type === 'priority' ? 'Priority'
                                  : tier.tier_type === 'overnight' ? 'Overnight'
                                  : 'Standard'}
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  {tier.transport_type === 'aereo' ? (
                                    <><Plane className="h-3 w-3" /> Aéreo</>
                                  ) : (
                                    <><Ship className="h-3 w-3" /> Marítimo</>
                                  )}
                                </Badge>
                                {route && (
                                  <Badge variant="outline" className="text-xs">
                                    <Ship className="h-3 w-3 mr-1" />
                                    {route.route_name}
                                  </Badge>
                                )}
                                {!tier.is_active && (
                                  <Badge variant="destructive" className="text-xs">Inactivo</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTier(tier);
                                setOpenTierDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded">
                          <div>
                            <p className="text-muted-foreground font-medium mb-1">Tramo A (China→USA)</p>
                            <p className="font-medium">${tier.tramo_a_cost_per_kg}/kg</p>
                            <p className="text-xs text-muted-foreground">{tier.tramo_a_eta_min}-{tier.tramo_a_eta_max} días</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium mb-1">Tramo B (USA→Destino)</p>
                            <p className="font-medium">${tier.tramo_b_cost_per_lb}/lb</p>
                            <p className="text-xs text-muted-foreground">{tier.tramo_b_eta_min}-{tier.tramo_b_eta_max} días</p>
                          </div>
                        </div>

                        {(tier.allows_oversize || tier.allows_sensitive) && (
                          <div className="flex flex-wrap gap-2">
                            {tier.allows_oversize && (
                              <Badge variant="secondary" className="text-xs">✓ Permite Oversize</Badge>
                            )}
                            {tier.allows_sensitive && (
                              <Badge variant="secondary" className="text-xs">✓ Permite Sensibles</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

// Route Form Component
function RouteForm({
  route,
  onSave,
  isSaving,
}: {
  route: ShippingRoute | null;
  onSave: (data: Partial<ShippingRoute>) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    route_name: route?.route_name || '',
    origin_country: route?.origin_country || 'China',
    destination_country: route?.destination_country || '',
    is_active: route?.is_active ?? true,
  });

  return (
    <div className="space-y-4">
      {/* Advertencia sobre restricción */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ <strong>Nota:</strong> Cada ruta solo puede tener un tipo de envío (Standard O Express, no ambos).
        </p>
      </div>

      <div>
        <Label>Nombre de la Ruta *</Label>
        <Input
          value={formData.route_name}
          onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
          placeholder="Ej: Envío Express a Haití, Marítimo a RD, etc."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Dale un nombre descriptivo que identifique esta ruta
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>País de Origen *</Label>
          <Input
            value={formData.origin_country}
            onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
            placeholder="China"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ej: China, USA, etc.
          </p>
        </div>
        <div>
          <Label>País de Destino *</Label>
          <Input
            value={formData.destination_country}
            onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
            placeholder="Haití"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ej: Haití, República Dominicana, Brasil, etc.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label>Ruta Activa</Label>
      </div>

      <Button
        onClick={() => onSave({ ...route, ...formData })}
        disabled={isSaving || !formData.route_name}
        className="w-full"
      >
        {isSaving ? 'Guardando...' : 'Guardar Ruta'}
      </Button>
    </div>
  );
}

// Tier Form Component
function TierForm({
  tier,
  routes,
  allTiers,
  onSave,
  isSaving,
}: {
  tier: ShippingTier | null;
  routes: ShippingRoute[];
  allTiers: ShippingTier[];
  onSave: (data: Partial<ShippingTier>) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    route_id: tier?.route_id || '',
    tier_type: tier?.tier_type || 'standard',
    tier_name: tier?.tier_name || '',
    custom_tier_name: tier?.custom_tier_name || '',
    tier_origin_country: tier?.tier_origin_country || 'China',
    tier_destination_country: tier?.tier_destination_country || '',
    transport_type: tier?.transport_type || ('aereo' as 'maritimo' | 'aereo' | 'terrestre'),
    tramo_a_cost_per_kg: tier?.tramo_a_cost_per_kg || 8.0,
    tramo_a_eta_min: tier?.tramo_a_eta_min || 15,
    tramo_a_eta_max: tier?.tramo_a_eta_max || 25,
    tramo_b_cost_per_lb: tier?.tramo_b_cost_per_lb || 5.0,
    tramo_b_eta_min: tier?.tramo_b_eta_min || 3,
    tramo_b_eta_max: tier?.tramo_b_eta_max || 7,
    allows_oversize: tier?.allows_oversize ?? true,
    allows_sensitive: tier?.allows_sensitive ?? true,
    is_active: tier?.is_active ?? true,
    priority_order: tier?.priority_order || 1,
  });

  // Verificar si la ruta seleccionada ya tiene un tier asignado
  const routeHasTier = formData.route_id && allTiers.some(
    t => t.route_id === formData.route_id && t.id !== tier?.id
  );
  const existingTier = allTiers.find(
    t => t.route_id === formData.route_id && t.id !== tier?.id
  );

  // Filtrar rutas: si estamos creando nuevo, solo mostrar rutas sin tier
  const availableRoutes = tier 
    ? routes // Si estamos editando, mostrar todas
    : routes.filter(route => !allTiers.some(t => t.route_id === route.id)); // Si es nuevo, solo sin tier

  return (
    <div className="space-y-6">
      {/* Instrucción clara */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Configuración de Tipo de Envío
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Define el tipo de envío (Standard/Express), el medio de transporte (Marítimo/Aéreo), 
          y los costos y tiempos estimados para cada tramo del envío.
        </p>
      </div>

      <div>
        <Label>Ruta de Envío *</Label>
        <Select
          value={formData.route_id}
          onValueChange={(value) => setFormData({ ...formData, route_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una ruta" />
          </SelectTrigger>
          <SelectContent>
            {availableRoutes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {tier 
                  ? "No hay rutas disponibles"
                  : "Todas las rutas ya tienen tipo de envío. Crea una nueva ruta primero."}
              </div>
            ) : (
              availableRoutes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{route.route_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {route.origin_country} → {route.destination_country}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {tier && routeHasTier && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm text-orange-800">
              <strong>⚠️ Advertencia:</strong> Esta ruta ya tiene un tipo de envío configurado:
              <span className="font-semibold ml-1">
                {existingTier?.tier_name || existingTier?.tier_type}
              </span>
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Solo se permite un tipo de envío por ruta. Si guardas, reemplazarás el anterior.
            </p>
          </div>
        )}
        {!routeHasTier && formData.route_id && (
          <p className="text-xs text-green-600 mt-1">
            ✓ Esta ruta está disponible para configurar
          </p>
        )}
        {!formData.route_id && (
          <p className="text-xs text-muted-foreground mt-1">
            {tier 
              ? "Selecciona la ruta logística a la que pertenece este tipo de envío"
              : "Solo se muestran rutas sin tipo de envío configurado"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Envío *</Label>
          <Select
            value={formData.tier_type}
            onValueChange={(value: string) => {
              setFormData({ 
                ...formData, 
                tier_type: value,
                // Suggest an automatic name based on the tier type
                tier_name: {
                  standard:  'Standard - Consolidado',
                  express:   'Express - Prioritario',
                  economy:   'Economy - Económico',
                  fast:      'Fast - Rápido',
                  priority:  'Priority - Premium',
                  overnight: 'Overnight - Urgente',
                }[value] ?? formData.tier_name
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Standard</div>
                    <div className="text-xs text-muted-foreground">Consolidado — más económico</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="express">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Express</div>
                    <div className="text-xs text-muted-foreground">Prioritario — más rápido</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="economy">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="font-medium">Economy</div>
                    <div className="text-xs text-muted-foreground">Muy económico, tiempo extendido</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="fast">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="font-medium">Fast</div>
                    <div className="text-xs text-muted-foreground">Rápido — entre Standard y Express</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="priority">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-600" />
                  <div>
                    <div className="font-medium">Priority</div>
                    <div className="text-xs text-muted-foreground">Premium — máxima prioridad</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="overnight">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-pink-600" />
                  <div>
                    <div className="font-medium">Overnight</div>
                    <div className="text-xs text-muted-foreground">Entrega nocturna/urgente</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {formData.tier_type === 'standard'
              ? '📦 Envío consolidado, generalmente marítimo, más económico pero más lento'
              : formData.tier_type === 'express'
              ? '⚡ Envío prioritario, generalmente aéreo, más rápido pero más costoso'
              : formData.tier_type === 'economy'
              ? '💰 Envío muy económico, mayor tiempo de tránsito'
              : formData.tier_type === 'fast'
              ? '🚀 Velocidad intermedia entre Standard y Express'
              : formData.tier_type === 'priority'
              ? '🏆 Servicio premium con máxima prioridad'
              : '🚧 Tipo personalizado de envío'}
          </p>
        </div>

        <div>
          <Label>Tipo de Transporte *</Label>
          <Select
            value={formData.transport_type}
            onValueChange={(value: 'maritimo' | 'aereo' | 'terrestre') => setFormData({ ...formData, transport_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maritimo">
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Marítimo</div>
                    <div className="text-xs text-muted-foreground">Por barco - 15-30 días típicamente</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="aereo">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Aéreo</div>
                    <div className="text-xs text-muted-foreground">Por avión - 5-10 días típicamente</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="terrestre">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Terrestre</div>
                    <div className="text-xs text-muted-foreground">Por tierra - 7-15 días típicamente</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {formData.transport_type === 'maritimo' 
              ? '🚢 Transporte por barco, permite productos grandes (oversize)' 
              : formData.transport_type === 'aereo' 
                ? '✈️ Transporte aéreo, solo productos estándar, más rápido'
                : '🚛 Transporte terrestre, flexible y económico'}
          </p>
        </div>
      </div>

      <div>
        <Label>Nombre del Servicio *</Label>
        <Input
          value={formData.tier_name}
          onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
          placeholder="Ej: Standard - Consolidado Marítimo"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Este nombre aparecerá en el checkout para que usuarios elijan el tipo de envío
        </p>
      </div>

      {/* Campos de personalización adicionales */}
      <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
        <h4 className="font-medium text-sm">Personalización del Nombre (Opcional)</h4>
        
        <div>
          <Label>Nombre Completo Personalizado</Label>
          <Input
            value={formData.custom_tier_name}
            onChange={(e) => setFormData({ ...formData, custom_tier_name: e.target.value })}
            placeholder="Ej: Express Aéreo China - Haití"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Nombre descriptivo completo que incluye origen y destino
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>País Origen</Label>
            <Input
              value={formData.tier_origin_country}
              onChange={(e) => setFormData({ ...formData, tier_origin_country: e.target.value })}
              placeholder="China"
            />
          </div>
          <div>
            <Label>País Destino</Label>
            <Input
              value={formData.tier_destination_country}
              onChange={(e) => setFormData({ ...formData, tier_destination_country: e.target.value })}
              placeholder="Ej: Haití"
            />
          </div>
        </div>
      </div>

      {/* Separador visual */}
      <div className="border-t pt-4">
        <h3 className="font-semibold text-lg mb-1">Configuración de Costos y Tiempos por Tramo</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Define los costos y tiempos estimados de entrega para cada segmento del envío multitramo
        </p>
      </div>

      <div className="space-y-3 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
            <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Tramo A: China → USA (Bodega)</h4>
        </div>
        <p className="text-xs text-blue-800 dark:text-blue-200 mb-3">
          Peso se calcula en <strong>kilogramos (kg)</strong>. Este tramo lleva productos desde China hasta bodega en USA.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Costo por kg (USD) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.tramo_a_cost_per_kg}
              onChange={(e) => setFormData({ ...formData, tramo_a_cost_per_kg: parseFloat(e.target.value) || 0 })}
              placeholder="8.00"
            />
            <p className="text-xs text-muted-foreground mt-1">Ej: $8.00/kg para marítimo, $15/kg para aéreo</p>
          </div>
          <div>
            <Label>ETA mínimo (días) *</Label>
            <Input
              type="number"
              min="1"
              value={formData.tramo_a_eta_min}
              onChange={(e) => setFormData({ ...formData, tramo_a_eta_min: parseInt(e.target.value) || 1 })}
              placeholder="15"
            />
          </div>
          <div>
            <Label>ETA máximo (días) *</Label>
            <Input
              type="number"
              min="1"
              value={formData.tramo_a_eta_max}
              onChange={(e) => setFormData({ ...formData, tramo_a_eta_max: parseInt(e.target.value) || 1 })}
              placeholder="25"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900">
            <Plane className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="font-medium text-green-900 dark:text-green-100">Tramo B: USA → Haití (Destino Final)</h4>
        </div>
        <p className="text-xs text-green-800 dark:text-green-200 mb-3">
          Peso se calcula en <strong>libras (lb)</strong>. Este tramo lleva productos desde bodega USA hasta destino en Haití.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Costo por lb (USD) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.tramo_b_cost_per_lb}
              onChange={(e) => setFormData({ ...formData, tramo_b_cost_per_lb: parseFloat(e.target.value) || 0 })}
              placeholder="5.00"
            />
            <p className="text-xs text-muted-foreground mt-1">Ej: $5.00/lb para marítimo, $10/lb para aéreo</p>
          </div>
          <div>
            <Label>ETA mínimo (días) *</Label>
            <Input
              type="number"
              min="1"
              value={formData.tramo_b_eta_min}
              onChange={(e) => setFormData({ ...formData, tramo_b_eta_min: parseInt(e.target.value) || 1 })}
              placeholder="3"
            />
          </div>
          <div>
            <Label>ETA máximo (días) *</Label>
            <Input
              type="number"
              min="1"
              value={formData.tramo_b_eta_max}
              onChange={(e) => setFormData({ ...formData, tramo_b_eta_max: parseInt(e.target.value) || 1 })}
              placeholder="7"
            />
          </div>
        </div>
      </div>

      {/* Separador para configuraciones adicionales */}
      <div className="border-t pt-4">
        <h3 className="font-semibold text-lg mb-1">Configuraciones Adicionales</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Define las restricciones y capacidades de este tipo de envío
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Capacidades</h4>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.allows_oversize}
              onCheckedChange={(checked) => setFormData({ ...formData, allows_oversize: checked })}
            />
            <Label>Permite Oversize</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.allows_sensitive}
              onCheckedChange={(checked) => setFormData({ ...formData, allows_sensitive: checked })}
            />
            <Label>Permite Sensibles</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label>Activo</Label>
          </div>
        </div>
      </div>

      <div>
        <Label>Orden de Prioridad</Label>
        <Input
          type="number"
          value={formData.priority_order}
          onChange={(e) => setFormData({ ...formData, priority_order: parseInt(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground mt-1">Menor número = mayor prioridad</p>
      </div>

      <Button
        onClick={() => onSave({ ...tier, ...formData })}
        disabled={isSaving || !formData.tier_name || !formData.route_id}
        className="w-full"
      >
        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
      </Button>
      {!formData.route_id && (
        <p className="text-xs text-red-500 text-center">* Debes seleccionar una ruta</p>
      )}
    </div>
  );
}
