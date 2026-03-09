import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePurchasingAgentAdmin } from '@/hooks/usePurchasingAgent';
import { CreateAgentDialog } from '@/components/purchasing-agent/CreateAgentDialog';
import { 
  Users, Package, ShoppingCart, Truck, CheckCircle2, XCircle, 
  Clock, AlertTriangle, TrendingUp, Play, ExternalLink, Video,
  Scale, Ruler, DollarSign, FileText, Plus, RefreshCw, Copy, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminPurchasingAgentsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  
  const {
    useAllAgents,
    useUnassignedPOs,
    usePendingValidations,
    autoAssignPO,
    validateCart,
    validatePayment,
    validateFreight,
  } = usePurchasingAgentAdmin();

  const { data: agents, isLoading: agentsLoading } = useAllAgents();
  const { data: unassignedPOs } = useUnassignedPOs();
  const { data: pendingValidations } = usePendingValidations();

  const totalPendingValidations = 
    (pendingValidations?.cartValidations?.length || 0) +
    (pendingValidations?.paymentValidations?.length || 0) +
    (pendingValidations?.freightValidations?.length || 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Activo' },
      inactive: { variant: 'secondary', label: 'Inactivo' },
      suspended: { variant: 'destructive', label: 'Suspendido' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const portalUrl = `${window.location.origin}/agente-compra/login`;

  const handleCopyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast.success("Link del portal copiado");
  };

  return (
    <AdminLayout title="Portal de Agentes de Compra" subtitle="Gestión de compras internacionales y control de calidad">
      {/* Portal Link & Create Agent */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Portal de Agentes:</span>
        </div>
        <code className="text-xs bg-background px-2 py-1 rounded border font-mono truncate max-w-sm">
          {portalUrl}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopyPortalLink}>
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </Button>
        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </a>
        <div className="flex-1" />
        <Button onClick={() => setCreateAgentOpen(true)} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Crear Agente
        </Button>
      </div>

      <CreateAgentDialog 
        open={createAgentOpen} 
        onOpenChange={setCreateAgentOpen}
        onCreated={() => {
          // Refetch agents list
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="validations" className="flex items-center gap-2 relative">
            <CheckCircle2 className="h-4 w-4" />
            Validaciones
            {totalPendingValidations > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {totalPendingValidations}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Asignaciones
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agentes Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents?.filter(a => a.status === 'active').length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">POs Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unassignedPOs?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Validaciones Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{totalPendingValidations}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tiempo Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {agents?.length ? 
                    `${Math.round(agents.reduce((sum, a) => sum + a.avg_dispatch_hours, 0) / agents.length)}h` : 
                    '0h'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agents Performance Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de Agentes</CardTitle>
              <CardDescription>KPIs de eficiencia por agente</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead className="text-center">POs Activas</TableHead>
                    <TableHead className="text-center">Completadas</TableHead>
                    <TableHead className="text-center">Tiempo Prom.</TableHead>
                    <TableHead className="text-center">Calidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents?.map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="font-medium">{agent.full_name}</div>
                        <div className="text-xs text-muted-foreground">{agent.agent_code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.country_name || agent.country_code}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{agent.current_active_pos}</span>
                        <span className="text-muted-foreground">/{agent.max_concurrent_pos}</span>
                      </TableCell>
                      <TableCell className="text-center">{agent.total_pos_completed}</TableCell>
                      <TableCell className="text-center">
                        {agent.avg_dispatch_hours > 0 ? `${agent.avg_dispatch_hours.toFixed(1)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={agent.quality_score * 20} className="w-16 h-2" />
                          <span className="text-sm">{agent.quality_score.toFixed(1)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Agentes de Compra</h3>
            <Button onClick={() => setCreateAgentOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Agente
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents?.map(agent => (
              <Card key={agent.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{agent.full_name}</CardTitle>
                    {getStatusBadge(agent.status)}
                  </div>
                  <CardDescription>{agent.agent_code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{agent.country_name || agent.country_code}</Badge>
                    {agent.email && <span className="text-muted-foreground truncate">{agent.email}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{agent.current_active_pos}</div>
                      <div className="text-xs text-muted-foreground">Activas</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{agent.total_pos_completed}</div>
                      <div className="text-xs text-muted-foreground">Completadas</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{agent.quality_score.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Calidad</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Validations Tab */}
        <TabsContent value="validations" className="space-y-4">
          {/* Cart Validations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Validación de Carritos
                {(pendingValidations?.cartValidations?.length || 0) > 0 && (
                  <Badge variant="destructive">{pendingValidations?.cartValidations?.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Videos de carrito pendientes de revisión</CardDescription>
            </CardHeader>
            <CardContent>
              {(pendingValidations?.cartValidations?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No hay carritos pendientes de validación</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {pendingValidations?.cartValidations?.map((purchase: any) => (
                      <div key={purchase.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{purchase.purchase_number}</div>
                            <div className="text-sm text-muted-foreground">
                              Agente: {purchase.agent?.full_name} • PO: {purchase.po?.po_number}
                            </div>
                          </div>
                          <Badge>{purchase.source_platform}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>Esperado: ${purchase.expected_cost_usd?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span>Real: ${purchase.actual_cost_usd?.toFixed(2) || '0.00'}</span>
                          </div>
                          {purchase.actual_cost_usd > purchase.expected_cost_usd && (
                            <Badge variant="destructive" className="text-xs">
                              +${(purchase.actual_cost_usd - purchase.expected_cost_usd).toFixed(2)} varianza
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {purchase.cart_screencast_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={purchase.cart_screencast_url} target="_blank" rel="noopener noreferrer">
                                <Video className="h-4 w-4 mr-1" />
                                Ver Video
                              </a>
                            </Button>
                          )}
                          {purchase.payment_link && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={purchase.payment_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Link Pago
                              </a>
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => validateCart.mutate({ purchaseId: purchase.id, approved: false })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => validateCart.mutate({ purchaseId: purchase.id, approved: true })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Payment Validations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Validación de Pagos
                {(pendingValidations?.paymentValidations?.length || 0) > 0 && (
                  <Badge variant="destructive">{pendingValidations?.paymentValidations?.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Pagos pendientes de confirmación</CardDescription>
            </CardHeader>
            <CardContent>
              {(pendingValidations?.paymentValidations?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No hay pagos pendientes de validación</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {pendingValidations?.paymentValidations?.map((purchase: any) => (
                      <div key={purchase.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{purchase.purchase_number}</div>
                          <div className="text-sm text-muted-foreground">
                            ${purchase.actual_cost_usd?.toFixed(2)} • {purchase.agent?.full_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => validatePayment.mutate({ purchaseId: purchase.id, approved: false })}
                          >
                            Rechazar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => validatePayment.mutate({ purchaseId: purchase.id, approved: true })}
                          >
                            Confirmar Pago
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Freight Validations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Validación de Fletes
                {(pendingValidations?.freightValidations?.length || 0) > 0 && (
                  <Badge variant="destructive">{pendingValidations?.freightValidations?.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Pagos de flete pendientes de confirmación</CardDescription>
            </CardHeader>
            <CardContent>
              {(pendingValidations?.freightValidations?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No hay fletes pendientes de validación</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {pendingValidations?.freightValidations?.map((shipment: any) => (
                      <div key={shipment.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{shipment.shipment_number}</div>
                            <div className="text-sm text-muted-foreground">
                              Agente: {shipment.agent?.full_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Scale className="h-4 w-4 text-muted-foreground" />
                            <span>Peso: {shipment.billable_weight_kg?.toFixed(2)} kg</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>Esperado: ${shipment.expected_shipping_cost_usd?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span>Real: ${shipment.actual_shipping_cost_usd?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {shipment.scale_photo_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={shipment.scale_photo_url} target="_blank" rel="noopener noreferrer">
                                <Scale className="h-4 w-4 mr-1" />
                                Báscula
                              </a>
                            </Button>
                          )}
                          {shipment.freight_payment_link && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={shipment.freight_payment_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Link Pago
                              </a>
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => validateFreight.mutate({ shipmentId: shipment.id, approved: false })}
                          >
                            Rechazar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => validateFreight.mutate({ shipmentId: shipment.id, approved: true })}
                          >
                            Confirmar Flete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>POs Pendientes de Asignación</CardTitle>
                  <CardDescription>Órdenes de compra cerradas sin agente asignado</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Refresh
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(unassignedPOs?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Todas las POs tienen agente asignado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO</TableHead>
                      <TableHead>Mercado</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Total USD</TableHead>
                      <TableHead className="text-center">Cerrada</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedPOs?.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{po.market_id?.slice(0, 8) || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{po.total_orders || 0}</TableCell>
                        <TableCell className="text-center">{po.total_quantity || 0}</TableCell>
                        <TableCell className="text-right">${(po.total_amount || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {po.closed_at ? format(new Date(po.closed_at), 'dd/MM HH:mm', { locale: es }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm"
                            onClick={() => autoAssignPO.mutate(po.id)}
                            disabled={autoAssignPO.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Auto-Asignar
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
    </AdminLayout>
  );
}
