// Check actual product weights in the database
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function checkWeights() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 CHECKING PRODUCT WEIGHTS ===\n')

  // Check specific products in cart
  console.log('1️⃣  Checking raw products table for weight columns...')
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, nombre, peso_g, peso_kg, weight_g, weight_kg, is_active')
      .limit(5)

    if (error) throw error
    console.log(`   ✅ Fetched ${products?.length} products`)
    console.log('\n   📋 Product weights:')
    products?.forEach(p => {
      console.log(`   - ${p.nombre}`)
      console.log(`     • peso_g: ${p.peso_g}`)
      console.log(`     • peso_kg: ${p.peso_kg}`)
      console.log(`     • weight_g: ${p.weight_g}`)
      console.log(`     • weight_kg: ${p.weight_kg}`)
      console.log(`     • is_active: ${p.is_active}`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // Check v_logistics_data with products we know have weight
  console.log('\n2️⃣  Checking v_logistics_data for same products...')
  try {
    const { data: logistics, error } = await supabase
      .from('v_logistics_data')
      .select('item_name, product_id, weight_kg, is_active')
      .limit(5)

    if (error) throw error
    console.log(`   ✅ View returned ${logistics?.length} items`)
    console.log('\n   📋 v_logistics_data weights:')
    logistics?.forEach(item => {
      console.log(`   - ${item.item_name}`)
      console.log(`     • product_id: ${item.product_id}`)
      console.log(`     • weight_kg: ${item.weight_kg}`)
      console.log(`     • is_active: ${item.is_active}`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // Check if the peso_g column actually has data
  console.log('\n3️⃣  Checking row count and sample datos...')
  try {
    const { data: sample, error } = await supabase
      .from('products')
      .select('id, nombre, peso_g')
      .gt('peso_g', 0)

    if (error) throw error
    console.log(`   ✅ Products with peso_g > 0: ${sample?.length}`)
    if (sample && sample.length > 0) {
      console.log(`   📋 Example: ${sample[0].nombre} has peso_g = ${sample[0].peso_g}`)
    }
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // Test the COALESCE logic manually
  console.log('\n4️⃣  Testing COALESCE logic in view...')
  try {
    const { data: coalescTest, error } = await supabase
      .rpc('execute_raw_sql', {
        query: `SELECT 
          p.nombre,
          p.peso_g,
          p.peso_kg,
          p.weight_g,
          p.weight_kg,
          COALESCE(p.weight_kg, p.peso_kg, p.weight_g / 1000.0, p.peso_g / 1000.0) AS calculated_weight_kg
        FROM products p
        LIMIT 3;`
      })
    
    if (error) throw error
    console.log('   ✅ Raw calculation:')
    console.log(coalescTest)
  } catch (err) {
    console.log(`   ℹ️  RPC unavailable (expected), but we can manually check columns`)
  }

  console.log('\n=== ✅ DIAGNOSIS COMPLETE ===\n')
}

checkWeights().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
