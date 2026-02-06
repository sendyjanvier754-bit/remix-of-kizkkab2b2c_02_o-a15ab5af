// Test with known product IDs from the screenshot
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function testWithKnownProducts() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 TESTING BATCH QUERY WITH KNOWN PRODUCTS ===\n')

  // Get product IDs we know exist (Camiseta and Tanga)
  const { data: products } = await supabase
    .from('products')
    .select('id, nombre')
    .in('nombre', [
      'Camiseta Premium de Verano con Cuello Redondo para Hombre',
      'Tanga de Encaje con Lazo Estilo Europeo para Mujer'
    ])

  if (!products || products.length === 0) {
    console.log('❌ Products not found')
    return
  }

  const productIds = products.map(p => p.id)
  console.log('Known products:')
  products.forEach(p => {
    console.log(`  - ${p.nombre} (ID: ${p.id})`)
  })

  // Simulate the batch query logic
  console.log('\n📋 Simulating useLogisticsDataBatch logic...\n')

  // Test the complex OR query
  console.log('1️⃣  Test: Complex OR query (like in hook)...')
  try {
    let query = supabase.from('v_logistics_data').select('item_name, product_id, variant_id, weight_kg')

    // Only products, no variants
    const orFilter = `and(product_id.in.(${productIds.join(',')}),variant_id.is.null)`
    console.log(`   Using OR filter: ${orFilter}`)
    
    query = query.or(orFilter)

    const { data: results, error: err } = await query

    if (err) {
      console.error(`   ❌ Error:`, err)
      return
    }

    console.log(`   ✅ Returned ${results?.length} items`)
    results?.forEach(d => {
      console.log(`      - ${d.item_name}: ${d.weight_kg}kg`)
    })

    // Now test building the map like the hook does
    console.log('\n2️⃣  Building dataMap like useLogisticsDataBatch...')
    const map = new Map()
    results?.forEach((item) => {
      const key = item.variant_id
        ? `variant-${item.variant_id}`
        : `product-${item.product_id}`
      console.log(`   Setting key: ${key}`)
      map.set(key, item)
    })

    console.log(`\n   ✅ Map has ${map.size} entries`)
    console.log('   Map contents:')
    map.forEach((item, key) => {
      console.log(`      ${key} → ${item.item_name} (${item.weight_kg}kg)`)
    })

    // Now test the lookup like useShippingCostCalculationForCart does
    console.log('\n3️⃣  Testing lookups like the hook does...')
    const cartItems = [
      { productId: productIds[0], variantId: null, quantity: 1 },
      { productId: productIds[1], variantId: null, quantity: 1 }
    ]

    cartItems.forEach(cartItem => {
      const key = cartItem.variantId
        ? `variant-${cartItem.variantId}`
        : `product-${cartItem.productId}`

      const logisticsData = map.get(key)
      if (logisticsData) {
        console.log(`   ✅ Found ${key}: ${logisticsData.weight_kg}kg`)
      } else {
        console.log(`   ❌ NOT FOUND: ${key}`)
      }
    })

  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  console.log('\n=== ✅ TEST COMPLETE ===\n')
}

testWithKnownProducts().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
