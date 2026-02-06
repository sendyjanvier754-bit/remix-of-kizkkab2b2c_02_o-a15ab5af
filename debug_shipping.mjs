import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('\n=== CHECKING SHIPPING DATA ===\n')

  // Check routes
  console.log('1. Checking shipping_routes...')
  const { data: routes, error: routesErr } = await supabase
    .from('shipping_routes')
    .select('*')

  if (routesErr) {
    console.error('Error fetching routes:', routesErr)
  } else {
    console.log(`Total routes: ${routes?.length}`)
    console.log('Routes data:', routes)
  }

  // Check active routes
  console.log('\n2. Checking ACTIVE shipping_routes (is_active=true)...')
  const { data: activeRoutes, error: activeRoutesErr } = await supabase
    .from('shipping_routes')
    .select('*')
    .eq('is_active', true)

  if (activeRoutesErr) {
    console.error('Error fetching active routes:', activeRoutesErr)
  } else {
    console.log(`Active routes: ${activeRoutes?.length}`)
    console.log('Active routes data:', activeRoutes)
  }

  // Check zones
  console.log('\n3. Checking shipping_zones...')
  const { data: zones, error: zonesErr } = await supabase
    .from('shipping_zones')
    .select('*')

  if (zonesErr) {
    console.error('Error fetching zones:', zonesErr)
  } else {
    console.log(`Total zones: ${zones?.length}`)
    console.log('Zones data:', zones)
  }

  // Check active zones
  console.log('\n4. Checking ACTIVE shipping_zones (is_active=true)...')
  const { data: activeZones, error: activeZonesErr } = await supabase
    .from('shipping_zones')
    .select('*')
    .eq('is_active', true)

  if (activeZonesErr) {
    console.error('Error fetching active zones:', activeZonesErr)
  } else {
    console.log(`Active zones: ${activeZones?.length}`)
    console.log('Active zones data:', activeZones)
  }

  // Check v_logistics_data
  console.log('\n5. Checking v_logistics_data view...')
  const { data: logisticsData, error: logisticsErr } = await supabase
    .from('v_logistics_data')
    .select('*')
    .limit(3)

  if (logisticsErr) {
    console.error('Error fetching logistics data:', logisticsErr)
  } else {
    console.log(`Logistics items (first 3): ${logisticsData?.length}`)
    console.log('Logistics data:', logisticsData)
  }

  // Check products with weight
  console.log('\n6. Checking products table for weight data...')
  const { data: productsWithWeight, error: productsErr } = await supabase
    .from('products')
    .select('id, nombre, peso_g, peso_kg, weight_g, weight_kg, is_active')
    .limit(3)

  if (productsErr) {
    console.error('Error fetching products:', productsErr)
  } else {
    console.log(`Products (first 3):`)
    console.log(JSON.stringify(productsWithWeight, null, 2))
  }
}

checkData().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
