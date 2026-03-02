-- Cuántas variantes se crearon
SELECT 
  '🎨 Variantes en seller_catalog_variants' as metrica,
  COUNT(*) as cantidad
FROM seller_catalog_variants;
