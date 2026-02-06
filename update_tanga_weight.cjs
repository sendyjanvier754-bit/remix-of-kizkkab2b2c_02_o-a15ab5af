// Update Tanga weight via REST API
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function updateTangaWeight() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔄 UPDATING TANGA WEIGHT ===\n')

  // Get Tanga ID
  const { data: tanga, error: getError } = await supabase
    .from('products')
    .select('id, nombre, peso_g')
    .eq('nombre', 'Tanga de Encaje con Lazo Estilo Europeo para Mujer')
    .single()

  if (getError || !tanga) {
    console.error('❌ Error fetching Tanga:', getError?.message)
    return
  }

  console.log(`📦 Found Tanga: ${tanga.nombre}`)
  console.log(`   Current peso_g: ${tanga.peso_g}`)

  // Update peso_g to 600
  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ peso_g: 600 })
    .eq('id', tanga.id)
    .select('id, nombre, peso_g, peso_kg, weight_g, weight_kg')
    .single()

  if (updateError) {
    console.error('❌ Error updating:', updateError.message)
    return
  }

  console.log(`\n✅ Updated successfully!`)
  console.log(`   New peso_g: ${updated.peso_g}`)

  // Verify in v_logistics_data
  console.log('\n⏳ Checking v_logistics_data...')
  const { data: logisticsData } = await supabase
    .from('v_logistics_data')
    .select('item_name, weight_kg')
    .eq('product_id', tanga.id)
    .is('variant_id', null)
    .single()

  console.log(`✅ v_logistics_data now shows: ${logisticsData?.weight_kg}kg`)

  console.log('\n=== 🎉 COMPLETE ===\n')
}

updateTangaWeight().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
