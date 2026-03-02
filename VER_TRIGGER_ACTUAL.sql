-- Ver el trigger actual
SELECT 
  proname as trigger_function,
  prosrc as code
FROM pg_proc 
WHERE proname = 'auto_add_to_seller_catalog_on_complete';
