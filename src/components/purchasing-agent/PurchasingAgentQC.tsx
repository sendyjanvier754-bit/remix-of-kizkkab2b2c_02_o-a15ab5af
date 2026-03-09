import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, Camera, Video, CheckCircle2, XCircle, Package, 
  Upload, Image, AlertTriangle, Clock
} from 'lucide-react';
import { usePurchasingAgent } from '@/hooks/usePurchasingAgent';
import { toast } from 'sonner';

interface AgentProfile {
  id: string;
  user_id: string;
  agent_code: string;
  full_name: string;
}

interface PurchasingAgentQCProps {
  agentProfile: AgentProfile;
  selectedPOId: string | null;
  onSelectPO: (poId: string | null) => void;
}

export function PurchasingAgentQC({ agentProfile, selectedPOId, onSelectPO }: PurchasingAgentQCProps) {
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qcNotes, setQcNotes] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { useAgentAssignments, usePOPurchases, updateItemQC, uploadFile } = usePurchasingAgent();
  const { data: assignments } = useAgentAssignments(agentProfile.id);
  const { data: purchases } = usePOPurchases(selectedPOId);

  // Get all items from all purchases for this PO
  const allItems = purchases?.flatMap((p: any) => p.items || []) || [];
  const pendingItems = allItems.filter((item: any) => item.qc_status === 'pending' || item.qc_status === 'received');
  const approvedItems = allItems.filter((item: any) => item.qc_status === 'approved');
  const rejectedItems = allItems.filter((item: any) => item.qc_status === 'rejected');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const result = await uploadFile.mutateAsync({
          file,
          folder: `qc/${selectedItem?.id}`,
        });
        if (type === 'photo') {
          setUploadedPhotos(prev => [...prev, result.url]);
        } else {
          setUploadedVideos(prev => [...prev, result.url]);
        }
        toast.success('Archivo subido');
      } catch (error) {
        toast.error('Error al subir archivo');
      }
    }
  };

  const handleQCDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedItem) return;
    
    try {
      await updateItemQC.mutateAsync({
        itemId: selectedItem.id,
        status: decision,
        qcPhotos: uploadedPhotos,
        qcVideos: uploadedVideos,
        qcNotes,
      });
      setQcDialogOpen(false);
      setSelectedItem(null);
      setUploadedPhotos([]);
      setUploadedVideos([]);
      setQcNotes('');
      toast.success(decision === 'approved' ? 'Item aprobado' : 'Item rechazado');
    } catch (error) {
      toast.error('Error al actualizar QC');
    }
  };

  const getQCBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
      pending: { variant: 'secondary', label: 'Pendiente', icon: Clock },
      received: { variant: 'outline', label: 'Recibido', icon: Package },
      approved: { variant: 'default', label: 'Aprobado', icon: CheckCircle2 },
      rejected: { variant: 'destructive', label: 'Rechazado', icon: XCircle },
    };
    const config = variants[status] || { variant: 'outline', label: status, icon: AlertTriangle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
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
              <Eye className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Control de Calidad</h3>
              <p>Selecciona una PO para revisar sus items</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{allItems.length}</div>
            <p className="text-sm text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingItems.length}</div>
            <p className="text-sm text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-600">{approvedItems.length}</div>
            <p className="text-sm text-muted-foreground">Aprobados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-600">{rejectedItems.length}</div>
            <p className="text-sm text-muted-foreground">Rechazados</p>
          </CardContent>
        </Card>
      </div>

      {/* Items to Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Items Pendientes de QC
          </CardTitle>
          <CardDescription>Revisa y valida cada producto recibido</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay items pendientes de revisión</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingItems.map((item: any) => (
                <Card key={item.id} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product_name || 'Producto'}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                        <div className="mt-2">{getQCBadge(item.qc_status)}</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4" 
                      variant="outline"
                      onClick={() => {
                        setSelectedItem(item);
                        setQcDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Realizar QC
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Control de Calidad</DialogTitle>
            <DialogDescription>
              Sube fotos y videos del producto y registra tu decisión
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Product Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-medium">{selectedItem?.product_name || 'Producto'}</p>
              <p className="text-sm text-muted-foreground">SKU: {selectedItem?.sku} • Cantidad: {selectedItem?.quantity}</p>
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos del Producto
              </Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'photo')}
              />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir Fotos ({uploadedPhotos.length})
              </Button>
              {uploadedPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {uploadedPhotos.map((url, idx) => (
                    <div key={idx} className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                      <img src={url} alt={`QC ${idx}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Videos del Producto
              </Label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'video')}
              />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => videoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir Video ({uploadedVideos.length})
              </Button>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas de QC</Label>
              <Textarea 
                placeholder="Observaciones sobre el producto..."
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
              />
            </div>

            {/* Decision Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={() => handleQCDecision('rejected')}
                disabled={updateItemQC.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              <Button 
                className="flex-1"
                onClick={() => handleQCDecision('approved')}
                disabled={updateItemQC.isPending || uploadedPhotos.length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aprobar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
