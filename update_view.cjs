// Update v_logistics_data view in Supabase with corrected weight logic
const supabaseUrl = "https://fonvunyiaxcjkodrnpox.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"

const viewSQL = `CREATE OR REPLACE VIEW v_logistics_data AS

SELECT
    p.id AS product_id,
    NULL::uuid AS variant_id,
    'PRODUCT' AS item_type,
    p.nombre AS item_name,
    p.sku_interno AS sku,
    
    COALESCE(
        NULLIF(p.weight_kg, 0),
        NULLIF(p.peso_kg, 0),
        NULLIF(p.weight_g / 1000.0, 0),
        NULLIF(p.peso_g / 1000.0, 0),
        0
    ) AS weight_kg,
    
    p.length_cm,
    p.width_cm,
    p.height_cm,
    
    p.is_oversize,
    p.is_active
FROM
    products p
WHERE 
    p.is_active = TRUE

UNION ALL

SELECT
    pv.product_id,
    pv.id AS variant_id,
    'VARIANT' AS item_type,
    p.nombre || ' - ' || pv.name AS item_name,
    pv.sku,
    
    COALESCE(
        NULLIF(p.weight_kg, 0),
        NULLIF(p.peso_kg, 0),
        NULLIF(p.weight_g / 1000.0, 0),
        NULLIF(p.peso_g / 1000.0, 0),
        0
    ) AS weight_kg,
    
    p.length_cm,
    p.width_cm,
    p.height_cm,
    
    p.is_oversize,
    pv.is_active
FROM
    product_variants pv
JOIN
    products p ON pv.product_id = p.id
WHERE
    pv.is_active = TRUE`

async function updateView() {
  console.log('\n🔧 Updating v_logistics_data view in Supabase...\n')
  
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // To execute DDL, we need to use the raw fetch API against the health endpoint
    // Or use a PostgreSQL function. Let's try the RPC approach first (won't work for DDL)
    // Then fall back to instructing user
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sql: viewSQL
      })
    })

    if (response.ok) {
      console.log('✅ View updated successfully!')
      console.log('\nNow verify by checking weights:')
      
      const { data, error } = await supabase
        .from('v_logistics_data')
        .select('item_name, weight_kg')
        .limit(3)
      
      if (data) {
        console.log('\n📊 Updated view data:')
        data.forEach(d => {
          console.log(`  - ${d.item_name}: ${d.weight_kg}kg`)
        })
      }
    } else {
      console.log('⚠️  RPC endpoint not available for DDL statements')
      console.log('\n📋 ALTERNATIVE: Execute this SQL in Supabase SQL Editor:\n')
      console.log('```sql')
      console.log(viewSQL)
      console.log('```\n')
      console.log('Then refresh the browser to reload the view cache.')
    }
  } catch (err) {
    console.error('Error:', err.message)
    console.log('\n📋 MANUAL FIX: Go to Supabase Dashboard → SQL Editor → Run this:\n')
    console.log('```sql')
    console.log(viewSQL)
    console.log('```')
  }
}

updateView()
