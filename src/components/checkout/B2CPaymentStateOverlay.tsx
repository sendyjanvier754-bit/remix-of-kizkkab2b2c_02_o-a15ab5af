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
  Upload,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
    toast.success(t('toasts.copiedToClipboard'));
  };

  const moncashDetails = {
    number: getValue('contact_phone') || '+509 3XXX XXXX',
    name: platformName,
  };

  const bankDetails = {
    bank: t('cartExtra.nationalBankHaiti'),
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
        <h2 className="text-xl font-bold mb-2">{t('cartExtra.processingPayment')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('cartExtra.waitingBankConfirmation')}
        </p>
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            <strong>{t('cartExtra.orderLabel')}:</strong> {order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-sm text-blue-800">
            <strong>{t('common.total')}:</strong> ${order.total_amount.toFixed(2)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onCancelOrder}
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          {t('cartExtra.cancelOrder')}
        </Button>
      </Card>
    );
  }

  // Pending Validation - MonCash/Transfer (estilo SellerCheckout)
  if (order.payment_status === 'pending_validation') {
    const isMonCash = order.payment_method === 'moncash';
    const methodLabel = isMonCash ? 'MonCash' : t('payments.bankTransfer');

    return (
      <>
        <Card className="p-8 text-center">
          <div className="mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('cartExtra.orderCreated')}</h1>
          <p className="text-muted-foreground mb-4">
            {t('cartExtra.orderCreatedMessage', { method: methodLabel })}
          </p>

          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground">{t('cartExtra.orderIdLabel')}</p>
            <p className="font-mono font-bold">{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-lg font-bold mt-2">${order.total_amount.toFixed(2)}</p>
          </div>

          <div className="text-left bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800">{t('cartExtra.pendingVerificationTitle')}</p>
                <p className="text-sm text-yellow-700 mt-1">
                  {t('cartExtra.payWithDetailsAndUpload')}
                </p>
              </div>
            </div>

            {isMonCash ? (
              <div className="space-y-2 text-sm pl-8">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-800">{t('cartExtra.moncashNumberLabel')}:</span>
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
                  <span className="text-yellow-800">{t('cartExtra.nameLabel')}:</span>
                  <span className="font-semibold">{moncashDetails.name}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm pl-8">
                <div className="flex justify-between">
                  <span className="text-yellow-800">{t('cartExtra.bankLabel')}:</span>
                  <span className="font-semibold">{bankDetails.bank}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-800">{t('cartExtra.accountLabel')}:</span>
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
                  <span className="text-yellow-800">{t('cartExtra.beneficiaryLabel')}:</span>
                  <span className="font-semibold">{bankDetails.beneficiary}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              onClick={onCancelOrder}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => setProofModalOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('cartExtra.iAlreadyPaid')}
            </Button>
          </div>
        </Card>

        {/* Payment Proof Upload Modal */}
        <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-600" />
                {t('cartExtra.sendPaymentProof')}
              </DialogTitle>
              <DialogDescription>
                {t('cartExtra.uploadProofInstructions')}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              {/* Amount reminder */}
              <div className="bg-muted rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('cartExtra.totalPaid')}</span>
                <span className="font-bold text-lg">${order.total_amount.toFixed(2)}</span>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('cartExtra.attachProof')} *</p>
                <PaymentProofUpload
                  orderId={order.id}
                  existingUrl={proofUrl}
                  orderTable="orders_b2c"
                  showReferenceInput
                  onUploaded={(url) => setProofUrl(url)}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>{t('cartExtra.noteLabel')}:</strong> {t('cartExtra.pendingValidationNote')}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setProofModalOpen(false)}
                disabled={isConfirming}
              >
                {t('common.cancel')}
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
                {t('cartExtra.sendProof')}
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
        <h2 className="text-2xl font-bold mb-2">{t('cartExtra.paymentConfirmed')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('cartExtra.orderProcessedSuccessfully')}
        </p>

        <div className="bg-muted p-4 rounded-lg mb-6">
          <p className="text-sm text-muted-foreground">{t('cartExtra.orderIdLabel')}</p>
          <p className="font-mono font-bold text-lg">{order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/mis-compras')}>
            {t('cartExtra.viewMyOrders')}
          </Button>
          <Button onClick={() => navigate('/')} className="bg-[#071d7f] hover:bg-[#0a2a9f]">
            {t('cartExtra.continueShopping')}
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
          {order.payment_status === 'expired' ? t('cartExtra.orderExpired') : t('cartExtra.paymentFailed')}
        </h2>
        <p className="text-muted-foreground mb-6">
          {order.payment_status === 'expired'
            ? t('cartExtra.reservationExpiredMessage')
            : t('cartExtra.paymentFailedMessage')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/carrito')}>
            {t('cartExtra.backToCart')}
          </Button>
          <Button onClick={() => navigate('/')} className="bg-[#071d7f] hover:bg-[#0a2a9f]">
            {t('cartExtra.continueShopping')}
          </Button>
        </div>
      </Card>
    );
  }

  return null;
};
