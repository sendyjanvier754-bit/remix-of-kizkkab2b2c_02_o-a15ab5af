/**
 * Investor Dashboard - Manage stock lots and view sales
 */

import { useState } from 'react';
import { useSiverMatch, StockLot, Assignment } from '@/hooks/useSiverMatch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Package, 
  Plus, 
  TrendingUp, 
  Users, 
  DollarSign, 
  CheckCircle, 
  Clock,
  Star,
  Eye,
  Loader2,
  Send,
  XCircle,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-blue-100 text-blue-600',
  assigned: 'bg-purple-100 text-purple-600',
  in_transit: 'bg-amber-100 text-amber-600',
  in_hub: 'bg-green-100 text-green-600',
  active: 'bg-emerald-100 text-emerald-600',
  depleted: 'bg-gray-200 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  assigned: 'Asignado',
  in_transit: 'En Tránsito',
  in_hub: 'En Hub',
  active: 'Activo',
  depleted: 'Agotado',
  cancelled: 'Cancelado',
};

const InvestorDashboard = () => {
  const { 
    useMyProfileByRole, 
    useMyStockLots, 
    useMyAssignments,
    useInvestorSales,
    usePendingReviews,
    createStockLot,
    publishStockLot,
    updateLotTracking,
    respondToAssignment,
  } = useSiverMatch();

  const { data: profile, isLoading: loadingProfile } = useMyProfileByRole('investor');
  const { data: stockLots, isLoading: loadingLots } = useMyStockLots();
  const { data: assignments } = useMyAssignments('investor');
  const { data: sales } = useInvestorSales();
  const { data: pendingReviews } = usePendingReviews();

  const [showNewLotDialog, setShowNewLotDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState<StockLot | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  
  const [newLot, setNewLot] = useState({
    product_name: '',
    product_image: '',
    sku: '',
    color: '',
    size: '',
    total_quantity: 0,
    cost_per_unit: 0,
    suggested_price: 0,
    min_price: 0,
    gestor_commission_per_unit: 0,
    notes: '',
  });

  const [trackingNumber, setTrackingNumber] = useState('');

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">No tienes perfil de inversor</h1>
        <Button asChild>
          <Link to="/siver-match">Crear perfil de inversor</Link>
        </Button>
      </div>
    );
  }

  // Stats
  const totalInvested = stockLots?.reduce((sum, lot) => sum + (lot.cost_per_unit * lot.total_quantity), 0) || 0;
  const totalSold = sales?.filter(s => s.status === 'delivered').reduce((sum, s) => sum + s.investor_amount, 0) || 0;
  const pendingAssignments = assignments?.filter(a => a.status === 'pending').length || 0;

  const handleCreateLot = async () => {
    try {
      await createStockLot.mutateAsync({
        product_name: newLot.product_name,
        product_image: newLot.product_image || undefined,
        sku: newLot.sku || undefined,
        color: newLot.color || undefined,
        size: newLot.size || undefined,
        total_quantity: newLot.total_quantity,
        cost_per_unit: newLot.cost_per_unit,
        suggested_price: newLot.suggested_price,
        min_price: newLot.min_price || undefined,
        gestor_commission_per_unit: newLot.gestor_commission_per_unit,
        notes: newLot.notes || undefined,
      });
      setShowNewLotDialog(false);
      setNewLot({
        product_name: '', product_image: '', sku: '', color: '', size: '',
        total_quantity: 0, cost_per_unit: 0, suggested_price: 0, min_price: 0,
        gestor_commission_per_unit: 0, notes: '',
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleUpdateTracking = async () => {
    if (!selectedLot || !trackingNumber) return;
    
    try {
      await updateLotTracking.mutateAsync({
        lotId: selectedLot.id,
        chinaTracking: trackingNumber,
        logisticsStage: 'in_china',
      });
      setShowTrackingDialog(false);
      setSelectedLot(null);
      setTrackingNumber('');
    } catch (error) {
      // Error handled
    }
  };

  const handleRespondAssignment = async (assignmentId: string, accept: boolean) => {
    try {
      await respondToAssignment.mutateAsync({ assignmentId, accept });
    } catch (error) {
      // Error handled
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Portal Inversor</h1>
          <p className="text-muted-foreground">Bienvenido, {profile.display_name}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile.average_rating > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {profile.average_rating.toFixed(1)}
            </Badge>
          )}
          <Button onClick={() => setShowNewLotDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lote
          </Button>
        </div>
      </div>

      {/* Pending Reviews Alert */}
      {pendingReviews && pendingReviews.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Tienes {pendingReviews.length} calificación(es) pendiente(s)</p>
                <p className="text-sm text-amber-600">Califica a tus gestores para continuar operando</p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto" asChild>
                <Link to="/siver-match/reviews">Calificar ahora</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInvested.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalSold.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lotes Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockLots?.filter(l => ['published', 'assigned', 'active'].includes(l.status)).length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitudes Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingAssignments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lots" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lots" className="gap-2">
            <Package className="h-4 w-4" />
            Mis Lotes
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Users className="h-4 w-4" />
            Solicitudes
            {pendingAssignments > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                {pendingAssignments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Ventas
          </TabsTrigger>
        </TabsList>

        {/* Stock Lots Tab */}
        <TabsContent value="lots">
          <Card>
            <CardHeader>
              <CardTitle>Mis Lotes de Stock</CardTitle>
              <CardDescription>Gestiona el inventario que tienes publicado</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLots ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !stockLots?.length ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin lotes todavía</h3>
                  <p className="text-muted-foreground mb-4">Crea tu primer lote de productos</p>
                  <Button onClick={() => setShowNewLotDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Lote
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio Sugerido</TableHead>
                      <TableHead>Comisión Gestor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {lot.product_image ? (
                              <img src={lot.product_image} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{lot.product_name}</p>
                              {(lot.color || lot.size) && (
                                <p className="text-xs text-muted-foreground">
                                  {[lot.color, lot.size].filter(Boolean).join(' / ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{lot.available_quantity}</span>
                            <span className="text-muted-foreground">/{lot.total_quantity}</span>
                          </div>
                          {lot.sold_quantity > 0 && (
                            <p className="text-xs text-green-600">{lot.sold_quantity} vendidos</p>
                          )}
                        </TableCell>
                        <TableCell>${lot.suggested_price}</TableCell>
                        <TableCell>${lot.gestor_commission_per_unit}/u</TableCell>
                        <TableCell>
                          <Badge className={statusColors[lot.status]}>
                            {statusLabels[lot.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {lot.status === 'draft' && (
                              <Button 
                                size="sm" 
                                onClick={() => publishStockLot.mutate(lot.id)}
                                disabled={publishStockLot.isPending}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Publicar
                              </Button>
                            )}
                            {lot.status === 'published' && !lot.china_tracking_number && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedLot(lot);
                                  setShowTrackingDialog(true);
                                }}
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Tracking
                              </Button>
                            )}
                            {lot.china_tracking_number && (
                              <Badge variant="outline" className="text-xs">
                                {lot.china_tracking_number}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes de Gestores</CardTitle>
              <CardDescription>Revisa y aprueba solicitudes de gestores que quieren vender tu stock</CardDescription>
            </CardHeader>
            <CardContent>
              {!assignments?.length ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin solicitudes</h3>
                  <p className="text-muted-foreground">Los gestores aún no han solicitado vender tu stock</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <Card key={assignment.id} className={`border-l-4 ${
                      assignment.status === 'pending' ? 'border-l-amber-500' :
                      assignment.status === 'accepted' ? 'border-l-green-500' :
                      assignment.status === 'rejected' ? 'border-l-red-500' :
                      'border-l-gray-300'
                    }`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={assignment.gestor?.avatar_url} />
                              <AvatarFallback>{assignment.gestor?.display_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{assignment.gestor?.display_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {assignment.gestor?.average_rating > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    {assignment.gestor.average_rating.toFixed(1)}
                                  </span>
                                )}
                                <span>•</span>
                                <span>{assignment.quantity_assigned} unidades solicitadas</span>
                              </div>
                            </div>
                          </div>
                          
                          {assignment.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleRespondAssignment(assignment.id, false)}
                                disabled={respondToAssignment.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rechazar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRespondAssignment(assignment.id, true)}
                                disabled={respondToAssignment.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Aceptar
                              </Button>
                            </div>
                          )}
                          
                          {assignment.status !== 'pending' && (
                            <Badge className={
                              assignment.status === 'accepted' ? 'bg-green-100 text-green-600' :
                              assignment.status === 'rejected' ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {assignment.status === 'accepted' ? 'Aceptado' :
                               assignment.status === 'rejected' ? 'Rechazado' :
                               assignment.status}
                            </Badge>
                          )}
                        </div>
                        
                        {assignment.gestor_notes && (
                          <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            "{assignment.gestor_notes}"
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Ventas de mis Productos</CardTitle>
              <CardDescription>Historial de ventas realizadas por gestores</CardDescription>
            </CardHeader>
            <CardContent>
              {!sales?.length ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin ventas aún</h3>
                  <p className="text-muted-foreground">Las ventas de tus productos aparecerán aquí</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Gestor</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Tu Ganancia</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <p className="font-mono text-sm">{sale.sale_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.created_at), 'd MMM yyyy', { locale: es })}
                          </p>
                        </TableCell>
                        <TableCell>{sale.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={sale.gestor?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {sale.gestor?.display_name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{sale.gestor?.display_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          ${sale.investor_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            sale.status === 'delivered' ? 'bg-green-100 text-green-600' :
                            sale.status === 'payment_confirmed' ? 'bg-blue-100 text-blue-600' :
                            'bg-gray-100 text-gray-600'
                          }>
                            {sale.status === 'delivered' ? 'Entregado' :
                             sale.status === 'payment_confirmed' ? 'Pago Confirmado' :
                             sale.status}
                          </Badge>
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

      {/* New Lot Dialog */}
      <Dialog open={showNewLotDialog} onOpenChange={setShowNewLotDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Lote</DialogTitle>
            <DialogDescription>
              Define los detalles del lote de productos que deseas publicar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del producto *</Label>
              <Input
                value={newLot.product_name}
                onChange={(e) => setNewLot(prev => ({ ...prev, product_name: e.target.value }))}
                placeholder="Ej: Jean Skinny Mujer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  value={newLot.color}
                  onChange={(e) => setNewLot(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="Negro, Azul..."
                />
              </div>
              <div className="space-y-2">
                <Label>Talla</Label>
                <Input
                  value={newLot.size}
                  onChange={(e) => setNewLot(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="S, M, L, XL..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL de imagen</Label>
              <Input
                value={newLot.product_image}
                onChange={(e) => setNewLot(prev => ({ ...prev, product_image: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad total *</Label>
                <Input
                  type="number"
                  value={newLot.total_quantity || ''}
                  onChange={(e) => setNewLot(prev => ({ ...prev, total_quantity: Number(e.target.value) }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Costo por unidad ($) *</Label>
                <Input
                  type="number"
                  value={newLot.cost_per_unit || ''}
                  onChange={(e) => setNewLot(prev => ({ ...prev, cost_per_unit: Number(e.target.value) }))}
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio sugerido ($) *</Label>
                <Input
                  type="number"
                  value={newLot.suggested_price || ''}
                  onChange={(e) => setNewLot(prev => ({ ...prev, suggested_price: Number(e.target.value) }))}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label>Comisión gestor ($/u) *</Label>
                <Input
                  type="number"
                  value={newLot.gestor_commission_per_unit || ''}
                  onChange={(e) => setNewLot(prev => ({ ...prev, gestor_commission_per_unit: Number(e.target.value) }))}
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                value={newLot.notes}
                onChange={(e) => setNewLot(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Instrucciones especiales, características..."
                rows={2}
              />
            </div>

            {/* Preview */}
            {newLot.suggested_price > 0 && newLot.gestor_commission_per_unit > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="py-3 text-sm">
                  <p className="font-medium mb-2">Vista previa de ganancias:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Precio venta:</span>
                      <span>${newLot.suggested_price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>- Comisión gestor:</span>
                      <span>-${newLot.gestor_commission_per_unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>- Fee Siver (5%):</span>
                      <span>-${(newLot.suggested_price * 0.05).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>Tu ganancia/u:</span>
                      <span className="text-green-600">
                        ${(newLot.suggested_price - newLot.gestor_commission_per_unit - (newLot.suggested_price * 0.05)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLotDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateLot}
              disabled={!newLot.product_name || !newLot.total_quantity || !newLot.cost_per_unit || !newLot.suggested_price || !newLot.gestor_commission_per_unit || createStockLot.isPending}
            >
              {createStockLot.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar Tracking de China</DialogTitle>
            <DialogDescription>
              Ingresa el número de seguimiento del envío desde China
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Número de tracking</Label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="SF1234567890"
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateTracking}
              disabled={!trackingNumber || updateLotTracking.isPending}
            >
              {updateLotTracking.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestorDashboard;
