import React, { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogisticsEngine, Department, Commune, ShippingRate, CategoryShippingRate } from '@/hooks/useLogisticsEngine';
import { useCategories } from '@/hooks/useCategories';
import { ShippingLabelPrinter } from '@/components/logistics/ShippingLabelPrinter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Truck, MapPin, Building2, Package, Settings, Plus, Edit, 
  Printer, Tag, DollarSign, Percent, Save, Search, QrCode 
} from 'lucide-react';
import { toast } from 'sonner';

const AdminLogisticsPage = () => {
  const [activeTab, setActiveTab] = useState('rates');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialogs
  const [departmentDialog, setDepartmentDialog] = useState(false);
  const [communeDialog, setCommuneDialog] = useState(false);
  const [categoryRateDialog, setCategoryRateDialog] = useState(false);
  const [trackingDialog, setTrackingDialog] = useState(false);
  const [labelDialog, setLabelDialog] = useState(false);
  
  // Edit state
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingCommune, setEditingCommune] = useState<Commune | null>(null);
  const [editingCategoryRate, setEditingCategoryRate] = useState<CategoryShippingRate | null>(null);
  const [selectedLabelData, setSelectedLabelData] = useState<any>(null);
  
  // Form state
  const [departmentForm, setDepartmentForm] = useState({ code: '', name: '' });
  const [communeForm, setCommuneForm] = useState({
    department_id: '',
    code: '',
    name: '',
    rate_per_lb: 0,
    extra_department_fee: 0,
    delivery_fee: 0,
    operational_fee: 0,
    transit_hub_id: '',  // TICKET #26: hub local que atiende la commune
  });
  const [categoryRateForm, setCategoryRateForm] = useState({
    category_id: '',
    fixed_fee: 0,
    percentage_fee: 0,
    description: '',
  });
  const [trackingForm, setTrackingForm] = useState({
    china_tracking_number: '',
    department_id: '',
    commune_id: '',
    unit_count: 1,
    customer_name: '',
    customer_phone: '',
    weight_grams: 0,
    reference_price: 0,
  });
  
  // Hooks
  const {
    useDepartments,
    useCommunes,
    useAllCommunes,
    useShippingRates,
    useCategoryShippingRates,
    useShipmentTracking,
    updateShippingRate,
    createDepartment,
    updateDepartment,
    createCommune,
    updateCommune,
    createCategoryShippingRate,
    updateCategoryShippingRate,
    createShipmentTracking,
    generateHybridTrackingId,
    markLabelPrinted,
  } = useLogisticsEngine();

  // TICKET #26: cargar hubs locales para el selector del commune form
  const { data: localHubs = [] } = useQuery({
    queryKey: ['transit-hubs-local'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transit_hubs')
        .select('id, name, code, hub_type')
        .in('hub_type', ['local_master', 'terminal_bus'])
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: allCommunes, isLoading: loadingCommunes } = useAllCommunes();
  const { data: rates, isLoading: loadingRates } = useShippingRates();
  const { data: categoryRates, isLoading: loadingCategoryRates } = useCategoryShippingRates();
  const { data: trackingRecords, isLoading: loadingTracking } = useShipmentTracking();
  const { data: categories } = useCategories();
  const { data: filteredCommunes } = useCommunes(trackingForm.department_id || undefined);
  
  // Rate editing
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState<number>(0);
  
  const handleSaveRate = (key: string) => {
    updateShippingRate.mutate({ key, value: rateValue });
    setEditingRate(null);
  };
  
  // Department handlers
  const handleSaveDepartment = () => {
    if (editingDepartment) {
      updateDepartment.mutate({ id: editingDepartment.id, ...departmentForm, is_active: true });
    } else {
      createDepartment.mutate({ ...departmentForm, is_active: true });
    }
    setDepartmentDialog(false);
    setEditingDepartment(null);
    setDepartmentForm({ code: '', name: '' });
  };
  
  const openDepartmentEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setDepartmentForm({ code: dept.code, name: dept.name });
    setDepartmentDialog(true);
  };
  
  // Commune handlers
  const handleSaveCommune = () => {
    if (editingCommune) {
      updateCommune.mutate({ id: editingCommune.id, ...communeForm, is_active: true });
    } else {
      createCommune.mutate({ ...communeForm, is_active: true });
    }
    setCommuneDialog(false);
    setEditingCommune(null);
    setCommuneForm({
      department_id: '',
      code: '',
      name: '',
      rate_per_lb: 0,
      extra_department_fee: 0,
      delivery_fee: 0,
      operational_fee: 0,
      transit_hub_id: '',
    });
  };
  
  const openCommuneEdit = (commune: any) => {
    setEditingCommune(commune);
    setCommuneForm({
      department_id: commune.department_id,
      code: commune.code,
      name: commune.name,
      rate_per_lb: commune.rate_per_lb,
      extra_department_fee: commune.extra_department_fee,
      delivery_fee: commune.delivery_fee,
      operational_fee: commune.operational_fee,
      transit_hub_id: commune.transit_hub_id || '',
    });
    setCommuneDialog(true);
  };
  
  // Category rate handlers
  const handleSaveCategoryRate = () => {
    if (editingCategoryRate) {
      updateCategoryShippingRate.mutate({ id: editingCategoryRate.id, ...categoryRateForm, is_active: true });
    } else {
      createCategoryShippingRate.mutate({ ...categoryRateForm, is_active: true });
    }
    setCategoryRateDialog(false);
    setEditingCategoryRate(null);
    setCategoryRateForm({ category_id: '', fixed_fee: 0, percentage_fee: 0, description: '' });
  };
  
  // Tracking handlers
  const handleCreateTracking = async () => {
    const dept = departments?.find(d => d.id === trackingForm.department_id);
    const commune = filteredCommunes?.find(c => c.id === trackingForm.commune_id);
    
    if (!dept || !commune) {
      toast.error('Selecciona departamento y comuna');
      return;
    }
    
    const hybridId = generateHybridTrackingId(
      dept.code,
      commune.code,
      null,
      trackingForm.unit_count,
      trackingForm.china_tracking_number
    );
    
    await createShipmentTracking.mutateAsync({
      hybrid_tracking_id: hybridId,
      china_tracking_number: trackingForm.china_tracking_number,
      department_id: trackingForm.department_id,
      commune_id: trackingForm.commune_id,
      unit_count: trackingForm.unit_count,
      customer_name: trackingForm.customer_name,
      customer_phone: trackingForm.customer_phone,
      weight_grams: trackingForm.weight_grams,
      reference_price: trackingForm.reference_price,
      status: 'pending',
      order_id: null,
      order_type: 'b2c',
      pickup_point_id: null,
      shipping_cost_china_usa: null,
      shipping_cost_usa_haiti: null,
      category_fees: null,
      total_shipping_cost: null,
      label_printed_at: null,
    });
    
    setTrackingDialog(false);
    setTrackingForm({
      china_tracking_number: '',
      department_id: '',
      commune_id: '',
      unit_count: 1,
      customer_name: '',
      customer_phone: '',
      weight_grams: 0,
      reference_price: 0,
    });
  };
  
  const handlePrintLabel = (tracking: any) => {
    setSelectedLabelData({
      hybridTrackingId: tracking.hybrid_tracking_id,
      customerName: tracking.customer_name || 'N/A',
      customerPhone: tracking.customer_phone || 'N/A',
      departmentName: tracking.departments?.name || 'N/A',
      communeName: tracking.communes?.name || 'N/A',
      unitCount: tracking.unit_count,
      weightGrams: tracking.weight_grams || 0,
      status: tracking.status,
    });
    setLabelDialog(true);
  };
  
  const handleLabelPrinted = () => {
    if (selectedLabelData) {
      const record = trackingRecords?.find(t => t.hybrid_tracking_id === selectedLabelData.hybridTrackingId);
      if (record) {
        markLabelPrinted.mutate(record.id);
      }
    }
    setLabelDialog(false);
  };
  
  // Filter tracking records
  const filteredTracking = trackingRecords?.filter(t => {
    const anyT = t as any;
    return anyT.hybrid_tracking_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anyT.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anyT.china_tracking_number || anyT.china_tracking || '')?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <AdminLayout title="Gestión Logística" subtitle="Administra tarifas de envío, zonas geográficas y trazabilidad">
      <div className="space-y-6">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="rates" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Tarifas Globales
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="h-4 w-4" />
              Departamentos
            </TabsTrigger>
            <TabsTrigger value="communes" className="gap-2">
              <MapPin className="h-4 w-4" />
              Comunas
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              Categorías
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2">
              <QrCode className="h-4 w-4" />
              Seguimiento
            </TabsTrigger>
          </TabsList>

          {/* Global Rates Tab */}
          <TabsContent value="rates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Tarifas Globales de Envío
                </CardTitle>
                <CardDescription>
                  Configura las tarifas base para el tramo China-USA y seguros
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRates ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {rates?.map((rate) => (
                      <Card key={rate.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{rate.description || rate.key}</p>
                              <p className="text-sm text-muted-foreground">{rate.key}</p>
                            </div>
                            {editingRate === rate.key ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={rateValue}
                                  onChange={(e) => setRateValue(parseFloat(e.target.value))}
                                  className="w-24"
                                  step="0.01"
                                />
                                <Button size="sm" onClick={() => handleSaveRate(rate.key)}>
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold">${rate.value}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRate(rate.key);
                                    setRateValue(rate.value);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Departamentos de Haití</CardTitle>
                  <CardDescription>Códigos de 2 letras para la estructura geográfica</CardDescription>
                </div>
                <Button onClick={() => setDepartmentDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDepts ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments?.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-mono font-bold">{dept.code}</TableCell>
                          <TableCell>{dept.name}</TableCell>
                          <TableCell>
                            <Badge variant={dept.is_active ? "default" : "secondary"}>
                              {dept.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openDepartmentEdit(dept)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communes Tab */}
          <TabsContent value="communes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Comunas / Municipios</CardTitle>
                  <CardDescription>Tarifas por libra y cargos locales</CardDescription>
                </div>
                <Button onClick={() => setCommuneDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCommunes ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Depto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">$/lb</TableHead>
                        <TableHead className="text-right">Extra Depto</TableHead>
                        <TableHead className="text-right">Domicilio</TableHead>
                        <TableHead className="text-right">Operativo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCommunes?.map((commune: any) => (
                        <TableRow key={commune.id}>
                          <TableCell className="font-mono">{commune.departments?.code}</TableCell>
                          <TableCell className="font-mono font-bold">{commune.code}</TableCell>
                          <TableCell>{commune.name}</TableCell>
                          <TableCell className="text-right">${commune.rate_per_lb}</TableCell>
                          <TableCell className="text-right">${commune.extra_department_fee}</TableCell>
                          <TableCell className="text-right">${commune.delivery_fee}</TableCell>
                          <TableCell className="text-right">${commune.operational_fee}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openCommuneEdit(commune)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Rates Tab */}
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tarifas por Categoría</CardTitle>
                  <CardDescription>Cargos fijos y porcentuales por tipo de producto</CardDescription>
                </div>
                <Button onClick={() => setCategoryRateDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCategoryRates ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Cargo Fijo</TableHead>
                        <TableHead className="text-right">% sobre Adquisición</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryRates?.map((rate: any) => (
                        <TableRow key={rate.id}>
                          <TableCell className="font-medium">{rate.categories?.name || 'N/A'}</TableCell>
                          <TableCell className="text-right">${rate.fixed_fee}</TableCell>
                          <TableCell className="text-right">{rate.percentage_fee}%</TableCell>
                          <TableCell className="text-muted-foreground">{rate.description || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingCategoryRate(rate);
                                setCategoryRateForm({
                                  category_id: rate.category_id,
                                  fixed_fee: rate.fixed_fee,
                                  percentage_fee: rate.percentage_fee,
                                  description: rate.description || '',
                                });
                                setCategoryRateDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Seguimiento de Envíos</CardTitle>
                  <CardDescription>IDs híbridos y etiquetas logísticas</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button onClick={() => setTrackingDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Envío
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTracking ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Híbrido</TableHead>
                        <TableHead>Tracking China</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-center">Unidades</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTracking?.map((tracking: any) => (
                        <TableRow key={tracking.id}>
                          <TableCell className="font-mono text-sm font-bold">
                            {tracking.hybrid_tracking_id}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {tracking.china_tracking_number}
                          </TableCell>
                          <TableCell>
                            <div>{tracking.customer_name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{tracking.customer_phone}</div>
                          </TableCell>
                          <TableCell>
                            {tracking.communes?.name}, {tracking.departments?.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{tracking.unit_count}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              tracking.status === 'delivered' ? 'default' :
                              tracking.status === 'in_transit' ? 'secondary' : 'outline'
                            }>
                              {tracking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => handlePrintLabel(tracking)}
                            >
                              <Printer className="h-4 w-4" />
                              Etiqueta
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Department Dialog */}
        <Dialog open={departmentDialog} onOpenChange={setDepartmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDepartment ? 'Editar' : 'Nuevo'} Departamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código (2 letras)</Label>
                <Input
                  value={departmentForm.code}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value.toUpperCase().slice(0, 2) })}
                  maxLength={2}
                  placeholder="OU"
                />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  placeholder="Ouest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepartmentDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveDepartment}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Commune Dialog */}
        <Dialog open={communeDialog} onOpenChange={setCommuneDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCommune ? 'Editar' : 'Nueva'} Comuna</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Departamento</Label>
                <Select 
                  value={communeForm.department_id} 
                  onValueChange={(v) => setCommuneForm({ ...communeForm, department_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código (2 letras)</Label>
                  <Input
                    value={communeForm.code}
                    onChange={(e) => setCommuneForm({ ...communeForm, code: e.target.value.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={communeForm.name}
                    onChange={(e) => setCommuneForm({ ...communeForm, name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Tarifa por Libra ($/lb)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={communeForm.rate_per_lb}
                  onChange={(e) => setCommuneForm({ ...communeForm, rate_per_lb: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Extra Depto ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={communeForm.extra_department_fee}
                    onChange={(e) => setCommuneForm({ ...communeForm, extra_department_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Domicilio ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={communeForm.delivery_fee}
                    onChange={(e) => setCommuneForm({ ...communeForm, delivery_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Operativo ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={communeForm.operational_fee}
                    onChange={(e) => setCommuneForm({ ...communeForm, operational_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {/* TICKET #26: Hub local que atiende esta commune */}
              <div>
                <Label>Hub local asignado</Label>
                <Select
                  value={communeForm.transit_hub_id}
                  onValueChange={(v) => setCommuneForm({ ...communeForm, transit_hub_id: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hub local..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin asignar —</SelectItem>
                    {localHubs.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.code} — {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* TICKET #26: Hub local que atiende la commune */}
              <div>
                <Label>Hub local asignado</Label>
                <Select
                  value={communeForm.transit_hub_id}
                  onValueChange={(v) => setCommuneForm({ ...communeForm, transit_hub_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hub..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sin asignar —</SelectItem>
                    {/* TODO: reemplazar por useQuery transit_hubs local_master */}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCommuneDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveCommune}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Rate Dialog */}
        <Dialog open={categoryRateDialog} onOpenChange={setCategoryRateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategoryRate ? 'Editar' : 'Nueva'} Tarifa de Categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Categoría</Label>
                <Select 
                  value={categoryRateForm.category_id} 
                  onValueChange={(v) => setCategoryRateForm({ ...categoryRateForm, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cargo Fijo ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={categoryRateForm.fixed_fee}
                    onChange={(e) => setCategoryRateForm({ ...categoryRateForm, fixed_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>% sobre Adquisición</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={categoryRateForm.percentage_fee}
                    onChange={(e) => setCategoryRateForm({ ...categoryRateForm, percentage_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input
                  value={categoryRateForm.description}
                  onChange={(e) => setCategoryRateForm({ ...categoryRateForm, description: e.target.value })}
                  placeholder="Ej: Productos frágiles"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryRateDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveCategoryRate}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Tracking Dialog */}
        <Dialog open={trackingDialog} onOpenChange={setTrackingDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Nuevo Envío con Tracking Híbrido
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Número de Seguimiento China</Label>
                <Input
                  value={trackingForm.china_tracking_number}
                  onChange={(e) => setTrackingForm({ ...trackingForm, china_tracking_number: e.target.value })}
                  placeholder="YT2024123456789"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Departamento</Label>
                  <Select 
                    value={trackingForm.department_id} 
                    onValueChange={(v) => setTrackingForm({ ...trackingForm, department_id: v, commune_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comuna</Label>
                  <Select 
                    value={trackingForm.commune_id} 
                    onValueChange={(v) => setTrackingForm({ ...trackingForm, commune_id: v })}
                    disabled={!trackingForm.department_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCommunes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre del Cliente</Label>
                  <Input
                    value={trackingForm.customer_name}
                    onChange={(e) => setTrackingForm({ ...trackingForm, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={trackingForm.customer_phone}
                    onChange={(e) => setTrackingForm({ ...trackingForm, customer_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Unidades</Label>
                  <Input
                    type="number"
                    min={1}
                    value={trackingForm.unit_count}
                    onChange={(e) => setTrackingForm({ ...trackingForm, unit_count: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Peso (g)</Label>
                  <Input
                    type="number"
                    value={trackingForm.weight_grams}
                    onChange={(e) => setTrackingForm({ ...trackingForm, weight_grams: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Reference Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={trackingForm.reference_price}
                    onChange={(e) => setTrackingForm({ ...trackingForm, reference_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              {/* Preview hybrid ID */}
              {trackingForm.department_id && trackingForm.commune_id && trackingForm.china_tracking_number && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm text-muted-foreground">Vista Previa ID Híbrido:</Label>
                  <p className="font-mono font-bold text-lg mt-1">
                    {generateHybridTrackingId(
                      departments?.find(d => d.id === trackingForm.department_id)?.code || 'XX',
                      filteredCommunes?.find(c => c.id === trackingForm.commune_id)?.code || 'XX',
                      null,
                      trackingForm.unit_count,
                      trackingForm.china_tracking_number
                    )}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTrackingDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateTracking} disabled={createShipmentTracking.isPending}>
                {createShipmentTracking.isPending ? 'Creando...' : 'Crear Envío'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Label Printer Dialog */}
        <ShippingLabelPrinter
          open={labelDialog}
          onOpenChange={setLabelDialog}
          labelData={selectedLabelData}
          onPrintComplete={handleLabelPrinted}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminLogisticsPage;
