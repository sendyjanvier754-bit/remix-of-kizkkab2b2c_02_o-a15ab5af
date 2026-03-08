import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { usePOMasterPerMarket, MarketPODashboardItem } from '@/hooks/usePOMasterPerMarket';
import { 
  Globe, Package, PlayCircle, StopCircle, Settings, Truck, 
  Clock, AlertTriangle, CheckCircle, BarChart3, Eye,
  ArrowRight, Plane, Building2, Hash, Timer, ExternalLink, ShoppingBag, FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generatePOBuyingListPDF, generatePOBuyingListExcel } from '@/services/pdfGenerators';

const stageConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Abierta', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <PlayCircle className="h-4 w-4" /> },
  closed: { label: 'Cerrada', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <StopCircle className="h-4 w-4" /> },
  preparing: { label: 'Preparando', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <Package className="h-4 w-4" /> },
  in_transit_china: { label: 'Tránsito China', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Plane className="h-4 w-4" /> },
  arrived_hub: { label: 'En Hub', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <Building2 className="h-4 w-4" /> },
  completed: { label: 'Completada', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="h-4 w-4" /> },
};

export default function AdminPOMasterPage() {
  const {
    useDashboard,
    usePOOrders,
    useClosedPOs,
    useMarketSettings,
    ensureMarketPO,
    closePOAndOpenNext,
    updateChinaTracking,
    updateMarketSettings,
  } = usePOMasterPerMarket();

  const { data: dashboard, isLoading } = useDashboard();
  const [selectedMarket, setSelectedMarket] = useState<MarketPODashboardItem | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [trackingDialog, setTrackingDialog] = useState(false);
  const [closeConfirmDialog, setCloseConfirmDialog] = useState(false);
  const [chinaTracking, setChinaTracking] = useState('');
  const [ordersDialog, setOrdersDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [viewingPOId, setViewingPOId] = useState<string | null>(null);
  const [viewingPONumber, setViewingPONumber] = useState<string>('');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    close_mode: 'manual',
    auto_close_enabled: false,
    quantity_threshold: 50,
    weight_threshold_kg: 500,
    time_interval_hours: 168,
    close_cron_expression: '',
  });

  const effectivePOId = viewingPOId || selectedMarket?.active_po_id || null;
  const { data: poOrders, isLoading: poOrdersLoading } = usePOOrders(effectivePOId);
  const { data: closedPOs } = useClosedPOs(selectedMarket?.market_id || null);
  const { data: marketSettings } = useMarketSettings(selectedMarket?.market_id || null);

  const handleEnsurePO = (marketId: string) => {
    ensureMarketPO.mutate(marketId);
  };

  const handleClosePO = () => {
    if (!selectedMarket?.active_po_id) return;
    closePOAndOpenNext.mutate({
      poId: selectedMarket.active_po_id,
      reason: 'manual',
    });
    setCloseConfirmDialog(false);
  };

  const handleTrackingSubmit = () => {
    if (!selectedMarket?.active_po_id || !chinaTracking.trim()) return;
    updateChinaTracking.mutate({
      poId: selectedMarket.active_po_id,
      tracking: chinaTracking.trim(),
    });
    setTrackingDialog(false);
    setChinaTracking('');
  };

  const handleOpenSettings = (market: MarketPODashboardItem) => {
    setSelectedMarket(market);
    setSettingsForm({
      close_mode: market.close_mode || 'manual',
      auto_close_enabled: market.auto_close_enabled || false,
      quantity_threshold: market.quantity_threshold || 50,
      weight_threshold_kg: market.weight_threshold_kg || 500,
      time_interval_hours: market.time_interval_hours || 168,
      close_cron_expression: '',
    });
    setSettingsDialog(true);
  };

  const handleSaveSettings = () => {
    if (!selectedMarket) return;
    updateMarketSettings.mutate({
      market_id: selectedMarket.market_id,
      ...settingsForm,
    });
    setSettingsDialog(false);
  };

  if (isLoading) {
    return (
      <AdminLayout title="PO Maestra" subtitle="Gestión de Órdenes de Compra Perpetuas por Mercado">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72" />)}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="PO Maestra Perpetua" subtitle="Ciclo de órdenes de compra por mercado de destino">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mercados Activos</p>
                  <p className="text-3xl font-bold">{dashboard?.length || 0}</p>
                </div>
                <Globe className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">POs Abiertas</p>
                  <p className="text-3xl font-bold text-emerald-500">
                    {dashboard?.filter(m => m.active_po_id).length || 0}
                  </p>
                </div>
                <PlayCircle className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pedidos Abiertos</p>
                  <p className="text-3xl font-bold text-blue-500">
                    {dashboard?.reduce((s, m) => s + m.total_orders, 0) || 0}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Acumulado</p>
                  <p className="text-3xl font-bold text-primary">
                    ${dashboard?.reduce((s, m) => s + m.total_amount, 0).toFixed(0) || '0'}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market PO Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {dashboard?.map(market => (
            <MarketPOCard
              key={market.market_id}
              market={market}
              onEnsurePO={() => handleEnsurePO(market.market_id)}
              onClose={() => { setSelectedMarket(market); setCloseConfirmDialog(true); }}
              onTracking={() => { setSelectedMarket(market); setTrackingDialog(true); }}
              onSettings={() => handleOpenSettings(market)}
              onViewOrders={() => { setSelectedMarket(market); setViewingPOId(market.active_po_id); setViewingPONumber(market.active_po_number); setOrdersDialog(true); }}
              onViewHistory={() => { setSelectedMarket(market); setHistoryDialog(true); }}
            />
          ))}

          {(!dashboard || dashboard.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin mercados configurados</h3>
                <p className="text-sm text-muted-foreground">
                  Configura mercados de destino en la sección de Mercados para comenzar
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Close Confirmation Dialog */}
      <Dialog open={closeConfirmDialog} onOpenChange={setCloseConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cerrar PO {selectedMarket?.active_po_number}
            </DialogTitle>
            <DialogDescription>
              Esta acción cerrará la PO actual y:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
              <ArrowRight className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <span className="text-sm">
                <strong>{selectedMarket?.total_orders || 0}</strong> pedidos pasarán a estado <Badge className="bg-amber-500/20 text-amber-400">Preparando</Badge>
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg">
              <PlayCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <span className="text-sm">Se abrirá automáticamente la siguiente PO para <strong>{selectedMarket?.market_name}</strong></span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
              <Hash className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <span className="text-sm">Se generarán IDs internos de rastreo con formato: <code className="bg-muted px-1 rounded">{selectedMarket?.market_code}-DEPT-PO-TRACKING-HUB-XXXX</code></span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmDialog(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={handleClosePO}
              disabled={closePOAndOpenNext.isPending}
            >
              {closePOAndOpenNext.isPending ? 'Cerrando...' : 'Cerrar PO y Abrir Siguiente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* China Tracking Dialog */}
      <Dialog open={trackingDialog} onOpenChange={setTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ingresar Tracking de China</DialogTitle>
            <DialogDescription>
              PO: {selectedMarket?.active_po_number} — {selectedMarket?.market_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Número de Tracking China</Label>
              <Input
                value={chinaTracking}
                onChange={(e) => setChinaTracking(e.target.value)}
                placeholder="Ej: SF1234567890"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este tracking reemplazará el placeholder en todos los IDs internos de los pedidos en esta PO.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialog(false)}>Cancelar</Button>
            <Button onClick={handleTrackingSubmit} disabled={!chinaTracking.trim() || updateChinaTracking.isPending}>
              {updateChinaTracking.isPending ? 'Guardando...' : 'Guardar Tracking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Cierre — {selectedMarket?.market_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Cierre Automático</Label>
                <p className="text-xs text-muted-foreground">Activar cierre automático basado en reglas</p>
              </div>
              <Switch
                checked={settingsForm.auto_close_enabled}
                onCheckedChange={(v) => setSettingsForm(prev => ({ ...prev, auto_close_enabled: v }))}
              />
            </div>
            
            <div>
              <Label>Modo de Cierre</Label>
              <Select value={settingsForm.close_mode} onValueChange={(v) => setSettingsForm(prev => ({ ...prev, close_mode: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="time">Por Tiempo</SelectItem>
                  <SelectItem value="quantity">Por Cantidad</SelectItem>
                  <SelectItem value="weight">Por Peso</SelectItem>
                  <SelectItem value="hybrid">Híbrido (Tiempo + Cantidad)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(settingsForm.close_mode === 'time' || settingsForm.close_mode === 'hybrid') && (
              <div>
                <Label>Intervalo de Tiempo (horas)</Label>
                <Input
                  type="number"
                  value={settingsForm.time_interval_hours}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, time_interval_hours: Number(e.target.value) }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  168h = 7 días, 336h = 14 días
                </p>
              </div>
            )}

            {(settingsForm.close_mode === 'quantity' || settingsForm.close_mode === 'hybrid') && (
              <div>
                <Label>Umbral de Cantidad (pedidos)</Label>
                <Input
                  type="number"
                  value={settingsForm.quantity_threshold}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, quantity_threshold: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            )}

            {(settingsForm.close_mode === 'weight') && (
              <div>
                <Label>Umbral de Peso (KG)</Label>
                <Input
                  type="number"
                  value={settingsForm.weight_threshold_kg}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, weight_threshold_kg: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveSettings} disabled={updateMarketSettings.isPending}>
              {updateMarketSettings.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders Dialog */}
      <Dialog open={ordersDialog} onOpenChange={setOrdersDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingPONumber || selectedMarket?.active_po_number} — {selectedMarket?.market_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="articulos">
            <TabsList className="mb-4">
              <TabsTrigger value="articulos">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Artículos a Comprar
              </TabsTrigger>
              <TabsTrigger value="pedidos">
                <Package className="h-4 w-4 mr-2" />
                Pedidos ({poOrders?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Artículos a Comprar ── */}
            <TabsContent value="articulos">
              {(() => {
                // Flatten all items across all orders and aggregate by variant/product
                const itemMap = new Map<string, {
                  key: string;
                  nombre: string;
                  variantName: string | null;
                  optionType: string | null;
                  optionValue: string | null;
                  image: string | null;
                  url_origen: string | null;
                  cantidad: number;
                  sku: string;
                }>();

                (poOrders || []).forEach((order: any) => {
                  (order.order_items_b2b || []).forEach((item: any) => {
                    // Use SKU as key — it's always unique per variant (e.g. "924221472274-Negro-3XL")
                    const key = item.sku || item.variant_id || item.product_id || item.id;
                    const existing = itemMap.get(key);
                    // Priority: saved image on item (variant-specific, from checkout) → variant object images → product images
                    const savedImg = item.image || null;
                    const variantImg = Array.isArray(item.variant?.images) && item.variant.images.length > 0
                      ? item.variant.images[0]
                      : (typeof item.variant?.images === 'string' ? item.variant.images : null);
                    const productImg = item.product?.imagen_principal
                      || (Array.isArray(item.product?.galeria_imagenes) ? item.product.galeria_imagenes[0] : null)
                      || null;
                    const image = savedImg || variantImg || productImg;
                    const url_origen = item.product?.url_origen ?? null;

                    // Use variant name from DB — name field, option_type+option_value, or color+size (all real DB values)
                    const variantName: string | null =
                      item.variant?.name
                      || (item.variant?.option_type && item.variant?.option_value
                          ? `${item.variant.option_type}: ${item.variant.option_value}`
                          : null)
                      || ((item.color || item.size)
                          ? [item.color, item.size].filter(Boolean).join(' / ')
                          : null)
                      || null;

                    if (existing) {
                      existing.cantidad += item.cantidad;
                    } else {
                      itemMap.set(key, {
                        key,
                        nombre: item.product?.nombre || item.nombre,
                        variantName,
                        optionType: item.variant?.option_type ?? null,
                        optionValue: item.variant?.option_value ?? null,
                        image,
                        url_origen,
                        cantidad: item.cantidad,
                        sku: item.sku,
                      });
                    }
                  });
                });

                const rows = Array.from(itemMap.values());

                if (poOrdersLoading) {
                  return (
                    <div className="text-center py-10 text-muted-foreground">Cargando artículos...</div>
                  );
                }

                if (rows.length === 0) {
                  return (
                    <div className="text-center py-10 text-muted-foreground">
                      Sin artículos en esta PO
                    </div>
                  );
                }

                return (
                  <>
                    <div className="flex justify-end gap-2 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePOBuyingListExcel({
                          po_number: selectedMarket?.active_po_number || '',
                          market_name: selectedMarket?.market_name || '',
                          generated_at: new Date().toISOString(),
                          items: rows.map(r => ({
                            sku: r.sku,
                            nombre: r.nombre,
                            variantName: r.variantName,
                            image: r.image,
                            cantidad: r.cantidad,
                            url_origen: r.url_origen,
                          })),
                        })}
                        className="gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Excel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePOBuyingListPDF({
                          po_number: selectedMarket?.active_po_number || '',
                          market_name: selectedMarket?.market_name || '',
                          generated_at: new Date().toISOString(),
                          items: rows.map(r => ({
                            sku: r.sku,
                            nombre: r.nombre,
                            variantName: r.variantName,
                            image: r.image,
                            cantidad: r.cantidad,
                            url_origen: r.url_origen,
                          })),
                        })}
                        className="gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        Descargar PDF
                      </Button>
                    </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Imagen</TableHead>
                        <TableHead>Producto / Variante</TableHead>
                        <TableHead className="w-24 text-center">Cantidad</TableHead>
                        <TableHead className="w-40">URL Origen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>
                            <div className="w-32 h-32 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt={row.nombre}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-12 w-12 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{row.nombre}</p>
                            {row.variantName && (
                              <p className="text-base font-bold text-blue-600 mt-0.5">{row.variantName}</p>
                            )}
                            <p className="text-xs text-muted-foreground/60 font-mono">{row.sku}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                              {row.cantidad}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.url_origen ? (
                              <a
                                href={row.url_origen}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[160px] truncate"
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{row.url_origen}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </>
                );
              })()}
            </TabsContent>

            {/* ── Tab: Pedidos ── */}
            <TabsContent value="pedidos">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tracking Interno</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poOrdersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Cargando pedidos...
                      </TableCell>
                    </TableRow>
                  ) : poOrders && poOrders.length > 0 ? (
                    poOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{order.buyer?.full_name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={stageConfig[order.status]?.color || 'bg-muted'}>
                            {stageConfig[order.status]?.label || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {order.internal_tracking_id || '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold">${order.total_amount?.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Sin pedidos en esta PO
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de POs — {selectedMarket?.market_name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Razón Cierre</TableHead>
                <TableHead>Cerrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedPOs?.map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-bold">{po.po_number}</TableCell>
                  <TableCell>{po.orders_at_close || po.total_orders || 0}</TableCell>
                  <TableCell className="font-bold">${Number(po.total_amount || 0).toFixed(0)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {po.close_reason || 'manual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {po.closed_at ? format(new Date(po.closed_at), 'dd/MM/yy HH:mm', { locale: es }) : '—'}
                  </TableCell>
                </TableRow>
              )) || (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Sin historial
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// Market PO Card Component
function MarketPOCard({
  market,
  onEnsurePO,
  onClose,
  onTracking,
  onSettings,
  onViewOrders,
  onViewHistory,
}: {
  market: MarketPODashboardItem;
  onEnsurePO: () => void;
  onClose: () => void;
  onTracking: () => void;
  onSettings: () => void;
  onViewOrders: () => void;
  onViewHistory: () => void;
}) {
  const hasPO = !!market.active_po_id;
  const hasTracking = !!market.china_tracking;

  return (
    <Card className={`border-2 transition-all ${hasPO ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-border hover:border-primary/30'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${hasPO ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
              {market.market_code}
            </div>
            <div>
              <CardTitle className="text-base">{market.market_name}</CardTitle>
              <CardDescription className="text-xs">
                {hasPO ? market.active_po_number : 'Sin PO activa'} 
                {market.closed_pos_count > 0 && ` • ${market.closed_pos_count} cerradas`}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasPO ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-muted rounded-lg">
                <p className="text-xl font-bold">{market.total_orders}</p>
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <p className="text-xl font-bold">{market.total_quantity}</p>
                <p className="text-xs text-muted-foreground">Unidades</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <p className="text-xl font-bold text-primary">${Number(market.total_amount).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Valor</p>
              </div>
            </div>

            {/* Close mode badge */}
            {market.auto_close_enabled && (
              <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg">
                <Timer className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-blue-400">
                  Cierre auto: {market.close_mode === 'time' ? `${market.time_interval_hours}h` : 
                    market.close_mode === 'quantity' ? `${market.quantity_threshold} pedidos` :
                    market.close_mode === 'hybrid' ? `${market.time_interval_hours}h / ${market.quantity_threshold} ped.` :
                    market.close_mode}
                </span>
              </div>
            )}

            {/* Tracking status */}
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono">
                {hasTracking ? market.china_tracking : 'Sin tracking China'}
              </span>
            </div>

            {/* Cycle info */}
            {market.cycle_start_at && (
              <p className="text-xs text-muted-foreground">
                Ciclo iniciado: {format(new Date(market.cycle_start_at), 'dd MMM yyyy HH:mm', { locale: es })}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={onViewOrders}>
                <Eye className="h-3 w-3 mr-1" />
                Ver Pedidos
              </Button>
              {!hasTracking && (
                <Button size="sm" variant="outline" onClick={onTracking}>
                  <Plane className="h-3 w-3 mr-1" />
                  Tracking
                </Button>
              )}
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={onClose}
                disabled={market.total_orders === 0}
              >
                <StopCircle className="h-3 w-3 mr-1" />
                Cerrar
              </Button>
            </div>

            {market.closed_pos_count > 0 && (
              <Button size="sm" variant="link" className="w-full" onClick={onViewHistory}>
                <Clock className="h-3 w-3 mr-1" />
                Ver historial ({market.closed_pos_count} POs)
              </Button>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No hay PO abierta para este mercado</p>
            <Button onClick={onEnsurePO} className="gap-2">
              <PlayCircle className="h-4 w-4" />
              Crear PO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
