// Verificar que v_logistics_data devuelve pesos correctos + que rutas/zonas se cargan
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

async function verify() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n=== 🔍 VERIFICANDO CORRECCIONES ===\n')

  // 1. Verificar v_logistics_data con pesos correctos
  console.log('1️⃣  Verificando v_logistics_data (pesos con NULLIF)...')
  try {
    const { data: logistics, error } = await supabase
      .from('v_logistics_data')
      .select('item_name, product_id, weight_kg, is_active')
      .eq('is_active', true)
      .limit(5)
      .order('item_name')

    if (error) throw error
    console.log(`   ✅ Items activos con pesos:`)
    logistics?.forEach(item => {
      const weightLabel = item.weight_kg > 0 ? `${item.weight_kg}kg` : '0kg (sin peso)'
      console.log(`   • ${item.item_name}: ${weightLabel}`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 2. Verificar rutas activas
  console.log('\n2️⃣  Verificando shipping_routes (activas)...')
  try {
    const { data: routes, error } = await supabase
      .from('shipping_routes')
      .select('id, route_name, cost_per_kg, cost_per_lb, is_active')
      .eq('is_active', true)

    if (error) throw error
    console.log(`   ✅ Rutas disponibles: ${routes?.length}`)
    routes?.forEach(r => {
      console.log(`   • ${r.route_name}: $${r.cost_per_kg}/kg | $${r.cost_per_lb}/lb`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 3. Verificar zonas activas
  console.log('\n3️⃣  Verificando shipping_zones (activas)...')
  try {
    const { data: zones, error } = await supabase
      .from('shipping_zones')
      .select('id, country, zone_name, final_delivery_surcharge, is_active')
      .eq('is_active', true)
      .order('country')

    if (error) throw error
    console.log(`   ✅ Zonas disponibles: ${zones?.length}`)
    zones?.forEach(z => {
      console.log(`   • ${z.country} / ${z.zone_name}: +$${z.final_delivery_surcharge} recargo`)
    })
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  // 4. TEST: Llamar fn_calculate_shipping_cost con producto real
  console.log('\n4️⃣  TEST: Calculando costo de envío para Camiseta + Tanga...')
  try {
    // Obtener IDs reales de los productos
    const { data: products } = await supabase
      .from('products')
      .select('id, nombre, peso_g')
      .in('nombre', [
        'Camiseta Premium de Verano con Cuello Redondo para Hombre',
        'Tanga de Encaje con Lazo Estilo Europeo para Mujer'
      ])

    if (!products || products.length === 0) {
      console.log('   ⚠️  Productos no encontrados')
      return
    }

    // Obtener IDs de ruta y zona
    const { data: routes } = await supabase
      .from('shipping_routes')
      .select('id')
      .eq('is_active', true)
      .limit(1)

    const { data: zones } = await supabase
      .from('shipping_zones')
      .select('id')
      .eq('country', 'HAITI')
      .limit(1)

    if (!routes?.[0] || !zones?.[0]) {
      console.log('   ⚠️  Ruta o zona no encontradas')
      return
    }

    const routeId = routes[0].id
    const zoneId = zones[0].id

    // Simular carrito: 1 Camiseta + 1 Tanga = 1.2kg total
    const product1 = products.find(p => p.nombre?.includes('Camiseta'))
    const product2 = products.find(p => p.nombre?.includes('Tanga'))

    if (!product1 || !product2) {
      console.log('   ⚠️  No se encontraron ambos productos')
      return
    }

    console.log(`   📦 Carrito estimado:`)
    console.log(`      • ${product1.nombre} (${product1.peso_g}g)`)
    console.log(`      • ${product2.nombre} (${product2.peso_g}g)`)
    console.log(`      → Total esperado: ~1.2kg`)

    // Llamar función RPC con peso total en kg (1)
    const { data: resultCosto, error: costError } = await supabase.rpc(
      'fn_calculate_shipping_cost',
      {
        p_item_id: product1.id,
        p_is_variant: false,
        p_quantity: 1, // 1 unidad de 1kg = 1kg total
        p_route_id: routeId,
        p_shipping_type: 'STANDARD',
        p_destination_zone_id: zoneId
      }
    )

    if (costError) throw costError

    console.log(`\n   ✅ Resultado del cálculo:`)
    console.log(`   • Peso facturable: ${resultCosto.chargeable_weight_kg}kg`)
    console.log(`   • Costo Tramo A (kg): $${resultCosto.cost_tramo_a}`)
    console.log(`   • Costo Tramo B (lb): $${resultCosto.cost_tramo_b}`)
    console.log(`   • Recargo zona: $${resultCosto.surcharge_final_delivery}`)
    console.log(`   • TOTAL: $${resultCosto.total_shipping_cost}`)
  } catch (err) {
    console.error(`   ❌ Error:`, err.message)
  }

  console.log('\n=== ✅ VERIFICACIÓN COMPLETADA ===\n')
}

verify().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
