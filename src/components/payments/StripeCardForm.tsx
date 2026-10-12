import { useEffect, useState } from 'react';
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Lock, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStripeKey } from '@/hooks/usePublicStripeKey';

interface StripeCardFormProps {
  orderId?: string;
  orderIds?: string[];
  orderType: 'b2b' | 'b2c';
  amount: number;
  currency?: string;
  onSuccess: () => void;
  onError?: (err: string) => void;
}

const stripePromiseCache: Record<string, Promise<StripeJS | null>> = {};
function getStripe(pk: string) {
  if (!stripePromiseCache[pk]) stripePromiseCache[pk] = loadStripe(pk);
  return stripePromiseCache[pk];
}

function PaymentSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-11 w-full rounded-md" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md mt-2" />
    </div>
  );
}

function SecureFooter({ test }: { test: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 space-y-1 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        {t('stripeForm.secure', 'Pago cifrado y procesado de forma segura por Stripe')}
      </p>
      {test && (
        <p className="text-xs text-muted-foreground">
          {t('stripeForm.testMode', 'Modo de prueba')} · <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code>
        </p>
      )}
    </div>
  );
}

function InnerForm({ amount, currency, onSuccess, onError }: { amount: number; currency: string; onSuccess: () => void; onError?: (e: string) => void }) {
  const { t, i18n } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatted = new Intl.NumberFormat(i18n.language || 'es', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    setSubmitting(false);
    if (confirmErr) {
      const msg = confirmErr.message || t('stripeForm.genericError', 'No se pudo procesar el pago. Verifica los datos de tu tarjeta.');
      setError(msg);
      onError?.(msg);
      return;
    }
    if (paymentIntent && !['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) {
      const msg = t('stripeForm.notCompleted', 'El pago no se completó. Inténtalo de nuevo.');
      setError(msg);
      onError?.(msg);
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!ready && <PaymentSkeleton />}
      <div className={ready ? '' : 'hidden'}>
        <PaymentElement onReady={() => setReady(true)} options={{ layout: 'tabs' }} />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {ready && (
        <Button type="submit" disabled={!stripe || submitting} className="w-full" size="lg">
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('stripeForm.processing', 'Procesando pago seguro…')}</>
          ) : (
            <><Lock className="h-4 w-4 mr-2" /> {t('stripeForm.pay', 'Pagar {{amount}}', { amount: formatted })}</>
          )}
        </Button>
      )}
    </form>
  );
}

export function StripeCardForm(props: StripeCardFormProps) {
  const { t } = useTranslation();
  const { data: keyData, loading: keyLoading } = usePublicStripeKey();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [serverAmount, setServerAmount] = useState<number | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const ids = props.orderIds?.length ? props.orderIds : props.orderId ? [props.orderId] : [];
  const idsKey = ids.join(',');
  const currency = props.currency ?? 'usd';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInitError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: { order_ids: ids, order_type: props.orderType, currency },
        });
        if (cancelled) return;
        if (error || !data?.client_secret) throw error ?? new Error('no_secret');
        setClientSecret(data.client_secret);
        if (typeof data.amount === 'number') setServerAmount(data.amount);
      } catch {
        if (!cancelled) setInitError(t('stripeForm.initError', 'No pudimos conectar con el procesador de pagos. Inténtalo de nuevo.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, props.orderType, currency, attempt]);

  if (keyLoading || loading) return <PaymentSkeleton />;

  if (!keyData?.publishable_key) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('stripeForm.unavailable', 'El pago con tarjeta no está disponible en este momento. Elige otro método de pago.')}</AlertDescription>
      </Alert>
    );
  }

  if (initError || !clientSecret) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{initError}</AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('stripeForm.retry', 'Reintentar')}
        </Button>
      </div>
    );
  }

  return (
    <Elements
      stripe={getStripe(keyData.publishable_key)}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { borderRadius: '8px' } } }}
    >
      <InnerForm amount={serverAmount ?? props.amount} currency={currency} onSuccess={props.onSuccess} onError={props.onError} />
      <SecureFooter test={keyData.mode === 'test'} />
    </Elements>
  );
}

export default StripeCardForm;
