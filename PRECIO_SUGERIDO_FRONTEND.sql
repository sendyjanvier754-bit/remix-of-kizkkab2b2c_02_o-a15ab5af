-- =============================================================================
-- RESUMEN: PRECIO SUGERIDO DE VENTA EN EL FRONTEND
-- =============================================================================

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║               DÓNDE SE MUESTRA EL PRECIO SUGERIDO EN EL FRONTEND          ║
╚═══════════════════════════════════════════════════════════════════════════╝

📍 UBICACIÓN PRINCIPAL:
   Archivo: src/components/seller/inventory/PublicacionDialog.tsx
   Líneas: 123-133

📝 DESCRIPCIÓN:
   El precio sugerido se muestra cuando un seller:
   1. Va a su Inventario
   2. Quiere publicar un producto en su tienda B2C
   3. Abre el diálogo de "Publicación"

💰 LO QUE VE EL SELLER:
   
   ┌─────────────────────────────────────────────┐
   │  📊 Precio Sugerido de Venta                │
   │                                             │
   │  Recomendado: $15.76                        │
   │  [Usar este precio] ← Botón                 │
   └─────────────────────────────────────────────┘

🔄 FLUJO COMPLETO:

   1. Hook: useSellerCatalog.ts (línea 24)
      └─ Obtiene precioSugeridoVenta: number | null

   2. Vista SQL: v_seller_inventory o seller_catalog
      └─ Campos:
         • precio_sugerido_venta (del producto original)
         • Calculado por: calculate_suggested_pvp(product_id)

   3. Componente: PublicacionDialog.tsx
      └─ Muestra el precio sugerido
      └─ Botón "Usar este precio" lo copia al campo precio_venta

   4. Seller puede:
      ✓ Ver el precio sugerido
      ✓ Usar el precio sugerido (clic en botón)
      ✓ O poner su propio precio manualmente

╔═══════════════════════════════════════════════════════════════════════════╗
║                       OTROS LUGARES DONDE APARECE                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

📍 ADMIN: ProductFormDialog.tsx
   Ubicación: src/components/catalog/ProductFormDialog.tsx
   Línea: 233-244
   
   El ADMIN puede configurar el precio_sugerido_venta cuando:
   - Crea un producto nuevo
   - Edita un producto existente
   
   Campo: "Precio Sugerido Venta" (opcional)
   └─ Si el admin lo configura, este precio tiene PRIORIDAD 1
   └─ Si no lo configura, se calcula automáticamente

╔═══════════════════════════════════════════════════════════════════════════╗
║                         CÓDIGO DEL FRONTEND                               ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

-- Verificar productos con precio_sugerido_venta configurado
SELECT 
  p.sku_interno,
  p.nombre,
  ROUND(p.precio_sugerido_venta, 2) as precio_sugerido_admin,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND(((p.precio_sugerido_venta - vb2b.precio_b2b) / NULLIF(vb2b.precio_b2b, 0) * 100)::numeric, 0) || '%' as markup,
  'Configurado por ADMIN' as origen
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
WHERE p.is_active = TRUE
  AND p.precio_sugerido_venta IS NOT NULL
  AND p.precio_sugerido_venta > 0
  AND vb2b.precio_b2b > 0
ORDER BY p.updated_at DESC
LIMIT 10;

-- Ver productos SIN precio sugerido configurado (se calcula automático)
SELECT 
  p.sku_interno,
  p.nombre,
  p.precio_sugerido_venta as admin_no_configuro,
  ROUND(vb2b.precio_b2b, 2) as precio_b2b,
  ROUND(public.calculate_suggested_pvp(p.id, NULL), 2) as calculado_automatico,
  'Se calcula automático' as origen
FROM products p
JOIN v_productos_con_precio_b2b vb2b ON vb2b.id = p.id
WHERE p.is_active = TRUE
  AND (p.precio_sugerido_venta IS NULL OR p.precio_sugerido_venta = 0)
  AND vb2b.precio_b2b > 0
ORDER BY p.updated_at DESC
LIMIT 10;

/*
╔═══════════════════════════════════════════════════════════════════════════╗
║                          CAPTURA DEL CÓDIGO                               ║
╚═══════════════════════════════════════════════════════════════════════════╝

ARCHIVO: src/components/seller/inventory/PublicacionDialog.tsx
LÍNEAS: 123-133

{item.precioSugeridoVenta && (
  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
    <p className="text-sm text-green-700 font-medium mb-1">
      📊 Precio Sugerido de Venta
    </p>
    <p className="text-lg font-bold text-green-900">
      ${item.precioSugeridoVenta.toFixed(2)}
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 w-full"
      onClick={() => setPrecioVenta(item.precioSugeridoVenta?.toString() || "")}
    >
      Usar este precio
    </Button>
  </div>
)}

╔═══════════════════════════════════════════════════════════════════════════╗
║                        RESUMEN DE LA JERARQUÍA                            ║
╚═══════════════════════════════════════════════════════════════════════════╝

BASE DE DATOS → FUNCIÓN → VISTA → HOOK → COMPONENTE

1. products.precio_sugerido_venta (columna)
2. calculate_suggested_pvp(product_id) (función SQL)
3. v_productos_con_precio_b2b (vista)
4. useSellerCatalog.ts (hook React)
5. PublicacionDialog.tsx (componente visual)
*/
