// Check Tanga weight columns
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function checkTangaWeight() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 CHECKING TANGA WEIGHT COLUMNS ===\n')

  // Get Tanga raw data
  const { data: tanga } = await supabase
    .from('products')
    .select('id, nombre, peso_g, peso_kg, weight_g, weight_kg')
    .eq('nombre', 'Tanga de Encaje con Lazo Estilo Europeo para Mujer')
    .single()

  console.log('📋 Tanga raw data from products table:')
  console.log(`   id: ${tanga?.id}`)
  console.log(`   nombre: ${tanga?.nombre}`)
  console.log(`   peso_g: ${tanga?.peso_g}`)
  console.log(`   peso_kg: ${tanga?.peso_kg}`)
  console.log(`   weight_g: ${tanga?.weight_g}`)
  console.log(`   weight_kg: ${tanga?.weight_kg}`)

  // Get Tanga from v_logistics_data
  const { data: tangaLogistics } = await supabase
    .from('v_logistics_data')
    .select('item_name, weight_kg, product_id')
    .eq('product_id', tanga?.id)
    .is('variant_id', null)
    .single()

  console.log('\n📋 Tanga from v_logistics_data view:')
  console.log(`   weight_kg: ${tangaLogistics?.weight_kg}`)

  // COALESCE logic manually
  const manualCoalesce = 
    tanga?.weight_kg ||
    tanga?.peso_kg ||
    (tanga?.weight_g ? tanga.weight_g / 1000 : null) ||
    (tanga?.peso_g ? tanga.peso_g / 1000 : null) ||
    0

  console.log(`\n✅ Manual COALESCE result: ${manualCoalesce}kg`)

  if (tangaLogistics?.weight_kg === 0) {
    console.log('\n⚠️  PROBLEM: v_logistics_data returns 0 for Tanga!')
    console.log('   The NULLIF fix might not have been applied or view was not refreshed.')
  }

  console.log('\n=== END ===\n')
}

checkTangaWeight().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
