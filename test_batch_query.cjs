// Test the logistics batch query
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function testBatchQuery() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 TESTING BATCH LOGISTICS QUERY ===\n')

  // Get real product IDs from cart
  const { data: cartItems } = await supabase
    .from('b2b_cart_items')
    .select('product_id, product_variant_id')
    .limit(2)

  if (!cartItems || cartItems.length === 0) {
    console.log('❌ No cart items found')
    return
  }

  console.log(`Found ${cartItems.length} cart items:`)
  cartItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. productId: ${item.product_id}, variantId: ${item.product_variant_id}`)
  })

  // Extract product and variant IDs
  const productIds = cartItems
    .filter(i => !i.product_variant_id)
    .map(i => i.product_id)
  const variantIds = cartItems
    .filter(i => i.product_variant_id)
    .map(i => i.product_variant_id)

  console.log(`\nProductIds: ${productIds.join(', ')}`)
  console.log(`VariantIds: ${variantIds.join(', ')}`)

  // Test 1: Simple query for products only
  console.log('\n1️⃣  Test: Simple query for products (variant_id IS NULL)...')
  try {
    const { data: data1, error: err1 } = await supabase
      .from('v_logistics_data')
      .select('item_name, product_id, variant_id, weight_kg')
      .in('product_id', productIds)
      .is('variant_id', null)

    if (err1) throw err1
    console.log(`   ✅ Returned ${data1?.length} products`)
    data1?.forEach(d => {
      console.log(`      - ${d.item_name} (product_id=${d.product_id}): ${d.weight_kg}kg`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // Test 2: Query for variants
  console.log('\n2️⃣  Test: Query for variants (variant_id IN (...))...')
  if (variantIds.length > 0) {
    try {
      const { data: data2, error: err2 } = await supabase
        .from('v_logistics_data')
        .select('item_name, product_id, variant_id, weight_kg')
        .in('variant_id', variantIds)

      if (err2) throw err2
      console.log(`   ✅ Returned ${data2?.length} variants`)
      data2?.forEach(d => {
        console.log(`      - ${d.item_name} (variant_id=${d.variant_id}): ${d.weight_kg}kg`)
      })
    } catch (err) {
      console.error(`   ❌ Error:`, err.message)
    }
  } else {
    console.log('   ℹ️  No variants in cart')
  }

  // Test 3: Combined query using OR
  console.log('\n3️⃣  Test: Combined query using OR (actual logic)...')
  try {
    let query = supabase.from('v_logistics_data').select('item_name, product_id, variant_id, weight_kg')

    if (productIds.length > 0 && variantIds.length > 0) {
      query = query.or(
        `and(product_id.in.(${productIds.join(',')}),variant_id.is.null),variant_id.in.(${variantIds.join(',')})`
      )
    } else if (productIds.length > 0) {
      query = query
        .in('product_id', productIds)
        .is('variant_id', null)
    } else if (variantIds.length > 0) {
      query = query.in('variant_id', variantIds)
    }

    const { data: data3, error: err3 } = await query

    if (err3) throw err3
    console.log(`   ✅ Returned ${data3?.length} total items`)
    data3?.forEach(d => {
      const type = d.variant_id ? 'VARIANT' : 'PRODUCT'
      console.log(`      - [${type}] ${d.item_name}: ${d.weight_kg}kg`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  console.log('\n=== ✅ BATCH QUERY TEST COMPLETE ===\n')
}

testBatchQuery().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
