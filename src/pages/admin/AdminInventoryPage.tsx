import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useInventoryManagement } from '@/hooks/useInventoryManagement';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useConsolidationEngine, ConsolidationMode } from '@/hooks/useConsolidationEngine';
import { PDFGenerators } from '@/services/pdfGenerators';
import { 
  Package, Truck, AlertTriangle, FileText, Printer, 
  Plus, Search, ShoppingCart, CheckCircle, Clock,
  Box, Download, Play, Link2, QrCode, Eye,
  Globe, Plane, Building2, MapPin, Settings, Timer, 
  Zap, StopCircle, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// PO Status configuration
const poStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: <FileText className="h-4 w-4" /> },
  open: { label: 'Abierta', color: 'bg-blue-100 text-blue-800', icon: <Play className="h-4 w-4" /> },
  closed: { label: 'Cerrada', color: 'bg-purple-100 text-purple-800', icon: <CheckCircle className="h-4 w-4" /> },
  ordered: { label: 'Pedida', color: 'bg-yellow-100 text-yellow-800', icon: <ShoppingCart className="h-4 w-4" /> },
  in_transit_china: { label: 'En Tránsito China', color: 'bg-orange-100 text-orange-800', icon: <Globe className="h-4 w-4" /> },
  in_transit_usa: { label: 'En Tránsito USA', color: 'bg-indigo-100 text-indigo-800', icon: <Plane className="h-4 w-4" /> },
  arrived_hub: { label: 'En Hub Haití', color: 'bg-green-100 text-green-800', icon: <Building2 className="h-4 w-4" /> },
  processing: { label: 'Procesando', color: 'bg-cyan-100 text-cyan-800', icon: <Package className="h-4 w-4" /> },
  completed: { label: 'Completada', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
};

const AdminInventoryPage = () => {
  const [activeTab, setActiveTab] = useState('po-management');
  const [searchQuery, setSearchQuery] = useState('');
  const [transitDialog, setTransitDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [trackingDialog, setTrackingDialog] = useState(false);
  const [chinaTracking, setChinaTracking] = useState('');
  const [poDetailDialog, setPoDetailDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  
  const {
    useStockBalance,
    useStockInTransit,
    useRotationAlerts,
    useDemandSummary,
    createStockInTransit,
    updateTransitStatus,
  } = useInventoryManagement();
  
  const {
    usePOList,
    usePODetails,
    useCurrentOpenPO,
    createPO,
    linkOrdersToPO,
    enterChinaTracking,
    updatePOStage,
    closePO,
    getPickingManifest,
  } = usePurchaseOrders();
  
  const {
    useConsolidationStats,
    useConsolidationSettings,
    updateSettings,
    manualClosePO,
    checkAutoClose,
    getUrgencyLevel,
    useRealtimeOrderUpdates,
  } = useConsolidationEngine();
  
  // Real-time updates
  useRealtimeOrderUpdates(true);
  
  const { data: consolidationStats, isLoading: loadingStats } = useConsolidationStats();
  const { data: consolidationSettings } = useConsolidationSettings();
  
  const { data: stockBalance, isLoading: loadingBalance } = useStockBalance();
  const { data: stockTransit, isLoading: loadingTransit } = useStockInTransit();
  const { data: rotationAlerts, isLoading: loadingAlerts } = useRotationAlerts();
  const { data: demandSummary, isLoading: loadingDemand } = useDemandSummary();
  const { data: poList, isLoading: loadingPOList } = usePOList();
  const { data: currentOpenPO } = useCurrentOpenPO();
  const { data: poDetails } = usePODetails(selectedPO || '');
  
  // Form state for new transit stock
  const [transitForm, setTransitForm] = useState({
    china_tracking_number: '',
    quantity: 0,
    expected_arrival_date: '',
    notes: '',
  });

  // Filter stock balance
  const filteredBalance = stockBalance?.filter(item => 
    item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate summary stats
  const totalStockHaiti = stockBalance?.reduce((sum, item) => sum + (item.stock_haiti || 0), 0) || 0;
  const totalInTransit = stockBalance?.reduce((sum, item) => sum + (item.stock_in_transit || 0), 0) || 0;
  const totalPendingOrders = stockBalance?.reduce((sum, item) => sum + (item.orders_pending || 0), 0) || 0;
  const alertCount = rotationAlerts?.length || 0;

  // Handle create new PO
  const handleCreatePO = async () => {
    try {
      await createPO.mutateAsync(undefined);
    } catch (error) {
      console.error(error);
    }
  };

  // Handle link orders to PO
  const handleLinkOrders = async (poId: string) => {
    try {
      await linkOrdersToPO.mutateAsync(poId);
    } catch (error) {
      console.error(error);
    }
  };

  // Handle enter tracking
  const handleEnterTracking = async () => {
    if (!selectedPO || !chinaTracking.trim()) {
      toast.error('Ingresa el número de tracking de China');
      return;
    }
    try {
      await enterChinaTracking.mutateAsync({ poId: selectedPO, chinaTracking: chinaTracking.trim() });
      setTrackingDialog(false);
      setChinaTracking('');
    } catch (error) {
      console.error(error);
    }
  };

  // Handle update stage
  const handleUpdateStage = async (poId: string, newStatus: string) => {
    try {
      await updatePOStage.mutateAsync({ poId, newStatus });
    } catch (error) {
      console.error(error);
    }
  };

  // Handle generate picking manifest PDF
  const handleGeneratePickingPDF = async (poId: string) => {
    const manifest = await getPickingManifest(poId);
    if (!manifest) {
      toast.error('No se pudo obtener datos del manifiesto');
      return;
    }
    
    PDFGenerators.generatePOPickingManifestPDF({
      po_number: manifest.po.po_number,
      china_tracking: manifest.po.china_tracking_number || '',
      total_orders: manifest.po.total_orders,
      total_items: manifest.po.total_items,
      customers: manifest.customers.map(c => ({
        customer_name: c.customer_name,
        customer_phone: c.customer_phone,
        hybrid_tracking_id: c.hybrid_tracking_id,
        department_code: c.department_code,
        commune_code: c.commune_code,
        source_type: c.source_type || 'b2c',
        gestor_name: c.gestor_name,
        investor_name: c.investor_name,
        items: c.items.map(i => ({
          product_name: i.product_name,
          sku: i.sku,
          color: i.color,
          size: i.size,
          image_url: i.image_url,
          quantity: i.quantity,
        })),
      })),
    });
  };

  // Generate purchase order from demand
  const handleGeneratePurchaseOrder = () => {
    if (!demandSummary || demandSummary.length === 0) return;
    
    const itemsToOrder = demandSummary.filter(d => d.quantity_to_order > 0);
    
    PDFGenerators.generatePurchaseOrderPDF({
      consolidation_number: `PO-${Date.now()}`,
      supplier_name: 'Proveedor China',
      items: itemsToOrder.map(item => ({
        sku: item.sku,
        product_name: item.product_name,
        color: item.color || undefined,
        size: item.size || undefined,
        quantity_to_order: item.quantity_to_order,
        unit_cost: 0,
        total_cost: 0,
      })),
      total_quantity: itemsToOrder.reduce((sum, i) => sum + i.quantity_to_order, 0),
      estimated_cost: 0,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <AdminLayout title="Gestión de Inventario" subtitle="Balance de stock, tránsito y consolidación B2B">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Stock Haití</p>
                  <p className="text-2xl font-bold text-green-600">{totalStockHaiti}</p>
                </div>
                <Box className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En Tránsito (China)</p>
                  <p className="text-2xl font-bold text-blue-600">{totalInTransit}</p>
                </div>
                <Truck className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pedidos Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">{totalPendingOrders}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alertas Rotación</p>
                  <p className="text-2xl font-bold text-red-600">{alertCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="po-management" className="gap-2">
              <FileText className="h-4 w-4" />
              Órdenes de Compra
            </TabsTrigger>
            <TabsTrigger value="balance" className="gap-2">
              <Package className="h-4 w-4" />
              Balance Stock
            </TabsTrigger>
            <TabsTrigger value="transit" className="gap-2">
              <Truck className="h-4 w-4" />
              En Tránsito
            </TabsTrigger>
            <TabsTrigger value="demand" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Demanda B2B
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          {/* PO Management Tab - Command Center */}
          <TabsContent value="po-management">
            <div className="space-y-6">
              {/* Auto-Consolidation Engine Panel */}
              {consolidationStats && (
                <Card className={`border-2 ${
                  getUrgencyLevel(consolidationStats) === 'critical' ? 'border-red-500 bg-red-50' :
                  getUrgencyLevel(consolidationStats) === 'high' ? 'border-orange-500 bg-orange-50' :
                  getUrgencyLevel(consolidationStats) === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-green-500 bg-green-50'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          getUrgencyLevel(consolidationStats) === 'critical' ? 'bg-red-100' :
                          getUrgencyLevel(consolidationStats) === 'high' ? 'bg-orange-100' :
                          getUrgencyLevel(consolidationStats) === 'medium' ? 'bg-yellow-100' :
                          'bg-green-100'
                        }`}>
                          <Zap className={`h-5 w-5 ${
                            getUrgencyLevel(consolidationStats) === 'critical' ? 'text-red-600' :
                            getUrgencyLevel(consolidationStats) === 'high' ? 'text-orange-600' :
                            getUrgencyLevel(consolidationStats) === 'medium' ? 'text-yellow-600' :
                            'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            Motor de Consolidación Automática
                            <Badge variant={consolidationStats.settings.is_active ? 'default' : 'secondary'}>
                              {consolidationStats.settings.is_active ? 'Activo' : 'Pausado'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Modo: {consolidationStats.settings.mode === 'hybrid' ? 'Híbrido (Tiempo + Cantidad)' :
                                   consolidationStats.settings.mode === 'time' ? 'Por Tiempo' : 'Por Cantidad'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSettingsDialog(true)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Configurar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => checkAutoClose.mutate()}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Verificar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Progress Ring */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-32 h-32">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle
                              className="text-muted stroke-current"
                              strokeWidth="8"
                              fill="transparent"
                              r="40"
                              cx="50"
                              cy="50"
                            />
                            <circle
                              className={`stroke-current ${
                                consolidationStats.progress.percent_full >= 100 ? 'text-red-500' :
                                consolidationStats.progress.percent_full >= 80 ? 'text-orange-500' :
                                consolidationStats.progress.percent_full >= 50 ? 'text-yellow-500' :
                                'text-green-500'
                              }`}
                              strokeWidth="8"
                              strokeLinecap="round"
                              fill="transparent"
                              r="40"
                              cx="50"
                              cy="50"
                              strokeDasharray={`${(consolidationStats.progress.percent_full / 100) * 251.2} 251.2`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold">{Math.round(consolidationStats.progress.percent_full)}%</span>
                            <span className="text-xs text-muted-foreground">Capacidad</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-center">
                          {consolidationStats.progress.orders_current} / {consolidationStats.progress.orders_threshold} pedidos
                        </p>
                      </div>
                      
                      {/* Stats */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Tiempo restante</span>
                          </div>
                          <span className="font-mono font-bold">
                            {consolidationStats.progress.time_remaining_formatted}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Pedidos actuales</span>
                          </div>
                          <span className="font-bold">{consolidationStats.progress.orders_current}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                          <div className="flex items-center gap-2">
                            <Box className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Unidades totales</span>
                          </div>
                          <span className="font-bold">{consolidationStats.active_po.total_quantity}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col justify-center gap-3">
                        <div className="p-3 bg-background rounded-lg text-center">
                          <p className="text-xs text-muted-foreground mb-1">Valor Acumulado</p>
                          <p className="text-2xl font-bold text-primary">
                            ${Number(consolidationStats.active_po.total_amount).toFixed(0)}
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          className="w-full gap-2"
                          onClick={() => {
                            if (consolidationStats.active_po.id) {
                              manualClosePO.mutate(consolidationStats.active_po.id);
                            }
                          }}
                          disabled={manualClosePO.isPending || consolidationStats.progress.orders_current === 0}
                        >
                          <StopCircle className="h-4 w-4" />
                          Cerrar PO Ahora
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Cierre manual de emergencia
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Current Open PO Card */}
              {currentOpenPO && (
                <Card className="border-2 border-primary">
                  <CardHeader className="bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Play className="h-5 w-5 text-primary" />
                          PO Activa: {currentOpenPO.po_number}
                        </CardTitle>
                        <CardDescription>
                          Ciclo iniciado: {format(new Date(currentOpenPO.cycle_start_at), 'PPP p', { locale: es })}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleLinkOrders(currentOpenPO.id)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Vincular Pedidos
                        </Button>
                        {!currentOpenPO.china_tracking_number && (
                          <Button 
                            size="sm" 
                            onClick={() => { setSelectedPO(currentOpenPO.id); setTrackingDialog(true); }}
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            Ingresar Tracking China
                          </Button>
                        )}
                        {currentOpenPO.china_tracking_number && (
                          <Button variant="outline" size="sm" onClick={() => handleGeneratePickingPDF(currentOpenPO.id)}>
                            <Printer className="h-4 w-4 mr-2" />
                            PDF Picking
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{currentOpenPO.total_orders}</p>
                        <p className="text-xs text-muted-foreground">Pedidos</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{currentOpenPO.total_quantity}</p>
                        <p className="text-xs text-muted-foreground">Unidades</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">${Number(currentOpenPO.total_amount).toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-sm font-mono font-bold">{currentOpenPO.china_tracking_number || 'Sin tracking'}</p>
                        <p className="text-xs text-muted-foreground">Tracking China</p>
                      </div>
                    </div>
                    
                    {currentOpenPO.china_tracking_number && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">Actualizar Estado:</span>
                        {['in_transit_china', 'in_transit_usa', 'arrived_hub', 'processing', 'completed'].map(status => (
                          <Button
                            key={status}
                            size="sm"
                            variant={currentOpenPO.status === status ? 'default' : 'outline'}
                            onClick={() => handleUpdateStage(currentOpenPO.id, status)}
                            className="gap-1"
                          >
                            {poStatusConfig[status]?.icon}
                            {poStatusConfig[status]?.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Create New PO if none active */}
              {!currentOpenPO && (
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No hay una Orden de Compra activa</p>
                    <Button onClick={handleCreatePO} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Crear Nueva PO
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* PO History */}
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Órdenes de Compra</CardTitle>
                  <CardDescription>Todas las PO con sus estados y tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPOList ? (
                    <Skeleton className="h-48 w-full" />
                  ) : poList?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4" />
                      <p>No hay órdenes de compra aún.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO #</TableHead>
                          <TableHead>Tracking China</TableHead>
                          <TableHead className="text-center">Pedidos</TableHead>
                          <TableHead className="text-center">Unidades</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poList?.map((po) => {
                          const statusConf = poStatusConfig[po.status] || poStatusConfig.draft;
                          return (
                            <TableRow key={po.id}>
                              <TableCell className="font-mono font-bold">{po.po_number}</TableCell>
                              <TableCell className="font-mono text-sm">{po.china_tracking_number || '-'}</TableCell>
                              <TableCell className="text-center">{po.total_orders}</TableCell>
                              <TableCell className="text-center">{po.total_quantity}</TableCell>
                              <TableCell className="text-right">${Number(po.total_amount).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className={statusConf.color}>
                                  {statusConf.icon}
                                  <span className="ml-1">{statusConf.label}</span>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(po.created_at), 'PP', { locale: es })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => { setSelectedPO(po.id); setPoDetailDialog(true); }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {po.china_tracking_number && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleGeneratePickingPDF(po.id)}
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Balance Stock Tab */}
          <TabsContent value="balance">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Balance de Stock</CardTitle>
                  <CardDescription>Stock Haití + Tránsito - Pedidos = Disponible</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingBalance ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Stock Haití</TableHead>
                        <TableHead className="text-right">En Tránsito</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Disponible</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalance?.slice(0, 50).map((item) => (
                        <TableRow key={`${item.product_id}-${item.variant_id}`}>
                          <TableCell>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>{item.variant_name}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {item.stock_haiti}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {item.stock_in_transit}
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600">
                            {item.orders_pending}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {item.available_balance}
                          </TableCell>
                          <TableCell>
                            {item.available_balance < 0 ? (
                              <Badge variant="destructive">Déficit</Badge>
                            ) : item.available_balance === 0 ? (
                              <Badge variant="secondary">Agotado</Badge>
                            ) : item.available_balance < 5 ? (
                              <Badge variant="outline" className="text-orange-600">Bajo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* In Transit Tab */}
          <TabsContent value="transit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Stock en Tránsito desde China</CardTitle>
                  <CardDescription>Seguimiento de envíos en camino</CardDescription>
                </div>
                <Button onClick={() => setTransitDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Envío
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTransit ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking China</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Fecha Esperada</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockTransit?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.china_tracking_number || '-'}</TableCell>
                          <TableCell>{item.products?.nombre || 'Varios'}</TableCell>
                          <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                          <TableCell>
                            {item.expected_arrival_date 
                              ? format(new Date(item.expected_arrival_date), 'PP', { locale: es })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              item.status === 'arrived' ? 'default' :
                              item.status === 'processing' ? 'secondary' : 'outline'
                            }>
                              {item.status === 'in_transit' ? 'En Tránsito' :
                               item.status === 'arrived' ? 'Llegó' :
                               item.status === 'processing' ? 'Procesando' : item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={item.status}
                              onValueChange={(status) => updateTransitStatus.mutate({ id: item.id, status })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in_transit">En Tránsito</SelectItem>
                                <SelectItem value="arrived">Llegó</SelectItem>
                                <SelectItem value="processing">Procesando</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Demand Consolidation Tab */}
          <TabsContent value="demand">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Consolidación de Demanda B2B</CardTitle>
                  <CardDescription>Agrupado por Producto → Color → Talla</CardDescription>
                </div>
                <Button onClick={handleGeneratePurchaseOrder} className="gap-2">
                  <Download className="h-4 w-4" />
                  Generar Orden de Compra
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDemand ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Talla</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Confirmados
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            Pendientes
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <ShoppingCart className="h-4 w-4 text-blue-600" />
                            Carritos
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center font-bold">A Comprar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demandSummary?.map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>{item.color || '-'}</TableCell>
                          <TableCell>{item.size || '-'}</TableCell>
                          <TableCell className="text-center font-medium text-green-600">
                            {item.quantity_confirmed}
                          </TableCell>
                          <TableCell className="text-center font-medium text-yellow-600">
                            {item.quantity_pending}
                          </TableCell>
                          <TableCell className="text-center font-medium text-blue-600">
                            {item.quantity_cart}
                          </TableCell>
                          <TableCell className="text-center">{item.stock_available}</TableCell>
                          <TableCell className="text-center">
                            {item.quantity_to_order > 0 ? (
                              <Badge variant="destructive">{item.quantity_to_order}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600">0</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rotation Alerts Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Alertas de Rotación (30+ días sin ventas)
                </CardTitle>
                <CardDescription>Productos en stock Haití que requieren descuento</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <Skeleton className="h-48 w-full" />
                ) : rotationAlerts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <p>¡No hay alertas! Todos los productos tienen rotación saludable.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center">Días sin Venta</TableHead>
                        <TableHead className="text-center">Descuento Sugerido</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rotationAlerts?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </TableCell>
                          <TableCell>{item.variant_name || '-'}</TableCell>
                          <TableCell className="text-center">{item.stock_quantity}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={
                              item.days_without_sale > 60 ? 'destructive' :
                              item.days_without_sale > 45 ? 'secondary' : 'outline'
                            }>
                              {item.days_without_sale} días
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-orange-600">
                              {item.days_without_sale > 60 ? '30%' :
                               item.days_without_sale > 45 ? '20%' : '10%'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              Aplicar Descuento
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

        {/* Transit Stock Dialog */}
        <Dialog open={transitDialog} onOpenChange={setTransitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Stock en Tránsito</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tracking de China</Label>
                <Input
                  value={transitForm.china_tracking_number}
                  onChange={(e) => setTransitForm({ ...transitForm, china_tracking_number: e.target.value })}
                  placeholder="YT2024123456789"
                />
              </div>
              <div>
                <Label>Cantidad Total</Label>
                <Input
                  type="number"
                  value={transitForm.quantity}
                  onChange={(e) => setTransitForm({ ...transitForm, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Fecha Esperada de Llegada</Label>
                <Input
                  type="date"
                  value={transitForm.expected_arrival_date}
                  onChange={(e) => setTransitForm({ ...transitForm, expected_arrival_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Notas</Label>
                <Input
                  value={transitForm.notes}
                  onChange={(e) => setTransitForm({ ...transitForm, notes: e.target.value })}
                  placeholder="Observaciones"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransitDialog(false)}>Cancelar</Button>
              <Button onClick={() => {
                createStockInTransit.mutate({
                  china_tracking_number: transitForm.china_tracking_number,
                  quantity: transitForm.quantity,
                  expected_arrival_date: transitForm.expected_arrival_date || null,
                  notes: transitForm.notes || null,
                  status: 'in_transit',
                  product_id: null,
                  variant_id: null,
                  supplier_id: null,
                  shipped_date: null,
                  batch_id: null,
                });
                setTransitDialog(false);
                setTransitForm({ china_tracking_number: '', quantity: 0, expected_arrival_date: '', notes: '' });
              }}>
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* China Tracking Dialog for PO */}
        <Dialog open={trackingDialog} onOpenChange={setTrackingDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ingresar Tracking de China</DialogTitle>
              <DialogDescription>
                Al guardar, se generarán automáticamente los IDs de seguimiento híbridos para todos los pedidos vinculados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Número de Tracking Completo</Label>
                <Input
                  value={chinaTracking}
                  onChange={(e) => setChinaTracking(e.target.value.toUpperCase())}
                  placeholder="YT2024123456789CN"
                  className="font-mono"
                />
              </div>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Formato del ID Híbrido generado:</p>
                <p className="font-mono text-xs">[DEPTO][COMUNA]-[PO]-[TRACKING]-[ID_PEDIDO]</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setTrackingDialog(false); setChinaTracking(''); }}>
                Cancelar
              </Button>
              <Button onClick={handleEnterTracking} disabled={!chinaTracking.trim()}>
                <Globe className="h-4 w-4 mr-2" />
                Guardar y Generar IDs
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PO Detail Dialog - Shows linked orders by source type */}
        <Dialog open={poDetailDialog} onOpenChange={setPoDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalle de PO: {poDetails?.po?.po_number}
              </DialogTitle>
              <DialogDescription>
                {poDetails?.po?.china_tracking_number 
                  ? `Tracking: ${poDetails.po.china_tracking_number}` 
                  : 'Sin tracking de China asignado'}
              </DialogDescription>
            </DialogHeader>
            
            {poDetails?.links && poDetails.links.length > 0 ? (
              <div className="space-y-4">
                {/* Summary by source type */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600 font-medium">🛒 B2C (Clientes)</div>
                    <div className="text-2xl font-bold text-green-700">
                      {poDetails.links.filter(l => l.source_type === 'b2c' || !l.source_type).length}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600 font-medium">🏪 B2B (Vendedores)</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {poDetails.links.filter(l => l.source_type === 'b2b').length}
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-purple-600 font-medium">🤝 Siver Match</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {poDetails.links.filter(l => l.source_type === 'siver_match').length}
                    </div>
                  </div>
                </div>

                {/* Orders table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente/Destinatario</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>ID Híbrido</TableHead>
                      <TableHead className="text-center">Unidades</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poDetails.links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          {link.source_type === 'b2c' || !link.source_type ? (
                            <Badge className="bg-green-100 text-green-800 gap-1">
                              🛒 B2C
                            </Badge>
                          ) : link.source_type === 'b2b' ? (
                            <Badge className="bg-blue-100 text-blue-800 gap-1">
                              🏪 B2B
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-800 gap-1">
                              🤝 Match
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{link.customer_name || 'Sin nombre'}</div>
                          <div className="text-xs text-muted-foreground">{link.customer_phone || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {link.department_code || 'XX'}-{link.commune_code || 'XX'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {link.hybrid_tracking_id || 'PENDIENTE'}
                          </code>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {link.unit_count}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {link.current_status || 'pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay pedidos vinculados a esta PO
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPoDetailDialog(false)}>
                Cerrar
              </Button>
              {poDetails?.po && (
                <Button onClick={() => handleGeneratePickingPDF(poDetails.po.id)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Generar PDF Manifiesto
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Consolidation Settings Dialog */}
        <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración de Consolidación
              </DialogTitle>
              <DialogDescription>
                Define las reglas para cerrar automáticamente las Órdenes de Compra
              </DialogDescription>
            </DialogHeader>
            
            {consolidationSettings && (
              <div className="space-y-6">
                {/* Mode Selection */}
                <div className="space-y-2">
                  <Label>Modo de Consolidación</Label>
                  <Select 
                    defaultValue={consolidationSettings.consolidation_mode ?? undefined}
                    onValueChange={(value) => updateSettings.mutate({ mode: value as ConsolidationMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hybrid">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Híbrido (lo que ocurra primero)
                        </div>
                      </SelectItem>
                      <SelectItem value="time">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Solo por Tiempo
                        </div>
                      </SelectItem>
                      <SelectItem value="quantity">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Solo por Cantidad
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Interval */}
                <div className="space-y-2">
                  <Label>Intervalo de Tiempo (horas)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      defaultValue={consolidationSettings.time_interval_hours ?? undefined}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (value > 0) {
                          updateSettings.mutate({ time_hours: value });
                        }
                      }}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      = {Math.floor((consolidationSettings.time_interval_hours || 48) / 24)} días
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La PO se cerrará automáticamente después de este tiempo
                  </p>
                </div>

                {/* Quantity Threshold */}
                <div className="space-y-2">
                  <Label>Umbral de Pedidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    defaultValue={consolidationSettings.order_quantity_threshold ?? undefined}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (value > 0) {
                        updateSettings.mutate({ quantity_threshold: value });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    La PO se cerrará cuando alcance esta cantidad de pedidos
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label>Motor Activo</Label>
                    <p className="text-xs text-muted-foreground">
                      Si está desactivado, los pedidos no se vincularán automáticamente
                    </p>
                  </div>
                  <Switch
                    checked={consolidationSettings.is_active ?? undefined}
                    onCheckedChange={(checked) => updateSettings.mutate({ is_active: checked })}
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsDialog(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminInventoryPage;
