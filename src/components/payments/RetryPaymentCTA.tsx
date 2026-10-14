import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetryPaymentDialog } from './RetryPaymentDialog';

interface Props {
  orderId: string;
  orderType: 'b2b' | 'b2c';
  amount: number;
  currency?: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  orderStatus?: string | null;
  compact?: boolean;
}

/** Shows a "Retry payment" action for failed / unpaid card orders. */
export function shouldOfferRetry(paymentStatus?: string | null, paymentMethod?: string | null, orderStatus?: string | null) {
  if (orderStatus === 'cancelled' || paymentStatus === 'paid' || paymentStatus === 'pending_validation') return false;
  if (paymentStatus === 'failed' || paymentStatus === 'expired') return true;
  return paymentMethod === 'stripe' && (paymentStatus === 'pending' || !paymentStatus);
}

export function RetryPaymentCTA({ orderId, orderType, amount, currency, paymentStatus, paymentMethod, orderStatus, compact }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!shouldOfferRetry(paymentStatus, paymentMethod, orderStatus)) return null;

  const dialog = (
    <RetryPaymentDialog open={open} onOpenChange={setOpen} orderId={orderId} orderType={orderType} amount={amount} currency={currency} />
  );

  if (compact) {
    return (
      <>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t('retryPayment.button')}
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex gap-2 text-sm">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <p>{t('retryPayment.failedNotice')}</p>
      </div>
      <Button className="w-full" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4 mr-2" /> {t('retryPayment.button')}
      </Button>
      {dialog}
    </div>
  );
}

export default RetryPaymentCTA;
