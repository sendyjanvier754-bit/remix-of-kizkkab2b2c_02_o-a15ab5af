import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, Plus, Link2, Video, Upload, Package, 
  Clock, CheckCircle2, AlertTriangle, ExternalLink 
} from 'lucide-react';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface AgentProfile {
  id: string;
  user_id: string;
  agent_code: string;
  full_name: string;
}

interface PurchasingAgentPurchasesProps {
  agentProfile: AgentProfile;
  selectedPOId: string | null;
  onSelectPO: (poId: string | null) => void;
}

export function PurchasingAgentPurchases({ agentProfile, selectedPOId, onSelectPO }: PurchasingAgentPurchasesProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [cartLinkOpen, setCartLinkOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [newPlatform, setNewPlatform] = useState<'1688' | 'alibaba' | 'taobao' | 'other'>('1688');
  const [cartScreencastUrl, setCartScreencastUrl] = useState('');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [supplierOrderId, setSupplierOrderId] = useState('');

  const { 
    useAgentAssignments, 
    usePOPurchases, 
    createPurchase, 
    updatePurchaseCart,
    uploadFile 
  } = usePurchasingAgent();
  
  const { data: assignments } = useAgentAssignments(agentProfile.id);
  const { data: purchases, isLoading } = usePOPurchases(selectedPOId);

  const handleCreatePurchase = async () => {
    if (!selectedPOId) {
      toast.error('Selecciona una PO primero');
      return;
    }
    try {
      await createPurchase.mutateAsync({
        poId: selectedPOId,
        agentId: agentProfile.id,
        sourcePlatform: newPlatform,
      });
      setCreateOpen(false);
      toast.success('Compra creada exitosamente');
    } catch (error) {
      toast.error('Error al crear la compra');
    }
  };

  const handleUpdateCartInfo = async () => {
    if (!selectedPurchase) return;
    try {
      await updatePurchaseCart.mutateAsync({
        purchaseId: selectedPurchase.id,
        cartScreencastUrl,
        paymentLinkUrl,
        supplierOrderId,
      });
      setCartLinkOpen(false);
      setSelectedPurchase(null);
      toast.success('Información actualizada');
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      cart_uploaded: { variant: 'outline', label: 'Cart Subido' },
      awaiting_payment: { variant: 'outline', label: 'Esperando Pago' },
      paid: { variant: 'default', label: 'Pagado' },
      received: { variant: 'default', label: 'Recibido' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!selectedPOId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seleccionar PO</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {assignments?.map(assignment => (
                    <button
                      key={assignment.id}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      onClick={() => onSelectPO(assignment.po_id)}
                    >
                      <p className="font-medium">{assignment.po?.po_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.po?.total_orders} pedidos
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Selecciona una PO</h3>
              <p>Elige una PO de la lista para gestionar sus compras</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Gestión de Compras</h2>
          <p className="text-muted-foreground">
            PO: {assignments?.find(a => a.po_id === selectedPOId)?.po?.po_number}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Compra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Compra</DialogTitle>
              <DialogDescription>
                Registra una nueva compra para esta orden de compra
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Plataforma de Compra</Label>
                <Select value={newPlatform} onValueChange={(v) => setNewPlatform(v as any)}>
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
              <Button onClick={handleCreatePurchase} className="w-full" disabled={createPurchase.isPending}>
                {createPurchase.isPending ? 'Creando...' : 'Crear Compra'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Purchases Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : purchases?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay compras registradas</p>
            <p className="text-sm">Crea una nueva compra para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {purchases?.map((purchase: any) => (
            <Card key={purchase.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{purchase.purchase_code}</CardTitle>
                  {getStatusBadge(purchase.status)}
                </div>
                <CardDescription>
                  {purchase.source_platform} • {format(new Date(purchase.created_at), "dd MMM yyyy", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cart Screencast Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Screencast
                  </span>
                  {purchase.cart_screencast_url ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>

                {/* Payment Link Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Link de Pago
                  </span>
                  {purchase.payment_link_url ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>

                {/* Supplier Order ID */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    ID Proveedor
                  </span>
                  {purchase.supplier_order_id ? (
                    <span className="font-mono text-xs">{purchase.supplier_order_id}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedPurchase(purchase);
                      setCartScreencastUrl(purchase.cart_screencast_url || '');
                      setPaymentLinkUrl(purchase.payment_link_url || '');
                      setSupplierOrderId(purchase.supplier_order_id || '');
                      setCartLinkOpen(true);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                  {purchase.payment_link_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(purchase.payment_link_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Update Cart Info Dialog */}
      <Dialog open={cartLinkOpen} onOpenChange={setCartLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Información de Compra</DialogTitle>
            <DialogDescription>
              Ingresa los datos del carrito y link de pago
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>URL del Screencast del Carrito</Label>
              <Input 
                placeholder="https://..." 
                value={cartScreencastUrl}
                onChange={(e) => setCartScreencastUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Video mostrando los productos en el carrito
              </p>
            </div>
            <div className="space-y-2">
              <Label>Link de Pago</Label>
              <Input 
                placeholder="https://..." 
                value={paymentLinkUrl}
                onChange={(e) => setPaymentLinkUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link oficial de pago de la plataforma
              </p>
            </div>
            <div className="space-y-2">
              <Label>ID de Orden del Proveedor</Label>
              <Input 
                placeholder="Número de orden..." 
                value={supplierOrderId}
                onChange={(e) => setSupplierOrderId(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleUpdateCartInfo} 
              className="w-full"
              disabled={updatePurchaseCart.isPending}
            >
              {updatePurchaseCart.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
