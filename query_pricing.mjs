import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Consultando vista v_productos_con_precio_b2b CORREGIDA...\n');

// Query 1: Products with old precio_b2b around $16.67 - should now be ~$3.94
const { data: products1, error: error1 } = await supabase
  .from('v_productos_con_precio_b2b')
  .select('*')
  .gte('costo_base', 0.85)
  .lte('costo_base', 0.91)
  .limit(5);

if (error1) {
  console.error('❌ Error en query 1:', error1.message);
} else {
  console.log('📊 Productos con costo ~$0.88 (DESPUÉS de corrección):');
  console.table(products1?.map(p => ({
    sku: p.sku_interno,
    nombre: p.nombre.substring(0, 40),
    costo_base: p.costo_base?.toFixed(2),
    precio_con_margen_300: p.precio_con_margen_300?.toFixed(2),
    platform_fee: p.platform_fee?.toFixed(2),
    precio_b2b: p.precio_b2b?.toFixed(2),
    verificacion: (p.costo_base * 4.0 * 1.12).toFixed(2)
  })));
  
  if (products1 && products1.length > 0) {
    const p = products1[0];
    console.log('\n✅ VERIFICACIÓN EXITOSA:');
    console.log(`Producto: ${p.nombre}`);
    console.log(`Costo base: $${p.costo_base?.toFixed(2)}`);
    console.log(`Precio con margen 300%: $${p.precio_con_margen_300?.toFixed(2)}`);
    console.log(`Platform fee (12%): $${p.platform_fee?.toFixed(2)}`);
    console.log(`Precio B2B FINAL: $${p.precio_b2b?.toFixed(2)}`);
    console.log(`\n📐 Cálculo esperado: $${(p.costo_base * 4.0 * 1.12).toFixed(2)}`);
    console.log(`✓ Diferencia: $${Math.abs(p.precio_b2b - (p.costo_base * 4.0 * 1.12)).toFixed(2)}`);
  }
}

// Query 2: Sample of 10 products
const { data: products2, error: error2 } = await supabase
  .from('v_productos_con_precio_b2b')
  .select('sku_interno, nombre, costo_base, precio_con_margen_300, platform_fee, precio_b2b')
  .limit(10);

if (error2) {
  console.error('❌ Error en query 2:', error2.message);
} else {
  console.log('\n📊 Muestra de 10 productos con precios corregidos:');
  console.table(products2?.map(p => ({
    sku: p.sku_interno,
    nombre: p.nombre.substring(0, 30),
    costo: p.costo_base?.toFixed(2),
    margen_300: p.precio_con_margen_300?.toFixed(2),
    fee_12: p.platform_fee?.toFixed(2),
    precio_b2b: p.precio_b2b?.toFixed(2)
  })));
}

process.exit(0);
