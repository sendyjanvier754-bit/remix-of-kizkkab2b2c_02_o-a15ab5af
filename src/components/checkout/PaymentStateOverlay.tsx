/**
 * Payment State Overlay Component
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, X,
  Smartphone, Building2, QrCode, Copy, PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrderPaymentState, PaymentStatus, ActiveOrder } from '@/hooks/useOrderPaymentState';
import { useTranslation } from 'react-i18next';

interface PaymentStateOverlayProps {
  onContinue?: () => void;
  onCancel?: () => void;
}

export const PaymentStateOverlay = ({ onContinue, onCancel }: PaymentStateOverlayProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeOrder, isLoading, timeRemaining, cancelOrder, retryPayment, confirmPayment } = useOrderPaymentState();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (activeOrder?.payment_status === 'paid') {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeOrder?.payment_status]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md mx-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('paymentOverlay.verifyingOrder')}</p>
        </Card>
      </div>
    );
  }

  if (!activeOrder) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    if (activeOrder) { await cancelOrder(activeOrder.id); onCancel?.(); }
  };

  const handleRetry = async () => {
    if (activeOrder) { await retryPayment(activeOrder.id); onContinue?.(); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('paymentOverlay.copiedClipboard'));
  };

  // Pending state
  if (activeOrder.payment_status === 'pending') {
    const progress = timeRemaining ? ((1800 - timeRemaining) / 1800) * 100 : 0;
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('paymentOverlay.processingPayment')}</h2>
            <p className="text-muted-foreground">{t('paymentOverlay.waitingBank')}</p>
          </div>
          {timeRemaining !== null && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {t('paymentOverlay.timeRemaining')}: <strong>{formatTime(timeRemaining)}</strong>
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">{t('paymentOverlay.stockReserved30')}</p>
            </div>
          )}
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm font-medium">{t('paymentOverlay.order')}</p>
            <p className="font-mono text-lg">{activeOrder.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-lg font-bold mt-2">${activeOrder.total_amount.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />{t('paymentOverlay.cancel')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Pending Validation
  if (activeOrder.payment_status === 'pending_validation') {
    const isMonCash = activeOrder.payment_method === 'moncash';
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <Card className="p-6 md:p-8 max-w-md w-full my-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {isMonCash ? <Smartphone className="h-10 w-10 text-orange-600" /> : <Building2 className="h-10 w-10 text-green-600" />}
            </div>
            <Badge className="bg-yellow-100 text-yellow-800 mb-2">{t('paymentOverlay.pendingValidation')}</Badge>
            <h2 className="text-xl font-bold">
              {isMonCash ? t('paymentOverlay.monCashPayment') : t('paymentOverlay.bankTransfer')}
            </h2>
          </div>
          {timeRemaining !== null && (
            <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                {t('paymentOverlay.stockReservedFor')}: <strong>{formatTime(timeRemaining)}</strong>
              </span>
            </div>
          )}
          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground mb-1">{t('paymentOverlay.totalToPay')}</p>
            <p className="text-2xl font-bold">${activeOrder.total_amount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('paymentOverlay.order')}: {activeOrder.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {isMonCash ? (
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium">{t('paymentOverlay.sendPaymentTo')}</p>
              <div className="flex items-center justify-between p-3 bg-background border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">{t('paymentOverlay.number')}</p>
                  <p className="font-mono font-medium">+509 3XXX XXXX</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard('+509 3XXX XXXX')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-3 bg-background border rounded-lg">
                <p className="text-sm text-muted-foreground">{t('paymentOverlay.name')}</p>
                <p className="font-medium">Siver Market 509</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium">{t('paymentOverlay.transferData')}</p>
              <div className="p-3 bg-background border rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('paymentOverlay.bank')}</span>
                  <span className="font-medium">Banco Nacional de Haití</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('paymentOverlay.account')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">001-234567-89</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard('001-234567-89')}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('paymentOverlay.beneficiary')}</span>
                  <span className="font-medium">Siver Market 509 SRL</span>
                </div>
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-800">
              <strong>{t('paymentOverlay.orderReserved')}</strong><br />
              {t('paymentOverlay.orderReservedDesc')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>{t('paymentOverlay.cancelOrder')}</Button>
            <Button className="flex-1" onClick={() => navigate('/mis-compras')}>{t('paymentOverlay.viewMyOrders')}</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Paid state
  if (activeOrder.payment_status === 'paid') {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 animate-bounce"><PartyPopper className="h-8 w-8 text-yellow-500" /></div>
            <div className="absolute top-10 right-1/4 animate-bounce delay-100"><PartyPopper className="h-8 w-8 text-pink-500" /></div>
          </div>
        )}
        <Card className="p-8 text-center max-w-md w-full">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('paymentOverlay.paymentConfirmed')}</h2>
            <p className="text-muted-foreground">{t('paymentOverlay.orderProcessed')}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">{t('paymentOverlay.orderNumber')}</p>
            <p className="font-mono text-xl font-bold">{activeOrder.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-primary/10 rounded-lg"><QrCode className="h-16 w-16 text-primary" /></div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">{t('paymentOverlay.deliveryCode')}</p>
              <p className="font-mono text-lg font-bold">DEL-{activeOrder.id.slice(0, 6).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">{t('paymentOverlay.showCodeOnPickup')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/mis-compras')}>{t('paymentOverlay.viewOrders')}</Button>
            <Button className="flex-1" onClick={() => { onContinue?.(); navigate('/'); }}>{t('paymentOverlay.keepShopping')}</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Failed/Expired
  if (activeOrder.payment_status === 'failed' || activeOrder.payment_status === 'expired') {
    const isExpired = activeOrder.payment_status === 'expired';
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="mb-6">
            <div className={`w-20 h-20 ${isExpired ? 'bg-yellow-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isExpired ? <AlertTriangle className="h-10 w-10 text-yellow-600" /> : <XCircle className="h-10 w-10 text-red-600" />}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isExpired ? t('paymentOverlay.orderExpired') : t('paymentOverlay.paymentFailed')}
            </h2>
            <p className="text-muted-foreground">
              {isExpired ? t('paymentOverlay.expiredDesc') : t('paymentOverlay.failedDesc')}
            </p>
          </div>
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">{t('paymentOverlay.order')}</p>
            <p className="font-mono">{activeOrder.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-lg font-bold mt-2">${activeOrder.total_amount.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { onCancel?.(); navigate('/'); }}>{t('paymentOverlay.cancel')}</Button>
            <Button className="flex-1" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />{t('paymentOverlay.retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};
