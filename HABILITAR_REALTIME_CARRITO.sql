-- =============================================================================
-- HABILITAR REALTIME para actualizaciones automáticas del carrito
-- =============================================================================
-- Ejecuta este script en el SQL Editor de Supabase Dashboard
-- =============================================================================

-- Verificar estado actual de Realtime
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('b2b_cart_items', 'b2b_carts', 'b2c_cart_items', 'b2c_carts')
ORDER BY tablename;

-- Habilitar Realtime en b2b_cart_items
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_cart_items;

-- Habilitar Realtime en b2b_carts
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_carts;

-- Verificar que se habilitaron correctamente
SELECT 
  '✅ REALTIME HABILITADO' as status,
  pubname || ' → ' || schemaname || '.' || tablename as "Tabla con Realtime"
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('b2b_cart_items', 'b2b_carts')
ORDER BY tablename;

-- =============================================================================
-- INFORMACIÓN IMPORTANTE
-- =============================================================================

/*

¿QUÉ HACE ESTO?

Habilita "Realtime" de Supabase en las tablas del carrito B2B.

Realtime = Cuando se hace INSERT/UPDATE/DELETE en la BD, el frontend
recibe una notificación instantánea y actualiza automáticamente sin refresh.


¿POR QUÉ NO FUNCIONABA?

Por defecto, Supabase NO envía notificaciones realtime a menos que
explícitamente agregues las tablas a la publicación "supabase_realtime".


¿QUÉ PASA DESPUÉS DE EJECUTAR ESTO?

1. Agregas un producto al carrito → La UI se actualiza INMEDIATAMENTE
2. Cambias la cantidad → Se recalcula el total EN TIEMPO REAL
3. Eliminas un item → Desaparece SIN REFRESH
4. Abres el carrito en 2 pestañas → Ambas se sincronizan automáticamente


¿FUNCIONA EN B2C TAMBIÉN?

No, este script solo habilita B2B. Si quieres B2C también, ejecuta:

ALTER PUBLICATION supabase_realtime ADD TABLE b2c_cart_items;
ALTER PUBLICATION supabase_realtime ADD TABLE b2c_carts;


PRÓXIMOS PASOS:

1. ✅ Ejecuta este script en SQL Editor
2. ✅ Verás el mensaje "✅ REALTIME HABILITADO"
3. ✅ Abre tu aplicación en el navegador
4. ✅ Agrega un producto al carrito
5. ✅ ¡Debe aparecer INMEDIATAMENTE sin refrescar!

Si no funciona:
- Verifica que el hook useB2BCartItems.ts tenga la suscripción (ya la tiene)
- Revisa la consola del navegador para ver los mensajes:
  * "Setting up real-time subscription for b2b_cart_items"
  * "Real-time cart item update received:"
- Si no ves esos mensajes, puede que haya un problema con las políticas RLS

*/
