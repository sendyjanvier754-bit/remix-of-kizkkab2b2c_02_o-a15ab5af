/**
 * B2C Payment State Overlay Component
 * Shows different UI based on payment status (pending, pending_validation, paid)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Check,
  XCircle,
  Copy,
  Smartphone,
  Building2,
  Upload,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';

interface B2CPaymentStateOverlayProps {
  order: {
    id: string;
    payment_status: string;
    payment_method: string | null;
    total_amount: number;
    metadata?: Record<string, any> | null;
  };
  onConfirmPayment: () => Promise<void>;
  onCancelOrder: () => Promise<void>;
}

export const B2CPaymentStateOverlay = ({
  order,
  onConfirmPayment,
  onCancelOrder,
}: B2CPaymentStateOverlayProps) => {
  const navigate = useNavigate();
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const [showConfetti, setShowConfetti] = useState(false);

  // Proof-upload modal state
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(
    order.metadata?.payment_proof_url ?? null
  );
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (order.payment_status === 'paid') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [order.payment_status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const moncashDetails = {
    number: getValue('contact_phone') || '+509 3XXX XXXX',
    name: platformName,
  };

  const bankDetails = {
    bank: 'Banco Nacional de Haití',
    account: '001-234567-89',
    beneficiary: `${platformName} SRL`,
  };

  const handleConfirmWithProof = async () => {
    setIsConfirming(true);
    try {
      await onConfirmPayment();
      setProofModalOpen(false);
    } catch (e) {
      // error handled upstream
    } finally {
      setIsConfirming(false);
    }
  };

  // Pending - Stripe (waiting for bank confirmation)
  if (order.payment_status === 'pending') {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Procesando Pago</h2>
        <p className="text-muted-foreground mb-4">
          Esperando confirmación bancaria...
        </p>
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            <strong>Orden:</strong> {order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Total:</strong> ${order.total_amount.toFixed(2)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onCancelOrder}
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          Cancelar Pedido
        </Button>
      </Card>
    );
  }

  // Pending Validation - MonCash/Transfer
  if (order.payment_status === 'pending_validation') {
    const isMonCash = order.payment_method === 'moncash';

    return (
      <>
        <Card className="p-6">
          <div className="text-center mb-6">
            {isMonCash ? (
              <Smartphone className="h-12 w-12 text-orange-600 mx-auto mb-2" />
            ) : (
              <Building2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
            )}
            <h2 className="text-xl font-bold mb-2">
              {isMonCash ? 'Pago con MonCash' : 'Transferencia Bancaria'}
            </h2>
            <p className="text-muted-foreground">
              Tu pedido está reservado. El vendedor está validando tu pago.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
            <p className="font-semibold text-yellow-800 mb-2">Instrucciones de Pago</p>

            {isMonCash ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Número MonCash:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{moncashDetails.number}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(moncashDetails.number)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Nombre:</span>
                  <span className="font-semibold">{moncashDetails.name}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Banco:</span>
                  <span className="font-semibold">{bankDetails.bank}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Cuenta:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{bankDetails.account}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(bankDetails.account)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Beneficiario:</span>
                  <span className="font-semibold">{bankDetails.beneficiary}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg mb-4 text-center">
            <p className="text-sm text-muted-foreground">Monto a Pagar</p>
            <p className="text-2xl font-bold text-primary">${order.total_amount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Orden: {order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          {/* If proof already uploaded, show it */}
          {proofUrl && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              Comprobante adjunto. El admin verificará tu pago pronto.
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancelOrder}
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setProofModalOpen(true)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Ya Realicé el Pago
            </Button>
          </div>
        </Card>

        {/* Payment Proof Upload Modal */}
        <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-600" />
                Confirmar Pago
              </DialogTitle>
              <DialogDescription>
                Sube el comprobante de tu pago (captura de pantalla o PDF). El admin lo verificará y confirmará tu pedido.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              {/* Amount reminder */}
              <div className="bg-muted rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total pagado</span>
                <span className="font-bold text-lg">${order.total_amount.toFixed(2)}</span>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Adjunta tu comprobante *</p>
                <PaymentProofUpload
                  orderId={order.id}
                  existingUrl={proofUrl}
                  orderTable="orders_b2c"
                  onUploaded={(url) => setProofUrl(url)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setProofModalOpen(false)}
                disabled={isConfirming}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmWithProof}
                disabled={isConfirming || !proofUrl}
                className="bg-green-600 hover:bg-green-700"
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Paid - Success with confetti
  if (order.payment_status === 'paid') {
    return (
      <Card className="p-8 text-center relative overflow-hidden">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="animate-bounce absolute top-4 left-1/4 w-3 h-3 bg-green-500 rounded-full" />
            <div className="animate-bounce absolute top-8 left-1/2 w-2 h-2 bg-blue-500 rounded-full" style={{ animationDelay: '0.1s' }} />
            <div className="animate-bounce absolute top-6 right-1/4 w-3 h-3 bg-yellow-500 rounded-full" style={{ animationDelay: '0.2s' }} />
          </div>
        )}

        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">¡Pago Confirmado!</h2>
        <p className="text-muted-foreground mb-4">
          Tu pedido ha sido procesado exitosamente.
        </p>

        <div className="bg-muted p-4 rounded-lg mb-6">
          <p className="text-sm text-muted-foreground">Número de Pedido</p>
          <p className="font-mono font-bold text-lg">{order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/mis-compras')}>
            Ver Mis Pedidos
          </Button>
          <Button onClick={() => navigate('/')} className="bg-[#071d7f] hover:bg-[#0a2a9f]">
            Seguir Comprando
          </Button>
        </div>
      </Card>
    );
  }

  // Failed/Expired
  if (order.payment_status === 'failed' || order.payment_status === 'expired') {
    return (
      <Card className="p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {order.payment_status === 'expired' ? 'Pedido Expirado' : 'Pago Fallido'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {order.payment_status === 'expired'
            ? 'El tiempo de reserva ha expirado. Los productos han vuelto al inventario.'
            : 'Hubo un problema procesando tu pago. Por favor intenta nuevamente.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/carrito')}>
            Volver al Carrito
          </Button>
          <Button onClick={() => navigate('/')} className="bg-[#071d7f] hover:bg-[#0a2a9f]">
            Seguir Comprando
          </Button>
        </div>
      </Card>
    );
  }

  return null;
};
