import { useEffect, useState } from 'react';
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStripeKey } from '@/hooks/usePublicStripeKey';
import { toast } from 'sonner';

interface StripeCardFormProps {
  orderId: string;
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

function InnerForm({ amount, onSuccess, onError }: Pick<StripeCardFormProps, 'amount' | 'onSuccess' | 'onError'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setSubmitting(false);
    if (confirmErr) {
      const msg = confirmErr.message || 'Error procesando el pago';
      setError(msg);
      onError?.(msg);
      toast.error(msg);
      return;
    }
    toast.success('Pago enviado. Confirmando…');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full" size="lg">
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
        ) : (
          <><CreditCard className="h-4 w-4 mr-2" /> Pagar ${amount.toFixed(2)}</>
        )}
      </Button>
    </form>
  );
}

export function StripeCardForm(props: StripeCardFormProps) {
  const { data: keyData, loading: keyLoading } = usePublicStripeKey();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            order_id: props.orderId,
            order_type: props.orderType,
            amount: props.amount,
            currency: props.currency ?? 'usd',
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data?.client_secret) throw new Error('No client_secret');
        setClientSecret(data.client_secret);
      } catch (e) {
        if (!cancelled) setInitError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [props.orderId, props.orderType, props.amount, props.currency]);

  if (keyLoading || loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando formulario de pago…
      </div>
    );
  }

  if (!keyData?.publishable_key) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          El pago con tarjeta no está disponible. El administrador debe configurar las llaves de Stripe.
        </AlertDescription>
      </Alert>
    );
  }

  if (initError || !clientSecret) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{initError ?? 'No se pudo iniciar el pago.'}</AlertDescription>
      </Alert>
    );
  }

  const stripePromise = getStripe(keyData.publishable_key);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <InnerForm amount={props.amount} onSuccess={props.onSuccess} onError={props.onError} />
      {keyData.mode === 'test' && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Modo de prueba · usa <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code>
        </p>
      )}
    </Elements>
  );
}

export default StripeCardForm;
