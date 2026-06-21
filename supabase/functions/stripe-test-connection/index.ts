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

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify admin role
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsErr } = await admin
      .from('stripe_settings')
      .select('secret_key, mode, publishable_key, webhook_secret')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsErr || !settings?.secret_key) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No hay llaves activas configuradas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(settings.secret_key, { apiVersion: '2024-12-18.acacia' });

    try {
      const balance = await stripe.balance.retrieve();
      const account = await stripe.accounts.retrieve();
      return new Response(
        JSON.stringify({
          ok: true,
          mode: settings.mode,
          account_id: account.id,
          country: account.country,
          email: account.email,
          has_publishable_key: !!settings.publishable_key,
          has_webhook_secret: !!settings.webhook_secret,
          livemode: balance.livemode,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: (err as Error).message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    console.error('stripe-test-connection error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
