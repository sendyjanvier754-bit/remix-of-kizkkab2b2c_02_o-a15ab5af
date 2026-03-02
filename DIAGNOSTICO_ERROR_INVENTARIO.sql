-- =====================================================
-- DIAGNÓSTICO: Error get_inventario_b2c
-- =====================================================

-- 1. Verificar si la función existe
SELECT 
  '🔍 FUNCIÓN EXISTE?' as check,
  p.proname as nombre,
  pg_get_function_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid) as retorna
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventario_b2c';

-- 2. Verificar si el tipo existe
SELECT 
  '🔍 TIPO EXISTE?' as check,
  t.typname as nombre_tipo,
  COUNT(a.attname) as cantidad_campos
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_attribute a ON a.attrelid = t.typrelid AND a.attnum > 0
WHERE n.nspname = 'public'
  AND t.typname = 'inventario_b2c_item'
GROUP BY t.typname;

-- 3. Ver el código completo de la función (para debug)
SELECT 
  '📜 DEFINICIÓN FUNCIÓN' as info,
  pg_get_functiondef(p.oid) as definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_inventario_b2c';

-- 4. Verificar errores en logs de Postgres (si tienes acceso)
-- Esta parte solo funciona si tienes acceso a pg_stat_statements

-- 5. Probar ejecución directa (sin parámetros)
SELECT '🧪 PRUEBA DIRECTA' as test;
-- Intenta ejecutar:
-- SELECT * FROM get_inventario_b2c();

SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 ERROR 400 DETECTADO

Posibles causas:
1. Función no existe → Ejecutar FUNCION_INVENTARIO_B2C_SEGURA.sql
2. Tipo no existe → El CREATE TYPE falló
3. Error en la función → Ver definición arriba
4. Problema de permisos → GRANT no funcionó

SOLUCIÓN:
Ejecuta el script de reparación siguiente...

' as diagnostico;
