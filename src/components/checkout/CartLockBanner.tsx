/**
 * Cart Lock Banner Component
 */

import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Clock, ArrowRight } from 'lucide-react';
import { useOrderPaymentState } from '@/hooks/useOrderPaymentState';
import { useTranslation } from 'react-i18next';

export const CartLockBanner = () => {
  const { t } = useTranslation();
  const { activeOrder, isCartLocked, timeRemaining, cancelOrder } = useOrderPaymentState();

  if (!isCartLocked || !activeOrder) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    if (activeOrder) await cancelOrder(activeOrder.id);
  };

  return (
    <Alert className="border-yellow-500 bg-yellow-50 mb-4">
      <Lock className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800">
            <strong>{t('cartLock.cartLocked')}</strong> {t('cartLock.pendingPayment')}
          </span>
          {timeRemaining !== null && (
            <span className="flex items-center gap-1 text-sm text-yellow-700">
              <Clock className="h-3 w-3" />
              {formatTime(timeRemaining)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} className="border-yellow-500 text-yellow-700 hover:bg-yellow-100">
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
