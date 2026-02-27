-- Ver TODOS los slugs actuales y sus formatos
SELECT 
  id,
  name,
  slug,
  LENGTH(slug) as slug_length,
  CASE 
    WHEN slug ~  '^K[0-9A-F]{10}\d{2}$' THEN '✅ UUID Crypto correcto'
    WHEN slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$' THEN '✅ Legacy correcto'
    WHEN slug ~ '^KZ\d+$' THEN '❌ FORMATO ANTIGUO INCORRECTO (KZ...)'
    WHEN slug LIKE 'K%' THEN '⚠️ Formato K desconocido'
    ELSE '❌ Formato inválido'
  END as formato_status,
  created_at,
  updated_at
FROM stores
WHERE slug IS NOT NULL
ORDER BY created_at DESC;

-- Contar por tipo de formato
SELECT 
  CASE 
    WHEN slug ~ '^K[0-9A-F]{10}\d{2}$' THEN 'UUID Crypto'
    WHEN slug ~ '^K\d{4}[A-Z]\d{6}\d{2}$' THEN 'Legacy'
    WHEN slug ~ '^KZ\d+$' THEN 'ANTIGUO KZ (MALO)'
    WHEN slug LIKE 'K%' THEN 'Otro formato K'
    ELSE 'Formato desconocido'
  END as formato,
  COUNT(*) as cantidad
FROM stores
WHERE slug IS NOT NULL
GROUP BY formato
ORDER BY cantidad DESC;
