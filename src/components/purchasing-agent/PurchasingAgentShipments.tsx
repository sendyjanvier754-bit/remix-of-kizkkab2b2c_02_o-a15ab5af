import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Truck, Package, Scale, Ruler, Upload, DollarSign, 
  Plus, FileText, CheckCircle2, Clock, Link2, Image
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

interface PurchasingAgentShipmentsProps {
  agentProfile: AgentProfile;
  selectedPOId: string | null;
  onSelectPO: (poId: string | null) => void;
}

export function PurchasingAgentShipments({ agentProfile, selectedPOId, onSelectPO }: PurchasingAgentShipmentsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [freightOpen, setFreightOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  
  // Shipment form state
  const [actualWeight, setActualWeight] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [scalePhotoUrl, setScalePhotoUrl] = useState('');
  
  // Freight form state
  const [freightPaymentUrl, setFreightPaymentUrl] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);

  const { 
    useAgentAssignments, 
    usePOShipments, 
    usePOReconciliation,
    createShipment, 
    updateShipmentFreight,
    uploadTracking,
    uploadFile 
  } = usePurchasingAgent();
  
  const { data: assignments } = useAgentAssignments(agentProfile.id);
  const { data: shipments, isLoading } = usePOShipments(selectedPOId);
  const { data: reconciliation } = usePOReconciliation(selectedPOId);

  // Calculate volumetric weight
  const volumetricWeight = lengthCm && widthCm && heightCm 
    ? (parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / 5000 
    : 0;
  const billableWeight = Math.max(parseFloat(actualWeight) || 0, volumetricWeight);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file, 'scale-photos');
      setScalePhotoUrl(url);
      toast.success('Foto subida');
    } catch (error) {
      toast.error('Error al subir foto');
    }
  };

  const handleCreateShipment = async () => {
    if (!selectedPOId || !agentProfile) return;
    
    try {
      await createShipment.mutateAsync({
        poId: selectedPOId,
        agentId: agentProfile.id,
        weightKg: parseFloat(actualWeight),
        lengthCm: parseFloat(lengthCm),
        widthCm: parseFloat(widthCm),
        heightCm: parseFloat(heightCm),
        scalePhotoUrl,
        dimensionsPhotoUrl: scalePhotoUrl,
      });
      setCreateOpen(false);
      resetCreateForm();
      toast.success('Envío creado exitosamente');
    } catch (error) {
      toast.error('Error al crear envío');
    }
  };

  const handleUpdateFreight = async () => {
    if (!selectedShipment) return;
    
    try {
      await updateShipmentFreight.mutateAsync({
        shipmentId: selectedShipment.id,
        freightPaymentLink: freightPaymentUrl,
        actualShippingCostUsd: 0,
      });
      setFreightOpen(false);
      setSelectedShipment(null);
      toast.success('Link de pago actualizado');
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleUploadTracking = async (shipmentId: string) => {
    if (!trackingNumber) {
      toast.error('Ingresa el número de tracking');
      return;
    }
    
    try {
      await uploadTracking.mutateAsync({
        shipmentId,
        internationalTracking: trackingNumber,
        carrierName: '',
      });
      setTrackingNumber('');
      toast.success('Tracking actualizado');
    } catch (error) {
      toast.error('Error al actualizar tracking');
    }
  };

  const resetCreateForm = () => {
    setActualWeight('');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setScalePhotoUrl('');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Borrador' },
      awaiting_freight_payment: { variant: 'outline', label: 'Esperando Pago Flete' },
      freight_paid: { variant: 'outline', label: 'Flete Pagado' },
      in_transit: { variant: 'default', label: 'En Tránsito' },
      delivered: { variant: 'default', label: 'Entregado' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const canCreateShipment = reconciliation?.reconciliation_percent === 100;

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
              <Truck className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Envíos Internacionales</h3>
              <p>Selecciona una PO para gestionar sus envíos</p>
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
          <h2 className="text-xl font-bold">Envíos Internacionales</h2>
          <p className="text-muted-foreground">
            PO: {assignments?.find(a => a.po_id === selectedPOId)?.po?.po_number}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button 
            onClick={() => setCreateOpen(true)}
            disabled={!canCreateShipment}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Envío
          </Button>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Crear Envío Internacional</DialogTitle>
              <DialogDescription>
                Ingresa los datos del paquete consolidado
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Peso Real (KG)
                  </Label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                  />
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Peso Volumétrico</p>
                  <p className="text-xl font-bold">{volumetricWeight.toFixed(2)} KG</p>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Dimensiones (cm)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input 
                    type="number" 
                    placeholder="Largo"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                  />
                  <Input 
                    type="number" 
                    placeholder="Ancho"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                  />
                  <Input 
                    type="number" 
                    placeholder="Alto"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>
              </div>

              {/* Billable Weight */}
              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Peso Facturable</span>
                  <span className="text-2xl font-bold text-primary">{billableWeight.toFixed(2)} KG</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Se cobra el mayor entre peso real y volumétrico
                </p>
              </div>

              {/* Scale Photo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Foto de Báscula
                </Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {scalePhotoUrl ? 'Cambiar Foto' : 'Subir Foto'}
                </Button>
                {scalePhotoUrl && (
                  <div className="mt-2">
                    <img src={scalePhotoUrl} alt="Báscula" className="w-full h-32 object-cover rounded-lg" />
                  </div>
                )}
              </div>

              <Button 
                onClick={handleCreateShipment} 
                className="w-full"
                disabled={createShipment.isPending || !actualWeight || !scalePhotoUrl}
              >
                {createShipment.isPending ? 'Creando...' : 'Crear Envío'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reconciliation Warning */}
      {!canCreateShipment && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium">Conciliación Pendiente</p>
              <p className="text-sm text-muted-foreground">
                Debes completar el 100% del QC antes de crear un envío. 
                Progreso actual: {reconciliation?.reconciliation_percent?.toFixed(0) || 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shipments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : shipments?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay envíos registrados</p>
            <p className="text-sm">Completa el QC al 100% para crear un envío</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shipments?.map((shipment: any) => (
            <Card key={shipment.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{shipment.shipment_code}</CardTitle>
                  {getStatusBadge(shipment.status)}
                </div>
                <CardDescription>
                  {format(new Date(shipment.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Weight Info */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-xs text-muted-foreground">Real</p>
                    <p className="font-medium">{shipment.actual_weight_kg?.toFixed(2)} KG</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-xs text-muted-foreground">Volumétrico</p>
                    <p className="font-medium">{shipment.volumetric_weight_kg?.toFixed(2)} KG</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded text-center">
                    <p className="text-xs text-muted-foreground">Facturable</p>
                    <p className="font-bold text-primary">{shipment.billable_weight_kg?.toFixed(2)} KG</p>
                  </div>
                </div>

                {/* Tracking */}
                {shipment.tracking_number_international ? (
                  <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-mono">{shipment.tracking_number_international}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Número de tracking..."
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      size="sm"
                      onClick={() => handleUploadTracking(shipment.id)}
                      disabled={shipment.status !== 'freight_paid'}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Actions */}
                {shipment.status === 'awaiting_freight_payment' && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setSelectedShipment(shipment);
                      setFreightPaymentUrl(shipment.freight_payment_url || '');
                      setFreightOpen(true);
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Agregar Link de Pago de Flete
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Freight Payment Dialog */}
      <Dialog open={freightOpen} onOpenChange={setFreightOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de Pago de Flete</DialogTitle>
            <DialogDescription>
              Ingresa el link de pago del envío internacional
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>URL de Pago</Label>
              <Input 
                placeholder="https://..."
                value={freightPaymentUrl}
                onChange={(e) => setFreightPaymentUrl(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleUpdateFreight} 
              className="w-full"
              disabled={updateShipmentFreight.isPending}
            >
              {updateShipmentFreight.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
