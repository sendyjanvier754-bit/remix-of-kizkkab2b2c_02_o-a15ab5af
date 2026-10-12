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
    const { order_id, order_type, currency = 'usd' } = body ?? {};
    const rawIds: unknown = body?.order_ids ?? (order_id ? [order_id] : []);
    const orderIds = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20)
      : [];
    if (orderIds.length === 0 || (order_type !== 'b2b' && order_type !== 'b2c')) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: settings, error: settingsErr } = await admin
      .from('stripe_settings')
      .select('secret_key, mode')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsErr || !settings?.secret_key) {
      return new Response(
        JSON.stringify({ error: 'card_unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership and compute amount server-side (never trust client amount)
    const table = order_type === 'b2b' ? 'orders_b2b' : 'orders_b2c';
    const buyerCol = order_type === 'b2b' ? 'buyer_id' : 'buyer_user_id';
    const { data: orders, error: orderErr } = await admin
      .from(table)
      .select(`id, ${buyerCol}, total_amount, payment_status`)
      .in('id', orderIds);

    if (orderErr || !orders || orders.length !== orderIds.length) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (orders.some((o: any) => o[buyerCol] !== userId)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (orders.some((o: any) => o.payment_status === 'paid')) {
      return new Response(JSON.stringify({ error: 'already_paid' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const total = orders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    const amountCents = Math.max(50, Math.round(total * 100));

    const stripe = new Stripe(settings.secret_key, { apiVersion: '2024-12-18.acacia' });

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        automatic_payment_methods: { enabled: true },
        description: `KIZKKA ${order_type.toUpperCase()} ${orderIds.map((i) => i.slice(0, 8)).join(',')}`,
        metadata: { order_id: orderIds[0], order_ids: orderIds.join(','), order_type, user_id: userId },
      },
      { idempotencyKey: `pi-${order_type}-${[...orderIds].sort().join('-')}-${amountCents}` },
    );

    return new Response(
      JSON.stringify({ client_secret: intent.client_secret, payment_intent_id: intent.id, mode: settings.mode, amount: amountCents / 100 }),
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
