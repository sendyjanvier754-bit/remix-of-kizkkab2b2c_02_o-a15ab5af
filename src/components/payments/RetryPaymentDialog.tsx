import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, Smartphone, Landmark, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { StripeCardForm } from './StripeCardForm';
import { PaymentProofUpload } from './PaymentProofUpload';

type Method = 'stripe' | 'moncash' | 'natcash' | 'bank_transfer';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  orderType: 'b2b' | 'b2c';
  amount: number;
  currency?: string;
  onPaid?: () => void;
}

export function RetryPaymentDialog({ open, onOpenChange, orderId, orderType, amount, currency = 'USD', onPaid }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method | null>(null);
  const [switching, setSwitching] = useState(false);
  const [done, setDone] = useState<'paid' | 'proof' | null>(null);
  const table = orderType === 'b2b' ? 'orders_b2b' : 'orders_b2c';

  const refresh = () => {
    ['buyer-b2b-orders', 'buyer-orders', 'buyer-b2c-orders', 'pending-payment-proofs'].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  };

  const choose = async (m: Method) => {
    setSwitching(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ payment_method: m, payment_status: 'pending' } as any)
        .eq('id', orderId);
      if (error) throw error;
      setMethod(m);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSwitching(false);
    }
  };

  const close = (o: boolean) => {
    if (!o) {
      setMethod(null);
      setDone(null);
      refresh();
    }
    onOpenChange(o);
  };

  const options: { key: Method; icon: typeof CreditCard; label: string; desc: string }[] = [
    { key: 'stripe', icon: CreditCard, label: t('retryPayment.card'), desc: t('retryPayment.cardDesc') },
    { key: 'moncash', icon: Smartphone, label: 'MonCash', desc: t('retryPayment.manualDesc') },
    { key: 'natcash', icon: Smartphone, label: 'NatCash', desc: t('retryPayment.manualDesc') },
    { key: 'bank_transfer', icon: Landmark, label: t('retryPayment.bank'), desc: t('retryPayment.manualDesc') },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t('retryPayment.title')}</DialogTitle>
          <DialogDescription>
            {t('retryPayment.subtitle')} · <span className="font-semibold text-foreground">${amount.toFixed(2)} {currency}</span>
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center text-center gap-3 py-6 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <p className="font-semibold text-lg">
              {done === 'paid' ? t('retryPayment.paidTitle') : t('retryPayment.proofTitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {done === 'paid' ? t('retryPayment.paidDesc') : t('retryPayment.proofDesc')}
            </p>
            <Button className="mt-2" onClick={() => close(false)}>{t('retryPayment.close')}</Button>
          </div>
        ) : !method ? (
          <div className="space-y-2">
            {options.map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                type="button"
                disabled={switching}
                onClick={() => choose(key)}
                className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {switching && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setMethod(null)} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('retryPayment.changeMethod')}
            </Button>
            {method === 'stripe' ? (
              <StripeCardForm
                orderId={orderId}
                orderType={orderType}
                amount={Math.max(0.5, amount)}
                currency="usd"
                onSuccess={() => {
                  setDone('paid');
                  refresh();
                  onPaid?.();
                }}
              />
            ) : (
              <PaymentProofUpload
                orderId={orderId}
                orderTable={table}
                showReferenceInput
                onUploaded={() => {
                  setDone('proof');
                  refresh();
                }}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RetryPaymentDialog;
