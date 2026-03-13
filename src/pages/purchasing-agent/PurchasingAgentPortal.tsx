import { useState, useRef } from 'react';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Package, ShoppingCart, Truck, CheckCircle2, XCircle, 
  Clock, AlertTriangle, Upload, Camera, Video, Link2,
  Scale, Ruler, DollarSign, FileText, Play, Eye, Plus,
  ChevronRight, RefreshCw, Image
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function PurchasingAgentPortal() {
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('assignments');
  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);
  const [newPurchasePlatform, setNewPurchasePlatform] = useState<'1688' | 'alibaba' | 'taobao' | 'other'>('1688');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const {
    useAgentProfile,
    useAgentAssignments,
    usePOPurchases,
    usePOReconciliation,
    usePOShipments,
    startAssignment,
    createPurchase,
    updatePurchaseCart,
    updateItemQC,
    createShipment,
    updateShipmentFreight,
    uploadTracking,
    uploadFile,
  } = usePurchasingAgent();

  const { data: agentProfile, isLoading: profileLoading } = useAgentProfile();
  const { data: assignments } = useAgentAssignments(agentProfile?.id || null);
  const { data: purchases } = usePOPurchases(selectedPOId);
  const { data: reconciliation } = usePOReconciliation(selectedPOId);
  const { data: shipments } = usePOShipments(selectedPOId);

  const selectedAssignment = assignments?.find(a => a.po_id === selectedPOId);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!agentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>No tienes un perfil de agente de compra activo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contacta al administrador para solicitar acceso al portal de agentes de compra.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreatePurchase = async () => {
    if (!selectedPOId || !agentProfile) return;
    await createPurchase.mutateAsync({
      poId: selectedPOId,
      agentId: agentProfile.id,
      sourcePlatform: newPurchasePlatform,
    });
    setCreatePurchaseOpen(false);
  };

  const getQCStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      received: { variant: 'outline', label: 'Recibido' },
      approved: { variant: 'default', label: 'Aprobado' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Portal de Agente</h1>
              <p className="text-sm text-muted-foreground">
                {agentProfile.full_name} • {agentProfile.agent_code}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <div className="font-medium">{agentProfile.current_active_pos} POs activas</div>
                <div className="text-muted-foreground">
                  Promedio: {agentProfile.avg_dispatch_hours.toFixed(1)}h
                </div>
              </div>
              <Badge variant="outline" className="text-base px-3 py-1">
                {agentProfile.country_name || agentProfile.country_code}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Assignments */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Mis Asignaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[400px]">
                  {assignments?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Sin asignaciones activas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignments?.map(assignment => (
                        <button
                          key={assignment.id}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedPOId === assignment.po_id
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:bg-muted'
                          }`}
                          onClick={() => setSelectedPOId(assignment.po_id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{assignment.po?.po_number}</span>
                            <Badge variant={assignment.status === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
                              {assignment.status === 'in_progress' ? 'En Proceso' : 'Asignada'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {assignment.po?.total_orders} pedidos • {assignment.po?.total_quantity} items
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completadas</span>
                  <span className="font-medium">{agentProfile.total_pos_completed}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items procesados</span>
                  <span className="font-medium">{agentProfile.total_items_processed}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Calidad</span>
                  <div className="flex items-center gap-2">
                    <Progress value={agentProfile.quality_score * 20} className="w-16 h-2" />
                    <span className="font-medium">{agentProfile.quality_score.toFixed(1)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            {!selectedPOId ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Selecciona una asignación</h3>
                  <p>Elige una PO de la lista para comenzar a trabajar</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* PO Header */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{selectedAssignment?.po?.po_number}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedAssignment?.po?.total_orders} pedidos • {selectedAssignment?.po?.total_quantity} items • 
                          ${selectedAssignment?.po?.total_amount?.toFixed(2) || '0.00'} USD
                        </p>
                      </div>
                      {selectedAssignment?.status === 'assigned' && (
                        <Button onClick={() => startAssignment.mutate(selectedAssignment.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Trabajo
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Reconciliation Panel */}
                {reconciliation && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Panel de Conciliación</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold">{reconciliation.items_requested}</div>
                          <div className="text-xs text-muted-foreground">Solicitados</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold">{reconciliation.items_purchased}</div>
                          <div className="text-xs text-muted-foreground">Comprados</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{reconciliation.items_qc_approved}</div>
                          <div className="text-xs text-muted-foreground">QC Aprobado</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">{reconciliation.items_qc_rejected}</div>
                          <div className="text-xs text-muted-foreground">QC Rechazado</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progreso de Compra</span>
                          <span className="font-medium">{reconciliation.purchase_completion_percent.toFixed(0)}%</span>
                        </div>
                        <Progress value={reconciliation.purchase_completion_percent} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span>Conciliación Total</span>
                          <span className="font-medium">{reconciliation.reconciliation_percent.toFixed(0)}%</span>
                        </div>
                        <Progress value={reconciliation.reconciliation_percent} className="h-2" />
                      </div>
                      {/* Financial Variance */}
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Costo Esperado</div>
                          <div className="font-medium">${reconciliation.total_expected_product_cost_usd.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Costo Real</div>
                          <div className="font-medium">${reconciliation.total_actual_product_cost_usd.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Envío Esperado</div>
                          <div className="font-medium">${reconciliation.total_expected_shipping_cost_usd.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Varianza Total</div>
                          <div className={`font-bold ${reconciliation.total_variance_usd > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {reconciliation.total_variance_usd > 0 ? '+' : ''}${reconciliation.total_variance_usd.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="purchases" className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Compras
                    </TabsTrigger>
                    <TabsTrigger value="qc" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Control de Calidad
                    </TabsTrigger>
                    <TabsTrigger value="shipments" className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Envíos
                    </TabsTrigger>
                  </TabsList>

                  {/* Purchases Tab */}
                  <TabsContent value="purchases" className="space-y-4">
                    <div className="flex justify-end">
                      <Dialog open={createPurchaseOpen} onOpenChange={setCreatePurchaseOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Compra
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Crear Nueva Compra</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Plataforma de Compra</Label>
                              <Select 
                                value={newPurchasePlatform} 
                                onValueChange={(v) => setNewPurchasePlatform(v as any)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1688">1688.com</SelectItem>
                                  <SelectItem value="alibaba">Alibaba</SelectItem>
                                  <SelectItem value="taobao">Taobao</SelectItem>
                                  <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleCreatePurchase} className="w-full">
                              Crear Compra
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {purchases?.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p>No hay compras registradas</p>
                          <p className="text-sm">Crea una nueva compra para comenzar</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {purchases?.map(purchase => (
                          <Card key={purchase.id}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{purchase.purchase_number}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{purchase.source_platform}</Badge>
                                  <Badge>{purchase.status}</Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Purchase Details Form - show when draft */}
                              {purchase.status === 'draft' && (
                                <PurchaseCartForm 
                                  purchaseId={purchase.id}
                                  expectedCost={purchase.expected_cost_usd}
                                  onSubmit={updatePurchaseCart.mutateAsync}
                                  uploadFile={uploadFile}
                                />
                              )}
                              
                              {/* Show status for submitted purchases */}
                              {purchase.status !== 'draft' && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      {purchase.cart_validated ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-orange-500" />
                                      )}
                                      <span>Carrito {purchase.cart_validated ? 'Validado' : 'Pendiente'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {purchase.payment_status === 'paid' ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-orange-500" />
                                      )}
                                      <span>Pago {purchase.payment_status}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span>Costo Real: <strong>${purchase.actual_cost_usd?.toFixed(2)}</strong></span>
                                    <span>Items: <strong>{purchase.items_count}</strong></span>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* QC Tab */}
                  <TabsContent value="qc" className="space-y-4">
                    {purchases?.flatMap(p => p.items || []).length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <Eye className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p>No hay items para control de calidad</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {purchases?.flatMap(p => p.items || []).map(item => (
                          <Card key={item.id}>
                            <CardContent className="py-4">
                              <div className="flex items-start gap-4">
                                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                  <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium">{item.nombre}</h4>
                                    {getQCStatusBadge(item.qc_status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">SKU: {item.sku} • Qty: {item.quantity}</p>
                                  
                                  {item.qc_status === 'pending' && (
                                    <QCForm 
                                      itemId={item.id}
                                      onSubmit={updateItemQC.mutateAsync}
                                      uploadFile={uploadFile}
                                    />
                                  )}
                                  
                                  {item.qc_photos.length > 0 && (
                                    <div className="flex gap-2 mt-2">
                                      {item.qc_photos.map((photo, idx) => (
                                        <img key={idx} src={photo} alt="" className="w-12 h-12 rounded object-cover" />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Shipments Tab */}
                  <TabsContent value="shipments" className="space-y-4">
                    {reconciliation?.can_generate_shipment && shipments?.length === 0 && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-medium">100% Conciliado - Listo para envío</span>
                            </div>
                            <ShipmentForm 
                              poId={selectedPOId!}
                              agentId={agentProfile.id}
                              onSubmit={createShipment.mutateAsync as any}
                              uploadFile={uploadFile}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {shipments?.length === 0 && !reconciliation?.can_generate_shipment ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <Truck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p>No hay envíos registrados</p>
                          <p className="text-sm">Completa el QC al 100% para generar el envío</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {shipments?.map(shipment => (
                          <Card key={shipment.id}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{shipment.shipment_number}</CardTitle>
                                <Badge>{shipment.status}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Peso Real</div>
                                  <div className="font-medium">{shipment.actual_weight_kg} kg</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Peso Volumétrico</div>
                                  <div className="font-medium">{shipment.volumetric_weight_kg?.toFixed(2)} kg</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Peso Facturable</div>
                                  <div className="font-bold">{shipment.billable_weight_kg?.toFixed(2)} kg</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Costo Envío</div>
                                  <div className="font-medium">${shipment.actual_shipping_cost_usd?.toFixed(2) || '0.00'}</div>
                                </div>
                              </div>

                              {/* Freight Form - show when preparing */}
                              {shipment.status === 'preparing' && (
                                <FreightForm 
                                  shipmentId={shipment.id}
                                  onSubmit={updateShipmentFreight.mutateAsync}
                                />
                              )}

                              {/* Tracking Form - show when freight is paid */}
                              {shipment.freight_payment_status === 'paid' && !shipment.international_tracking && (
                                <TrackingForm 
                                  shipmentId={shipment.id}
                                  onSubmit={uploadTracking.mutateAsync}
                                />
                              )}

                              {/* Show tracking if uploaded */}
                              {shipment.international_tracking && (
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="text-sm text-green-700">
                                    <strong>Tracking:</strong> {shipment.international_tracking}
                                    {shipment.carrier_name && ` (${shipment.carrier_name})`}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components for forms

function PurchaseCartForm({ 
  purchaseId, 
  expectedCost,
  onSubmit,
  uploadFile,
}: { 
  purchaseId: string; 
  expectedCost: number;
  onSubmit: (data: any) => Promise<void>;
  uploadFile: (file: File, folder: string) => Promise<string>;
}) {
  const [cartVideo, setCartVideo] = useState<File | null>(null);
  const [paymentLink, setPaymentLink] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!cartVideo || !paymentLink || !actualCost) {
      toast.error('Completa todos los campos');
      return;
    }
    setIsSubmitting(true);
    try {
      const videoUrl = await uploadFile(cartVideo, `carts/${purchaseId}`);
      await onSubmit({
        purchaseId,
        cartScreencastUrl: videoUrl,
        paymentLink,
        actualCostUsd: parseFloat(actualCost),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label>Video del Carrito (obligatorio)</Label>
        <Input 
          type="file" 
          accept="video/*"
          onChange={(e) => setCartVideo(e.target.files?.[0] || null)}
        />
        <p className="text-xs text-muted-foreground">
          Graba un video mostrando los items y el total en la web china
        </p>
      </div>
      <div className="space-y-2">
        <Label>Link de Pago</Label>
        <Input 
          placeholder="https://..."
          value={paymentLink}
          onChange={(e) => setPaymentLink(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Costo Total USD</Label>
        <div className="flex items-center gap-2">
          <Input 
            type="number"
            step="0.01"
            placeholder="0.00"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Esperado: ${expectedCost?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Enviar para Validación'}
      </Button>
    </div>
  );
}

function QCForm({ 
  itemId, 
  onSubmit,
  uploadFile,
}: { 
  itemId: string; 
  onSubmit: (data: any) => Promise<void>;
  uploadFile: (file: File, folder: string) => Promise<string>;
}) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [qcStatus, setQcStatus] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (photos.length === 0) {
      toast.error('Sube al menos una foto');
      return;
    }
    setIsSubmitting(true);
    try {
      const photoUrls = await Promise.all(
        photos.map(p => uploadFile(p, `qc/${itemId}`))
      );
      await onSubmit({
        itemId,
        qcStatus,
        qcPhotos: photoUrls,
        qcNotes: notes || undefined,
        rejectionReason: qcStatus === 'rejected' ? rejectionReason : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label>Fotos del Producto</Label>
        <Input 
          type="file" 
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files || []))}
        />
      </div>
      <div className="flex items-center gap-4">
        <Button
          size="sm"
          variant={qcStatus === 'approved' ? 'default' : 'outline'}
          onClick={() => setQcStatus('approved')}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Aprobar
        </Button>
        <Button
          size="sm"
          variant={qcStatus === 'rejected' ? 'destructive' : 'outline'}
          onClick={() => setQcStatus('rejected')}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Rechazar
        </Button>
      </div>
      {qcStatus === 'rejected' && (
        <div className="space-y-2">
          <Label>Razón del Rechazo</Label>
          <Textarea 
            placeholder="Describe el problema..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      )}
      <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
        {isSubmitting ? 'Guardando...' : 'Guardar QC'}
      </Button>
    </div>
  );
}

function ShipmentForm({ 
  poId,
  agentId,
  onSubmit,
  uploadFile,
}: { 
  poId: string;
  agentId: string;
  onSubmit: (data: any) => Promise<void>;
  uploadFile: (file: File, folder: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [scalePhoto, setScalePhoto] = useState<File | null>(null);
  const [dimensionsPhoto, setDimensionsPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const volumetricWeight = (parseFloat(length || '0') * parseFloat(width || '0') * parseFloat(height || '0')) / 5000;
  const billableWeight = Math.max(parseFloat(weight || '0'), volumetricWeight);

  const handleSubmit = async () => {
    if (!weight || !length || !width || !height || !scalePhoto || !dimensionsPhoto) {
      toast.error('Completa todos los campos');
      return;
    }
    setIsSubmitting(true);
    try {
      const [scaleUrl, dimUrl] = await Promise.all([
        uploadFile(scalePhoto, `shipments/${poId}/scale`),
        uploadFile(dimensionsPhoto, `shipments/${poId}/dimensions`),
      ]);
      await onSubmit({
        poId,
        agentId,
        weightKg: parseFloat(weight),
        lengthCm: parseFloat(length),
        widthCm: parseFloat(width),
        heightCm: parseFloat(height),
        scalePhotoUrl: scaleUrl,
        dimensionsPhotoUrl: dimUrl,
      });
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Truck className="h-4 w-4 mr-2" />
          Crear Envío
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Consolidar Envío Internacional</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso Real (kg)</Label>
              <Input 
                type="number"
                step="0.001"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Largo (cm)</Label>
              <Input 
                type="number"
                step="0.1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ancho (cm)</Label>
              <Input 
                type="number"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alto (cm)</Label>
              <Input 
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>
          
          {weight && length && width && height && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div>Peso Volumétrico: <strong>{volumetricWeight.toFixed(3)} kg</strong></div>
              <div>Peso Facturable: <strong className="text-primary">{billableWeight.toFixed(3)} kg</strong></div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Foto de Báscula</Label>
            <Input 
              type="file" 
              accept="image/*"
              onChange={(e) => setScalePhoto(e.target.files?.[0] || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Foto de Dimensiones</Label>
            <Input 
              type="file" 
              accept="image/*"
              onChange={(e) => setDimensionsPhoto(e.target.files?.[0] || null)}
            />
          </div>
          
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando...' : 'Crear Envío'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FreightForm({ 
  shipmentId, 
  onSubmit,
}: { 
  shipmentId: string; 
  onSubmit: (data: any) => Promise<void>;
}) {
  const [freightLink, setFreightLink] = useState('');
  const [cost, setCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!freightLink || !cost) {
      toast.error('Completa todos los campos');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        shipmentId,
        freightPaymentLink: freightLink,
        actualShippingCostUsd: parseFloat(cost),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label>Link de Pago del Flete</Label>
        <Input 
          placeholder="https://..."
          value={freightLink}
          onChange={(e) => setFreightLink(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Costo del Flete (USD)</Label>
        <Input 
          type="number"
          step="0.01"
          placeholder="0.00"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
        {isSubmitting ? 'Enviando...' : 'Enviar para Validación'}
      </Button>
    </div>
  );
}

function TrackingForm({ 
  shipmentId, 
  onSubmit,
}: { 
  shipmentId: string; 
  onSubmit: (data: any) => Promise<void>;
}) {
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!tracking) {
      toast.error('Ingresa el número de tracking');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        shipmentId,
        internationalTracking: tracking,
        carrierName: carrier,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-green-50">
      <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Flete Pagado - Ingresar Tracking
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Número de Tracking</Label>
          <Input 
            placeholder="ABC123..."
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Transportista</Label>
          <Input 
            placeholder="DHL, FedEx, etc."
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
        {isSubmitting ? 'Guardando...' : 'Cargar Tracking'}
      </Button>
    </div>
  );
}
