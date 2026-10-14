import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { sendOrderEmail } from '../_shared/transactional-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return new Response('Missing signature', { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settings } = await admin
      .from('stripe_settings')
      .select('secret_key, webhook_secret')
      .eq('is_active', true)
      .maybeSingle();

    if (!settings?.secret_key || !settings?.webhook_secret) {
      return new Response('Stripe not configured', { status: 503, headers: corsHeaders });
    }

    const stripe = new Stripe(settings.secret_key, { apiVersion: '2024-12-18.acacia' });
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, settings.webhook_secret);
    } catch (err) {
      console.error('Webhook signature verification failed:', (err as Error).message);
      return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400, headers: corsHeaders });
    }

    const pi = event.data.object as Stripe.PaymentIntent;
    const orderType = pi.metadata?.order_type;
    const ids = (pi.metadata?.order_ids || pi.metadata?.order_id || '').split(',').filter(Boolean);
    const table = orderType === 'b2b' ? 'orders_b2b' : orderType === 'b2c' ? 'orders_b2c' : null;

    if (!table || ids.length === 0) {
      console.log('Event ignored — missing metadata', event.type);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event.type === 'payment_intent.succeeded') {
      for (const id of ids) {
        const { data: cur } = await admin.from(table).select('metadata').eq('id', id).maybeSingle();
        const { error } = await admin
          .from(table)
          .update({
            payment_status: 'paid',
            status: 'paid',
            ...(table === 'orders_b2c' ? { payment_reference: pi.id } : {}),
            payment_confirmed_at: new Date().toISOString(),
            metadata: { ...((cur?.metadata as Record<string, unknown>) || {}), stripe_payment_intent_id: pi.id },
          })
          .eq('id', id);
        if (error) console.error('Update order failed:', id, error);
      }
      for (const id of ids) {
        try { await sendOrderEmail(admin, table as 'orders_b2b' | 'orders_b2c', id, 'paid'); } catch (e) { console.error('paid email failed', id, e); }
      }
      console.log(`✅ Orders ${ids.join(',')} (${table}) marked as paid`);
    } else if (event.type === 'payment_intent.payment_failed') {
      const { error } = await admin.from(table).update({ payment_status: 'failed' }).in('id', ids);
      if (error) console.error('Update order failed:', error);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('stripe-webhook error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
