import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { order_id, order_type, amount, currency = 'usd' } = body ?? {};
    if (!order_id || !order_type || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order_type !== 'b2b' && order_type !== 'b2c') {
      return new Response(JSON.stringify({ error: 'Invalid order_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load active Stripe settings
    const { data: settings, error: settingsErr } = await admin
      .from('stripe_settings')
      .select('secret_key, mode')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsErr || !settings?.secret_key) {
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado. Pídele al admin que configure las llaves en /admin/payment-keys.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order ownership
    const table = order_type === 'b2b' ? 'orders_b2b' : 'orders_b2c';
    const { data: order, error: orderErr } = await admin
      .from(table)
      .select('id, buyer_id, total_amount')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.buyer_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(settings.secret_key, { apiVersion: '2024-12-18.acacia' });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { order_id, order_type, user_id: userId },
    });

    return new Response(
      JSON.stringify({ client_secret: intent.client_secret, payment_intent_id: intent.id, mode: settings.mode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('create-payment-intent error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
