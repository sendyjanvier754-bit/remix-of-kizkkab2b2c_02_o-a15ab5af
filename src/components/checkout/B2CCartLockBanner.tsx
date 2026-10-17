/**
 * B2C Cart Lock Banner
 * Shows when the buyer has a pending order awaiting payment validation.
 * Includes a payment proof upload so the buyer can submit their receipt.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { useActiveB2COrder, useCancelB2COrder } from '@/hooks/useB2COrders';
import { useTranslation } from 'react-i18next';
import { PaymentProofUpload } from '@/components/payments/PaymentProofUpload';
import { useQueryClient } from '@tanstack/react-query';

export const B2CCartLockBanner = () => {
  const { t } = useTranslation();
  const { activeOrder, isCartLocked, refreshActiveOrder } = useActiveB2COrder();
  const cancelOrder = useCancelB2COrder();
  const queryClient = useQueryClient();
  const [showProof, setShowProof] = useState(false);

  if (!isCartLocked || !activeOrder) return null;

  const handleCancel = async () => {
    if (activeOrder) await cancelOrder.mutateAsync(activeOrder.id);
  };

  const proofUrl = (activeOrder.metadata as any)?.payment_proof_url ?? null;
  const hasProof = !!proofUrl;

  return (
    <div className="border border-yellow-400 bg-yellow-50 rounded-lg mb-4 overflow-hidden">
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              {t('cartLock.cartLocked')}
            </p>
            <p className="text-xs text-yellow-700">
              {t('cartLock.pendingPaymentAmount', { amount: activeOrder.total_amount.toFixed(2) })}
              {' · '}
              <span className="capitalize font-medium">{activeOrder.payment_method}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle proof upload */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProof(v => !v)}
            className="border-yellow-500 text-yellow-700 hover:bg-yellow-100 gap-1"
          >
            <Upload className="h-3.5 w-3.5" />
            {hasProof ? 'Ver comprobante' : 'Subir comprobante'}
            {showProof ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelOrder.isPending}
            className="border-yellow-500 text-yellow-700 hover:bg-yellow-100"
          >
            {t('common.cancel')}
          </Button>

          <Button
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            onClick={() => {
              if (activeOrder?.id) {
                window.location.href = `/mis-compras?orderId=${activeOrder.id}`;
              } else {
                window.location.href = "/mis-compras";
              }
            }}
          >
            {t('cartLock.resumePayment')}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Expandable proof upload section */}
      {showProof && (
        <div className="border-t border-yellow-300 bg-yellow-50/80 px-4 pb-4 pt-3">
          <p className="text-xs font-medium text-yellow-800 mb-2">
            Adjunta el comprobante de pago para que el admin pueda verificarlo:
          </p>
          <PaymentProofUpload
            orderId={activeOrder.id}
            existingUrl={proofUrl}
            orderTable="orders_b2c"
            showReferenceInput
            onUploaded={() => {
              queryClient.invalidateQueries({ queryKey: ['buyer-b2c-orders'] });
              refreshActiveOrder();
            }}
          />
        </div>
      )}
    </div>
  );
};
