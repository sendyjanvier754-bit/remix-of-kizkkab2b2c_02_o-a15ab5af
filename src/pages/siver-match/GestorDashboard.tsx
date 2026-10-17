/**
 * Gestor Dashboard - Browse stock, manage sales, earn commissions
 */

import { useState } from 'react';
import { useSiverMatch, StockLot, Assignment, MatchSale } from '@/hooks/useSiverMatch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLogisticsEngine } from '@/hooks/useLogisticsEngine';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign, 
  Star,
  Loader2,
  Plus,
  CheckCircle,
  Clock,
  MapPin,
  QrCode,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const GestorDashboard = () => {
  const { 
    useMyProfileByRole, 
    useAvailableStockLots,
    useMyAssignments,
    useMySales,
    usePendingReviews,
    requestAssignment,
    createSale,
    confirmDelivery,
  } = useSiverMatch();
  
  const { useDepartments, useCommunes } = useLogisticsEngine();
  const { data: departments } = useDepartments();

  const { data: profile, isLoading: loadingProfile } = useMyProfileByRole('gestor');
  const { data: availableLots } = useAvailableStockLots();
  const { data: assignments } = useMyAssignments('gestor');
  const { data: sales } = useMySales();
  const { data: pendingReviews } = usePendingReviews();

  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState<StockLot | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestNotes, setRequestNotes] = useState('');

  const [saleForm, setSaleForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    department_id: '',
    commune_id: '',
    delivery_address: '',
    quantity: 1,
    unit_price: 0,
  });

  const selectedDepartment = saleForm.department_id;
  const { data: communes } = useCommunes(selectedDepartment || undefined);

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
        <h1 className="text-2xl font-bold mb-4">No tienes perfil de gestor</h1>
        <Button asChild>
          <Link to="/siver-match">Crear perfil de gestor</Link>
        </Button>
      </div>
    );
  }

  // Stats
  const acceptedAssignments = assignments?.filter(a => a.status === 'accepted' || a.status === 'active') || [];
  const totalAvailableToSell = acceptedAssignments.reduce((sum, a) => sum + a.quantity_available, 0);
  const totalCommissionsEarned = sales?.filter(s => s.status === 'delivered').reduce((sum, s) => sum + s.gestor_commission, 0) || 0;
  const pendingSales = sales?.filter(s => ['pending_payment', 'payment_confirmed', 'ready_pickup', 'picked_up'].includes(s.status)).length || 0;

  const handleRequestAssignment = async () => {
    if (!selectedLot) return;
    
    try {
      await requestAssignment.mutateAsync({
        stockLotId: selectedLot.id,
        quantity: requestQuantity,
        notes: requestNotes || undefined,
      });
      setShowRequestDialog(false);
      setSelectedLot(null);
      setRequestQuantity(1);
      setRequestNotes('');
    } catch (error) {
      // Error handled
    }
  };

  const handleCreateSale = async () => {
    if (!selectedAssignment) return;
    
    try {
      await createSale.mutateAsync({
        assignment_id: selectedAssignment.id,
        customer_name: saleForm.customer_name,
        customer_phone: saleForm.customer_phone || undefined,
        customer_email: saleForm.customer_email || undefined,
        department_id: saleForm.department_id || undefined,
        commune_id: saleForm.commune_id || undefined,
        delivery_address: saleForm.delivery_address || undefined,
        quantity: saleForm.quantity,
        unit_price: saleForm.unit_price,
      });
      setShowSaleDialog(false);
      setSelectedAssignment(null);
      setSaleForm({
        customer_name: '', customer_phone: '', customer_email: '',
        department_id: '', commune_id: '', delivery_address: '',
        quantity: 1, unit_price: 0,
      });
    } catch (error) {
      // Error handled
    }
  };

  const openSaleDialog = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSaleForm(prev => ({
      ...prev,
      unit_price: assignment.stock_lot?.suggested_price || 0,
    }));
    setShowSaleDialog(true);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Portal Gestor</h1>
          <p className="text-muted-foreground">Bienvenido, {profile.display_name}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile.average_rating > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {profile.average_rating.toFixed(1)}
            </Badge>
          )}
          <Badge variant="outline">
            {profile.current_pending_orders}/{profile.max_pending_orders} órdenes
          </Badge>
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
                <p className="text-sm text-amber-600">Califica a tus inversores para continuar operando</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAvailableToSell}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comisiones Ganadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalCommissionsEarned.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sales?.filter(s => s.status === 'delivered').length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingSales}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-2">
            <Package className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Mi Inventario
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Mis Ventas
          </TabsTrigger>
        </TabsList>

        {/* Catalog Tab */}
        <TabsContent value="catalog">
          <Card>
            <CardHeader>
              <CardTitle>Stock Disponible</CardTitle>
              <CardDescription>Explora los productos publicados por inversores</CardDescription>
            </CardHeader>
            <CardContent>
              {!availableLots?.length ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin productos disponibles</h3>
                  <p className="text-muted-foreground">Los inversores aún no han publicado stock</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableLots.map((lot) => (
                    <Card key={lot.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted relative">
                        {lot.product_image ? (
                          <img src={lot.product_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <Badge className="absolute top-2 right-2 bg-green-500">
                          {lot.available_quantity} disponibles
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-1">{lot.product_name}</h3>
                        {(lot.color || lot.size) && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {[lot.color, lot.size].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mb-3">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={lot.investor?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {lot.investor?.display_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {lot.investor?.display_name}
                          </span>
                          {lot.investor?.average_rating > 0 && (
                            <span className="flex items-center gap-1 text-xs">
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {lot.investor.average_rating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Precio sugerido</p>
                            <p className="font-bold text-lg">${lot.suggested_price}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Tu comisión</p>
                            <p className="font-bold text-lg text-green-600">${lot.gestor_commission_per_unit}/u</p>
                          </div>
                        </div>

                        <Button 
                          className="w-full" 
                          onClick={() => {
                            setSelectedLot(lot);
                            setShowRequestDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Solicitar Vender
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Mi Inventario Asignado</CardTitle>
              <CardDescription>Productos que puedes vender</CardDescription>
            </CardHeader>
            <CardContent>
              {!acceptedAssignments?.length ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin inventario asignado</h3>
                  <p className="text-muted-foreground">Solicita productos del catálogo para comenzar a vender</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {acceptedAssignments.map((assignment) => (
                    <Card key={assignment.id} className="border-l-4 border-l-green-500">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {assignment.stock_lot?.product_image ? (
                              <img 
                                src={assignment.stock_lot.product_image} 
                                alt="" 
                                className="w-16 h-16 rounded object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{assignment.stock_lot?.product_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {assignment.quantity_available} disponibles de {assignment.quantity_assigned}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  ${assignment.stock_lot?.suggested_price} precio
                                </Badge>
                                <Badge className="text-xs bg-green-100 text-green-600">
                                  ${assignment.stock_lot?.gestor_commission_per_unit} comisión
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={() => openSaleDialog(assignment)}
                            disabled={assignment.quantity_available === 0}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Registrar Venta
                          </Button>
                        </div>
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
              <CardTitle>Mis Ventas</CardTitle>
              <CardDescription>Historial y estado de tus ventas</CardDescription>
            </CardHeader>
            <CardContent>
              {!sales?.length ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sin ventas aún</h3>
                  <p className="text-muted-foreground">Tus ventas aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <Card key={sale.id} className={`border-l-4 ${
                      sale.status === 'delivered' ? 'border-l-green-500' :
                      sale.status === 'payment_confirmed' ? 'border-l-blue-500' :
                      sale.status === 'pending_payment' ? 'border-l-amber-500' :
                      'border-l-gray-300'
                    }`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm">{sale.sale_number}</p>
                            <p className="font-medium">{sale.customer_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {sale.quantity} unidades × ${sale.unit_price} = ${sale.total_amount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <Badge className={
                              sale.status === 'delivered' ? 'bg-green-100 text-green-600' :
                              sale.status === 'payment_confirmed' ? 'bg-blue-100 text-blue-600' :
                              sale.status === 'pending_payment' ? 'bg-amber-100 text-amber-600' :
                              sale.status === 'ready_pickup' ? 'bg-purple-100 text-purple-600' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {sale.status === 'delivered' ? 'Entregado' :
                               sale.status === 'payment_confirmed' ? 'Pago Confirmado' :
                               sale.status === 'pending_payment' ? 'Pendiente Pago' :
                               sale.status === 'ready_pickup' ? 'Listo Recoger' :
                               sale.status}
                            </Badge>
                            <p className="text-lg font-bold text-green-600 mt-2">
                              ${sale.gestor_commission} comisión
                            </p>
                            
                            {sale.status === 'payment_confirmed' && sale.pickup_code && (
                              <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                                <p className="text-xs text-purple-600">Código de recogida:</p>
                                <p className="font-mono font-bold text-purple-700">{sale.pickup_code}</p>
                              </div>
                            )}
                            
                            {sale.status === 'picked_up' && (
                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() => confirmDelivery.mutate(sale.id)}
                                disabled={confirmDelivery.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirmar Entrega
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Assignment Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Vender</DialogTitle>
            <DialogDescription>
              Solicita al inversor permiso para vender este producto
            </DialogDescription>
          </DialogHeader>

          {selectedLot && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                {selectedLot.product_image ? (
                  <img src={selectedLot.product_image} alt="" className="w-16 h-16 rounded object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded bg-background flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedLot.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLot.available_quantity} disponibles
                  </p>
                  <p className="text-sm text-green-600 font-medium">
                    ${selectedLot.gestor_commission_per_unit} comisión/unidad
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cantidad a solicitar</Label>
                <Input
                  type="number"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(Math.min(Number(e.target.value), selectedLot.available_quantity))}
                  min={1}
                  max={selectedLot.available_quantity}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensaje al inversor (opcional)</Label>
                <Textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Cuéntale al inversor por qué eres buen gestor..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRequestAssignment}
              disabled={!requestQuantity || requestAssignment.isPending}
            >
              {requestAssignment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sale Dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
            <DialogDescription>
              Registra la venta de un producto a tu cliente
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedAssignment.stock_lot?.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAssignment.quantity_available} unidades disponibles
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nombre del cliente *</Label>
                <Input
                  value={saleForm.customer_name}
                  onChange={(e) => setSaleForm(prev => ({ ...prev, customer_name: e.target.value }))}
                  placeholder="Nombre completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={saleForm.customer_phone}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="+509..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={saleForm.customer_email}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, customer_email: e.target.value }))}
                    placeholder="cliente@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={saleForm.department_id}
                    onValueChange={(v) => setSaleForm(prev => ({ ...prev, department_id: v, commune_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comuna</Label>
                  <Select
                    value={saleForm.commune_id}
                    onValueChange={(v) => setSaleForm(prev => ({ ...prev, commune_id: v }))}
                    disabled={!saleForm.department_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {communes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dirección de entrega</Label>
                <Input
                  value={saleForm.delivery_address}
                  onChange={(e) => setSaleForm(prev => ({ ...prev, delivery_address: e.target.value }))}
                  placeholder="Calle, número, referencias..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad *</Label>
                  <Input
                    type="number"
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm(prev => ({ 
                      ...prev, 
                      quantity: Math.min(Number(e.target.value), selectedAssignment.quantity_available) 
                    }))}
                    min={1}
                    max={selectedAssignment.quantity_available}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio unitario ($) *</Label>
                  <Input
                    type="number"
                    value={saleForm.unit_price || ''}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, unit_price: Number(e.target.value) }))}
                    min={selectedAssignment.stock_lot?.min_price || 0}
                    step={0.01}
                  />
                </div>
              </div>

              {/* Sale Preview */}
              {saleForm.quantity > 0 && saleForm.unit_price > 0 && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-3 text-sm">
                    <p className="font-medium mb-2 text-green-800">Resumen de la venta:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Total venta:</span>
                        <span>${(saleForm.quantity * saleForm.unit_price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-700 font-bold">
                        <span>Tu comisión:</span>
                        <span>${(saleForm.quantity * (selectedAssignment.stock_lot?.gestor_commission_per_unit || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-amber-700">
                  <p className="font-medium">Importante:</p>
                  <p>El cliente debe pagar a Siver Market. El código de recogida solo se genera cuando el pago es confirmado.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaleDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateSale}
              disabled={!saleForm.customer_name || !saleForm.quantity || !saleForm.unit_price || createSale.isPending}
            >
              {createSale.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Registrar Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestorDashboard;
