import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  useMarkets, 
  useMarketPaymentMethods, 
  MarketDashboard,
  MarketPaymentMethod,
} from "@/hooks/useMarkets";
import { useCountriesRoutes } from "@/hooks/useCountriesRoutes";
import { useAdminPaymentMethods, PaymentMethod } from "@/hooks/usePaymentMethods";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Globe, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Store, 
  Loader2,
  Route,
  Package,
  Link2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminMarketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { markets, activeMarkets, isLoading, createMarket, updateMarket, deleteMarket, toggleMarketActive } = useMarkets();
  const { countries, routes, isLoading: loadingRoutes } = useCountriesRoutes();
  
  // Get all admin payment methods from the system
  const { methods: adminPaymentMethods, isLoading: loadingAdminMethods } = useAdminPaymentMethods();
  
  // Dialog states
  const [showMarketDialog, setShowMarketDialog] = useState(false);
  const [showAssignPaymentsDialog, setShowAssignPaymentsDialog] = useState(false);
  const [showAssignProductsDialog, setShowAssignProductsDialog] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketDashboard | null>(null);
  const [editingMarket, setEditingMarket] = useState<MarketDashboard | null>(null);

  // Form state
  const [marketForm, setMarketForm] = useState({
    name: "",
    code: "",
    description: "",
    destination_country_id: "", // backward compat = primary country
    shipping_route_id: "",
    currency: "USD",
    timezone: "America/Port-au-Prince",
    sort_order: 0,
    is_active: false,
  });
  // Multi-country selector: list of country IDs for this market
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const toggleCountryId = (id: string) => {
    if (selectedCountryIds.includes(id)) {
      setSelectedCountryIds(prev => prev.filter(c => c !== id));
    } else {
      setSelectedCountryIds(prev => [...prev, id]);
    }
  };

  // Per-country route selection: { countryId: Set of selected routeIds }
  const [selectedRouteIds, setSelectedRouteIds] = useState<Record<string, string[]>>({});
  const toggleRouteId = (countryId: string, routeId: string) => {
    setSelectedRouteIds(prev => {
      const current = prev[countryId] ?? [];
      const next = current.includes(routeId)
        ? current.filter(r => r !== routeId)
        : [...current, routeId];
      return { ...prev, [countryId]: next };
    });
  };

  // Payment assignment state
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [assigningPayments, setAssigningPayments] = useState(false);

  // Product assignment state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [assignedProductIds, setAssignedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [assigningProducts, setAssigningProducts] = useState(false);

  // Fetch payment methods for selected market
  const { paymentMethods, createPaymentMethod, deletePaymentMethod } = 
    useMarketPaymentMethods(selectedMarket?.id);

  // Open market dialog for create/edit
  const openMarketDialog = async (market?: MarketDashboard) => {
    if (market) {
      setEditingMarket(market);
      const countryIds = market.countries?.map(c => c.id)
        ?? (market.destination_country_id ? [market.destination_country_id] : []);
      setSelectedCountryIds(countryIds);
      setMarketForm({
        name: market.name,
        code: market.code,
        description: market.description || "",
        destination_country_id: market.destination_country_id ?? countryIds[0] ?? "",
        shipping_route_id: market.shipping_route_id || "",
        currency: market.currency,
        timezone: market.timezone || "America/Port-au-Prince",
        sort_order: market.sort_order,
        is_active: market.is_active,
      });
      // Load routes already assigned to this market
      const { data: assignedRoutes } = await supabase
        .from('shipping_routes')
        .select('id, destination_country_id')
        .eq('market_id', market.id);
      const routeMap: Record<string, string[]> = {};
      for (const r of assignedRoutes ?? []) {
        const cid = r.destination_country_id;
        routeMap[cid] = [...(routeMap[cid] ?? []), r.id];
      }
      setSelectedRouteIds(routeMap);
    } else {
      setEditingMarket(null);
      setSelectedCountryIds([]);
      setSelectedRouteIds({});
      setMarketForm({
        name: "",
        code: "",
        description: "",
        destination_country_id: "",
        shipping_route_id: "",
        currency: "USD",
        timezone: "America/Port-au-Prince",
        sort_order: 0,
        is_active: false,
      });
    }
    setShowMarketDialog(true);
  };

  // Submit market form
  const handleMarketSubmit = async () => {
    if (selectedCountryIds.length === 0) return;

    // primary country = first in list
    const primaryCountryId = selectedCountryIds[0];

    const data = {
      ...marketForm,
      destination_country_id: primaryCountryId,
      description: marketForm.description || null,
      metadata: {},
    };

    const syncCountries = async (marketId: string) => {
      // 1. Remove countries no longer selected
      const { error: delErr } = await supabase
        .from('market_destination_countries')
        .delete()
        .eq('market_id', marketId)
        .not('destination_country_id', 'in', `(${selectedCountryIds.map(id => `'${id}'`).join(',')})`);
      if (delErr) console.error('Error removing countries:', delErr);

      // 2. Upsert selected countries
      const rows = selectedCountryIds.map((countryId, idx) => ({
        market_id: marketId,
        destination_country_id: countryId,
        is_primary: idx === 0,
        is_active: true,
        sort_order: idx,
      }));
      const { error: upsertErr } = await supabase
        .from('market_destination_countries')
        .upsert(rows, { onConflict: 'market_id,destination_country_id' });
      if (upsertErr) console.error('Error upserting countries:', upsertErr);
    };

    const syncRoutes = async (marketId: string) => {
      // Step 1: clear all routes previously assigned to this market
      const { error: clearErr } = await supabase
        .from('shipping_routes')
        .update({ market_id: null })
        .eq('market_id', marketId);
      if (clearErr) console.error('Error clearing routes:', clearErr);

      // Step 2: assign the currently selected routes
      const allSelected = Object.values(selectedRouteIds).flat();
      if (allSelected.length > 0) {
        const { error: assignErr } = await supabase
          .from('shipping_routes')
          .update({ market_id: marketId })
          .in('id', allSelected);
        if (assignErr) console.error('Error assigning routes:', assignErr);
      }
    };

    if (editingMarket) {
      updateMarket.mutate({ id: editingMarket.id, ...data }, {
        onSuccess: async () => {
          await syncCountries(editingMarket.id);
          await syncRoutes(editingMarket.id);
          await queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
          setShowMarketDialog(false);
        },
      });
    } else {
      createMarket.mutate(data, {
        onSuccess: async (newMarket: any) => {
          if (newMarket?.id) {
            await syncCountries(newMarket.id);
            await syncRoutes(newMarket.id);
            await queryClient.invalidateQueries({ queryKey: ['markets-dashboard'] });
          }
          setShowMarketDialog(false);
        },
      });
    }
  };

  // Open payment assignment dialog
  const openAssignPaymentsDialog = (market: MarketDashboard) => {
    setSelectedMarket(market);
    // Pre-select already assigned payment methods
    const assignedIds = paymentMethods?.map(pm => pm.name) || [];
    setSelectedPaymentIds([]);
    setShowAssignPaymentsDialog(true);
  };

  // Initialize selected payments when dialog opens and paymentMethods loads
  useEffect(() => {
    if (showAssignPaymentsDialog && paymentMethods && adminPaymentMethods) {
      // Find which admin methods are already assigned to this market
      const assignedNames = paymentMethods.map(pm => pm.name);
      const matchingIds = adminPaymentMethods
        .filter(apm => assignedNames.includes(apm.display_name || ''))
        .map(apm => apm.id);
      setSelectedPaymentIds(matchingIds);
    }
  }, [showAssignPaymentsDialog, paymentMethods, adminPaymentMethods]);

  // Toggle payment selection
  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPaymentIds(prev => 
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  // Assign selected payments to market
  const handleAssignPayments = async () => {
    if (!selectedMarket) return;
    
    setAssigningPayments(true);
    try {
      // First, delete all existing payment methods for this market
      const { error: deleteError } = await supabase
        .from('market_payment_methods')
        .delete()
        .eq('market_id', selectedMarket.id);
      
      if (deleteError) throw deleteError;

      // Then insert new assignments based on selected admin payment methods
      if (selectedPaymentIds.length > 0) {
        const selectedMethods = adminPaymentMethods?.filter(m => selectedPaymentIds.includes(m.id)) || [];
        
        const inserts = selectedMethods.map((method, index) => ({
          market_id: selectedMarket.id,
          name: method.display_name || `${method.method_type} - ${method.holder_name || method.account_holder || 'Sin nombre'}`,
          method_type: method.method_type === 'bank' ? 'bank_transfer' : method.method_type,
          currency: selectedMarket.currency,
          account_number: method.account_number || method.phone_number || null,
          account_holder: method.account_holder || method.holder_name || null,
          bank_name: method.bank_name || null,
          instructions: null,
          is_active: method.is_active,
          sort_order: index,
          metadata: { source_payment_method_id: method.id },
        }));

        const { error: insertError } = await supabase
          .from('market_payment_methods')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }

      toast.success(`${selectedPaymentIds.length} método(s) de pago asignados al mercado`);
      setShowAssignPaymentsDialog(false);
      // Refresh markets data
      window.location.reload();
    } catch (error) {
      console.error('Error assigning payments:', error);
      toast.error('Error al asignar métodos de pago');
    } finally {
      setAssigningPayments(false);
    }
  };

  const handleDeleteMarket = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este mercado? Esta acción es irreversible.")) {
      deleteMarket.mutate(id);
    }
  };

  const handleDeletePayment = (id: string) => {
    if (confirm("¿Eliminar este método de pago del mercado?")) {
      deletePaymentMethod.mutate(id);
    }
  };

  // Load products for assignment
  const loadProductsForMarket = async (market: MarketDashboard) => {
    setSelectedMarket(market);
    setLoadingProducts(true);
    try {
      // Fetch all active products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, sku_interno, nombre, costo_base_excel, is_active')
        .eq('is_active', true)
        .order('nombre');
      
      if (productsError) throw productsError;
      setAllProducts(products || []);

      // Fetch assigned products for this market
      const { data: assigned, error: assignedError } = await supabase
        .from('product_markets')
        .select('product_id')
        .eq('market_id', market.id)
        .eq('is_active', true);
      
      if (assignedError) throw assignedError;
      setAssignedProductIds(assigned?.map(a => a.product_id) || []);
      
      setShowAssignProductsDialog(true);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Toggle product assignment
  const toggleProductAssignment = (productId: string) => {
    setAssignedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Save product assignments
  const handleAssignProducts = async () => {
    if (!selectedMarket) return;
    
    setAssigningProducts(true);
    try {
      // Delete all current assignments
      const { error: deleteError } = await supabase
        .from('product_markets')
        .delete()
        .eq('market_id', selectedMarket.id);
      
      if (deleteError) throw deleteError;

      // Insert new assignments
      if (assignedProductIds.length > 0) {
        const inserts = assignedProductIds.map(productId => ({
          product_id: productId,
          market_id: selectedMarket.id,
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('product_markets')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }

      toast.success(`${assignedProductIds.length} producto(s) asignados al mercado`);
      setShowAssignProductsDialog(false);
      window.location.reload();
    } catch (error) {
      console.error('Error assigning products:', error);
      toast.error('Error al asignar productos');
    } finally {
      setAssigningProducts(false);
    }
  };

  const paymentMethodTypes: Record<string, string> = {
    bank_transfer: "Transferencia Bancaria",
    bank: "Transferencia Bancaria",
    moncash: "Moncash",
    natcash: "Natcash",
    cash: "Efectivo",
    credit_card: "Tarjeta de Crédito",
    paypal: "PayPal",
    crypto: "Criptomonedas",
    stripe: "Stripe",
    other: "Otro",
  };

  if (isLoading || loadingRoutes) {
    return (
      <AdminLayout title="Mercados" subtitle="Cargando...">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Gestión de Mercados" 
      subtitle="Configura mercados, rutas logísticas y métodos de pago localizados"
    >
      <Tabs defaultValue="markets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="markets" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Mercados
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        {/* ========== MARKETS TAB ========== */}
        <TabsContent value="markets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mercados Configurados</CardTitle>
                <CardDescription>
                  Cada mercado representa un país destino con su ruta logística y métodos de pago
                </CardDescription>
              </div>
              <Button onClick={() => openMarketDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Mercado
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead className="text-center">Productos</TableHead>
                    <TableHead className="text-center">Pagos</TableHead>
                    <TableHead className="text-center">Configuración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markets?.map((market) => (
                    <TableRow key={market.id}>
                      <TableCell className="font-mono font-bold">{market.code}</TableCell>
                      <TableCell className="font-medium">{market.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(market.countries?.length ?? 0) > 0
                            ? market.countries.map(c => (
                                <Badge key={c.id} variant="outline" className="gap-1 text-xs">
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                  {c.code}
                                  {c.is_primary && <span className="text-blue-500">★</span>}
                                </Badge>
                              ))
                            : <span className="text-muted-foreground text-sm">-</span>
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        {market.route_names && market.route_names.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {market.route_names.map(r => (
                              <Badge key={r.id} variant="outline" className="gap-1">
                                <Route className="h-3 w-3" />
                                {r.name || (r.is_direct ? "Directo" : r.transit_hub_name || "Ruta")}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin Ruta
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          <Package className="h-3 w-3 mr-1" />
                          {market.product_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {market.payment_method_count > 0 ? (
                          <Badge variant="secondary">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {market.payment_method_count}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {market.is_ready ? (
                          <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Listo
                          </Badge>
                        ) : !market.destination_country_id ? (
                          <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin País
                          </Badge>
                        ) : (market.route_count ?? 0) === 0 ? (
                          <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin Ruta
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Sin Tiers
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={market.is_active}
                          disabled={!market.is_ready}
                          title={!market.is_ready ? 'Configura país, ruta y tiers antes de activar' : undefined}
                          onCheckedChange={(checked) => {
                            if (checked && !market.is_ready) {
                              toast.error('El mercado necesita país, ruta y al menos 1 tier activos para activarse');
                              return;
                            }
                            toggleMarketActive.mutate({ id: market.id, is_active: checked });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          title="Gestionar productos del mercado"
                          onClick={() => loadProductsForMarket(market)}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          title="Asignar métodos de pago"
                          onClick={() => {
                            setSelectedMarket(market);
                            setShowAssignPaymentsDialog(true);
                          }}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          title="Ver métodos asignados"
                          onClick={() => setSelectedMarket(market)}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openMarketDialog(market)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMarket(market.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!markets?.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No hay mercados configurados. Crea uno para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Methods Panel - View assigned methods */}
          {selectedMarket && !showAssignPaymentsDialog && (
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Métodos de Pago: {selectedMarket.name}
                  </CardTitle>
                  <CardDescription>
                    Métodos de pago asignados a este mercado
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedMarket(null)}>
                    Cerrar
                  </Button>
                  <Button onClick={() => setShowAssignPaymentsDialog(true)} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Asignar Métodos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Cuenta/Número</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentMethods?.map((method) => (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {paymentMethodTypes[method.method_type] || method.method_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{method.currency}</TableCell>
                        <TableCell className="font-mono text-sm">{method.account_number || "-"}</TableCell>
                        <TableCell>{method.account_holder || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={method.is_active ? "default" : "secondary"}>
                            {method.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeletePayment(method.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!paymentMethods?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay métodos de pago asignados. Haz clic en "Asignar Métodos" para agregar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========== ALERTS TAB ========== */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Alertas de Cobertura
                </CardTitle>
                <CardDescription>
                  Problemas de configuración que requieren atención
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Markets without routes */}
                {markets?.filter(m => !m.shipping_route_id).map(market => (
                  <Alert key={market.id} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Mercado sin ruta logística</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        El mercado <strong>{market.name}</strong> no tiene una ruta logística asignada.
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openMarketDialog(market)}>
                        Configurar
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}

                {/* Markets without payment methods */}
                {markets?.filter(m => m.payment_method_count === 0 && m.is_active).map(market => (
                  <Alert key={`pay-${market.id}`}>
                    <CreditCard className="h-4 w-4" />
                    <AlertTitle>Mercado sin métodos de pago</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        El mercado <strong>{market.name}</strong> no tiene métodos de pago activos.
                      </span>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedMarket(market);
                        setShowAssignPaymentsDialog(true);
                      }}>
                        Asignar Pagos
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}

                {/* No issues */}
                {markets?.every(m => m.shipping_route_id && (m.payment_method_count > 0 || !m.is_active)) && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertTitle>Todo en orden</AlertTitle>
                    <AlertDescription>
                      Todos los mercados activos tienen rutas y métodos de pago configurados.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== MARKET DIALOG ========== */}
      <Dialog open={showMarketDialog} onOpenChange={setShowMarketDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMarket ? "Editar Mercado" : "Crear Mercado"}</DialogTitle>
            <DialogDescription>
              Configura un nuevo mercado con su destino y ruta logística
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="market-name">Nombre del Mercado</Label>
                <Input
                  id="market-name"
                  value={marketForm.name}
                  onChange={(e) => setMarketForm({ ...marketForm, name: e.target.value })}
                  placeholder="Ej: Haití Principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market-code">Código</Label>
                <Input
                  id="market-code"
                  value={marketForm.code}
                  onChange={(e) => setMarketForm({ ...marketForm, code: e.target.value.toUpperCase() })}
                  placeholder="Ej: HT-PAP"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="market-description">Descripción</Label>
              <Textarea
                id="market-description"
                value={marketForm.description}
                onChange={(e) => setMarketForm({ ...marketForm, description: e.target.value })}
                placeholder="Descripción opcional del mercado"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Países Destino <span className="text-red-500">*</span></Label>
              <p className="text-xs text-gray-500">El primer país seleccionado será el principal. Puedes elegir varios.</p>
              <div className="max-h-44 overflow-y-auto border rounded-md p-2 space-y-1">
                {(countries ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-2 text-center">Cargando países...</p>
                ) : (
                  countries?.filter(c => c.is_active).map((country) => (
                    <label
                      key={country.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={selectedCountryIds.includes(country.id)}
                        onCheckedChange={() => toggleCountryId(country.id)}
                      />
                      <span className="font-mono text-xs text-gray-400 w-8">{country.code}</span>
                      <span>{country.name}</span>
                      {selectedCountryIds[0] === country.id && (
                        <span className="ml-auto text-xs text-blue-500 font-medium">(principal)</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              {selectedCountryIds.length > 0 && (
                <p className="text-xs text-gray-500">
                  {selectedCountryIds.length} país{selectedCountryIds.length > 1 ? 'es' : ''} seleccionado{selectedCountryIds.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Per-country routes — read-only display */}
            {selectedCountryIds.length > 0 && (
              <div className="space-y-3">
                <div>
                  <Label>Rutas Logísticas por País</Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Las rutas se gestionan en <strong>Logística Global</strong>. Una ruta puede pertenecer a un solo mercado y un solo país.
                  </p>
                </div>
                {selectedCountryIds.map((countryId, idx) => {
                  const country = countries?.find(c => c.id === countryId);
                  const countryRouteList = (routes ?? []).filter(
                    r => r.destination_country_id === countryId && r.is_active
                  );
                  const checkedRoutes = selectedRouteIds[countryId] ?? [];
                  return (
                    <div key={countryId} className="border rounded-md p-3 space-y-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5 text-gray-500">{country?.code ?? '??'}</span>
                        <span className="text-sm font-medium">{country?.name ?? countryId}</span>
                        {idx === 0 && <span className="text-xs text-blue-500 font-medium">(principal)</span>}
                        <span className="ml-auto text-xs text-gray-400">{checkedRoutes.length}/{countryRouteList.length} seleccionada{checkedRoutes.length !== 1 ? 's' : ''}</span>
                      </div>
                      {countryRouteList.length === 0 ? (
                        <div className="flex items-center justify-between text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
                          <span>No hay rutas activas para este país</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 ml-2"
                            onClick={() => { setShowMarketDialog(false); navigate("/admin/global-logistics?action=new-route"); }}
                          >
                            <Route className="h-3 w-3 mr-1" />
                            Crear Ruta
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {countryRouteList.map(route => (
                            <label
                              key={route.id}
                              className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1.5 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              <Checkbox
                                checked={checkedRoutes.includes(route.id)}
                                onCheckedChange={() => toggleRouteId(countryId, route.id)}
                              />
                              <Route className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium flex-1">{route.route_name || (route.is_direct ? 'Directo' : `Vía ${route.transit_hub?.name ?? 'Hub'}`)}</span>
                              {route.is_direct && <Badge variant="secondary" className="text-[10px] h-4">Directo</Badge>}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="market-currency">Moneda</Label>
                <Select
                  value={marketForm.currency}
                  onValueChange={(value) => setMarketForm({ ...marketForm, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - Dólar</SelectItem>
                    <SelectItem value="HTG">HTG - Gourde</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="market-order">Orden</Label>
                <Input
                  id="market-order"
                  type="number"
                  value={marketForm.sort_order}
                  onChange={(e) => setMarketForm({ ...marketForm, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Mercado Activo</Label>
                <p className="text-sm text-muted-foreground">
                  Requiere una ruta logística asignada
                </p>
              </div>
              <Switch
                checked={marketForm.is_active}
                disabled={selectedCountryIds.length === 0}
                onCheckedChange={(checked) => setMarketForm({ ...marketForm, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarketDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMarketSubmit}
              disabled={!marketForm.name || !marketForm.code || selectedCountryIds.length === 0 || createMarket.isPending || updateMarket.isPending}
            >
              {(createMarket.isPending || updateMarket.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMarket ? "Guardar Cambios" : "Crear Mercado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ASSIGN PAYMENT METHODS DIALOG ========== */}
      <Dialog open={showAssignPaymentsDialog} onOpenChange={setShowAssignPaymentsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Asignar Métodos de Pago
            </DialogTitle>
            <DialogDescription>
              Selecciona los métodos de pago del sistema que estarán disponibles en <strong>{selectedMarket?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingAdminMethods ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : adminPaymentMethods && adminPaymentMethods.length > 0 ? (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {adminPaymentMethods.map((method) => {
                  const isSelected = selectedPaymentIds.includes(method.id);
                  return (
                    <div
                      key={method.id}
                      onClick={() => togglePaymentSelection(method.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <Checkbox 
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {method.display_name || `${paymentMethodTypes[method.method_type]} - ${method.holder_name || method.account_holder || 'Sin nombre'}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {paymentMethodTypes[method.method_type] || method.method_type}
                          </Badge>
                          {method.account_number || method.phone_number ? (
                            <span className="font-mono text-xs">
                              {method.account_number || method.phone_number}
                            </span>
                          ) : null}
                          {!method.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No hay métodos de pago configurados</AlertTitle>
                <AlertDescription>
                  Primero debes configurar métodos de pago en la sección de Configuración de Pagos.
                  <Button 
                    variant="link" 
                    className="p-0 h-auto ml-1"
                    onClick={() => navigate("/admin/metodos-pago")}
                  >
                    Ir a configuración
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">
              {selectedPaymentIds.length} método(s) seleccionado(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignPaymentsDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAssignPayments}
                disabled={assigningPayments}
              >
                {assigningPayments && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Asignación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== ASSIGN PRODUCTS DIALOG ========== */}
      <Dialog open={showAssignProductsDialog} onOpenChange={setShowAssignProductsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestionar Productos - {selectedMarket?.name}
            </DialogTitle>
            <DialogDescription>
              Selecciona los productos que estarán disponibles en este mercado
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between border-b pb-3 mb-2">
            <span className="text-sm text-muted-foreground">
              {assignedProductIds.length} de {allProducts.length} seleccionado(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignedProductIds(allProducts.map(p => p.id))}
                disabled={loadingProducts || allProducts.length === 0}
              >
                Seleccionar Todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignedProductIds([])}
                disabled={loadingProducts || assignedProductIds.length === 0}
              >
                Deseleccionar Todos
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loadingProducts ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : allProducts.length > 0 ? (
              allProducts.map(product => (
                <div 
                  key={product.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => toggleProductAssignment(product.id)}
                >
                  <Checkbox
                    checked={assignedProductIds.includes(product.id)}
                    onCheckedChange={() => toggleProductAssignment(product.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{product.nombre}</p>
                      <Badge variant="outline" className="font-mono text-xs">
                        {product.sku_interno}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Costo: ${product.costo_base_excel?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No hay productos disponibles</AlertTitle>
                <AlertDescription>
                  No se encontraron productos activos en el sistema.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-4 mt-4">
            <span className="text-sm text-muted-foreground">
              {assignedProductIds.length} producto(s) seleccionado(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignProductsDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAssignProducts}
                disabled={assigningProducts}
              >
                {assigningProducts && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Asignación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
