// This script checks if shipping routes and zones are properly loaded
// Run from the workspace root: node debug_shipping.cjs

const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function checkData() {
  console.log('\n=== 🔍 CHECKING SHIPPING DATABASE ===\n')

  // Dynamic imports for ES modules to work with Node
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Check routes
  console.log('1️⃣  Checking shipping_routes table...')
  try {
    const { data: allRoutes, error } = await supabase
      .from('shipping_routes')
      .select('id, name, origin, destination, cost_per_kg, cost_per_lb, is_active')
      .order('created_at')

    if (error) throw error
    console.log(`   ✅ Total routes in table: ${allRoutes?.length}`)
    console.log(`   📋 Routes:`)
    allRoutes?.forEach(r => {
      console.log(`      - ${r.name} (${r.origin} → ${r.destination}): $${r.cost_per_kg}/kg | is_active=${r.is_active}`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 2. Check ACTIVE routes
  console.log('\n2️⃣  Checking ACTIVE shipping_routes (is_active=true)...')
  try {
    const { data: activeRoutes, error } = await supabase
      .from('shipping_routes')
      .select('id, name, is_active')
      .eq('is_active', true)

    if (error) throw error
    console.log(`   ✅ Active routes: ${activeRoutes?.length}`)
    if (activeRoutes?.length === 0) {
      console.log(`   ⚠️  WARNING: No active routes! This is why defaultRouteId is null.`)
    } else {
      console.log(`   📋 First route ID would be used: ${activeRoutes?.[0]?.id}`)
    }
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 3. Check zones
  console.log('\n3️⃣  Checking shipping_zones table...')
  try {
    const { data: allZones, error } = await supabase
      .from('shipping_zones')
      .select('id, country, zone_name, final_delivery_surcharge, is_active')
      .order('country')

    if (error) throw error
    console.log(`   ✅ Total zones in table: ${allZones?.length}`)
    console.log(`   📋 Zones:`)
    allZones?.forEach(z => {
      console.log(`      - ${z.country}/${z.zone_name}: $${z.final_delivery_surcharge} | is_active=${z.is_active}`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 4. Check ACTIVE zones
  console.log('\n4️⃣  Checking ACTIVE shipping_zones (is_active=true)...')
  try {
    const { data: activeZones, error } = await supabase
      .from('shipping_zones')
      .select('id, country, zone_name, is_active')
      .eq('is_active', true)

    if (error) throw error
    console.log(`   ✅ Active zones: ${activeZones?.length}`)
    if (activeZones?.length === 0) {
      console.log(`   ⚠️  WARNING: No active zones! This is why defaultZoneId is null.`)
    } else {
      const haitiZone = activeZones?.find(z => z.country?.toUpperCase() === 'HT')
      console.log(`   📋 Would prefer Haiti zone: ${haitiZone?.id} (${haitiZone?.zone_name})`)
      console.log(`   📋 Fallback would be: ${activeZones?.[0]?.id} (${activeZones?.[0]?.country}/${activeZones?.[0]?.zone_name})`)
    }
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 5. Check v_logistics_data
  console.log('\n5️⃣  Checking v_logistics_data view...')
  try {
    const { data: logisticsData, error } = await supabase
      .from('v_logistics_data')
      .select('item_type, item_name, weight_kg, product_id, variant_id')
      .limit(3)

    if (error) throw error
    console.log(`   ✅ View exists and returns data`)
    console.log(`   📋 Sample items:`)
    logisticsData?.forEach(item => {
      const id = item.variant_id || item.product_id
      const type = item.variant_id ? 'VARIANT' : 'PRODUCT'
      console.log(`      - [${type}] ${item.item_name} (ID: ${id}): ${item.weight_kg}kg`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  console.log('\n=== ✅ DIAGNOSIS COMPLETE ===\n')
}

checkData().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
