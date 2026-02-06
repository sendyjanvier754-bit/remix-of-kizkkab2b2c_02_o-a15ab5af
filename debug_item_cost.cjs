// Debug: Test per-item RPC call for Camiseta
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function debugItemCosts() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 DEBUG: PER-ITEM SHIPPING COST ===\n')

  // Get Camiseta ID
  const { data: camiseta } = await supabase
    .from('products')
    .select('id, nombre, peso_g, peso_kg, weight_g, weight_kg')
    .eq('nombre', 'Camiseta Premium de Verano con Cuello Redondo para Hombre')
    .single()

  if (!camiseta) {
    console.log('❌ Camiseta not found')
    return
  }

  console.log('📦 Camiseta data:')
  console.log(`   id: ${camiseta.id}`)
  console.log(`   peso_g: ${camiseta.peso_g}`)
  console.log(`   weight_kg: ${camiseta.weight_kg}`)

  // Get weight from v_logistics_data
  const { data: camisetaLogistics } = await supabase
    .from('v_logistics_data')
    .select('weight_kg, product_id, variant_id')
    .eq('product_id', camiseta.id)
    .is('variant_id', null)
    .single()

  console.log('\n📊 From v_logistics_data:')
  console.log(`   weight_kg: ${camisetaLogistics?.weight_kg}kg`)

  // Get route and zone
  const { data: route } = await supabase
    .from('shipping_routes')
    .select('id, route_name, cost_per_kg, cost_per_lb')
    .eq('is_active', true)
    .limit(1)
    .single()

  const { data: zone } = await supabase
    .from('shipping_zones')
    .select('id, zone_name, final_delivery_surcharge')
    .eq('country', 'HAITI')
    .limit(1)
    .single()

  if (!route || !zone) {
    console.log('❌ Route or zone not found')
    return
  }

  console.log('\n🛣️  Route:')
  console.log(`   name: ${route.route_name}`)
  console.log(`   cost_per_kg: $${route.cost_per_kg}`)
  console.log(`   cost_per_lb: $${route.cost_per_lb}`)

  console.log('\n📍 Zone:')
  console.log(`   name: ${zone.zone_name}`)
  console.log(`   surcharge: $${zone.final_delivery_surcharge}`)

  // Test 1: Direct RPC call
  console.log('\n1️⃣  Calling fn_calculate_shipping_cost directly...')
  const weight_kg = camisetaLogistics?.weight_kg || 0.3
  const quantity = Math.ceil((weight_kg * 1000 * 1) / 1000) // 1 unit
  
  console.log(`   Parameters:`)
  console.log(`      p_item_id: ${camiseta.id}`)
  console.log(`      p_is_variant: false`)
  console.log(`      p_quantity: ${quantity}`)
  console.log(`      p_route_id: ${route.id}`)
  console.log(`      p_shipping_type: STANDARD`)
  console.log(`      p_destination_zone_id: ${zone.id}`)

  const { data: result, error: rpcError } = await supabase.rpc(
    'fn_calculate_shipping_cost',
    {
      p_item_id: camiseta.id,
      p_is_variant: false,
      p_quantity: quantity,
      p_route_id: route.id,
      p_shipping_type: 'STANDARD',
      p_destination_zone_id: zone.id
    }
  )

  if (rpcError) {
    console.error('   ❌ RPC Error:', rpcError)
    return
  }

  if (result?.error) {
    console.error('   ❌ Function Error:', result.error)
    return
  }

  console.log('\n   ✅ RPC Result:')
  console.log(`      weight_g: ${result?.weight_g}`)
  console.log(`      weight_kg: ${result?.weight_kg}`)
  console.log(`      chargeable_weight_kg: ${result?.chargeable_weight_kg}`)
  console.log(`      cost_tramo_a: $${result?.cost_tramo_a}`)
  console.log(`      cost_tramo_b: $${result?.cost_tramo_b}`)
  console.log(`      surcharge: $${result?.surcharge_final_delivery}`)
  console.log(`      TOTAL: $${result?.total_shipping_cost}`)

  console.log('\n=== ✅ DEBUG COMPLETE ===\n')
}

debugItemCosts().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
