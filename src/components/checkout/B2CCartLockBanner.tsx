/**
 * B2C Cart Lock Banner Component
 */

import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight } from 'lucide-react';
import { useActiveB2COrder, useCancelB2COrder } from '@/hooks/useB2COrders';
import { useTranslation } from 'react-i18next';

export const B2CCartLockBanner = () => {
  const { t } = useTranslation();
  const { activeOrder, isCartLocked } = useActiveB2COrder();
  const cancelOrder = useCancelB2COrder();

  if (!isCartLocked || !activeOrder) return null;

  const handleCancel = async () => {
    if (activeOrder) await cancelOrder.mutateAsync(activeOrder.id);
  };

  return (
    <Alert className="border-yellow-500 bg-yellow-50 mb-4">
      <Lock className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800">
            <strong>{t('cartLock.cartLocked')}</strong> {t('cartLock.pendingPaymentAmount', { amount: activeOrder.total_amount.toFixed(2) })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelOrder.isPending} className="border-yellow-500 text-yellow-700 hover:bg-yellow-100">
            {t('common.cancel')}
          </Button>
          <Button asChild size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
            <Link to="/checkout">
              {t('cartLock.resumePayment')}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
