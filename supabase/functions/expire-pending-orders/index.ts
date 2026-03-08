import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('🕐 Starting expire-pending-orders job...');

    // Call the database function to expire old orders
    const { data, error } = await supabase.rpc('fn_expire_pending_orders');

    if (error) {
      console.error('❌ Error expiring orders:', error);
      throw error;
    }

    const expiredCount = data || 0;
    console.log(`✅ Expired ${expiredCount} pending orders`);

    // Also check for orders that need stock release notification
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('orders_b2b')
      .select(`
        id,
        seller_id,
        buyer_id,
        total_amount,
        payment_status
      `)
      .eq('payment_status', 'expired')
      .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

    if (!fetchError && expiredOrders && expiredOrders.length > 0) {
      // Create notifications for expired orders
      const notifications = expiredOrders.map(order => ({
        user_id: order.buyer_id || order.seller_id,
        type: 'order_expired',
        title: 'Pedido Expirado',
        message: `Tu pedido por $${order.total_amount} ha expirado. El stock ha sido liberado.`,
        data: { order_id: order.id },
      }));

      await supabase.from('notifications').insert(notifications);
      console.log(`📧 Sent ${notifications.length} expiration notifications`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired_count: expiredCount,
        message: `Expired ${expiredCount} pending orders` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in expire-pending-orders:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
