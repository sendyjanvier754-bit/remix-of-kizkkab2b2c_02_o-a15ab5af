

## Plan: Simplificar sync_b2b_catalog_for_store

### Contexto

La sincronización B2B → B2C no necesita calcular PVP ni costos de envío. Su propósito es **hacer disponibles los productos B2B en el catálogo de la tienda** (como "pagados" y listos para vender). El cálculo de PVP y envío ocurre en tiempo de visualización cuando el comprador entra a la tienda.

### Cambios

**1. Actualizar la función `sync_b2b_catalog_for_store`:**

- Eliminar la emulación de contexto auth (`set_config('request.jwt.claim.sub', ...)`)
- Eliminar la dependencia de `v_business_panel_data`
- Leer directamente de `v_productos_con_precio_b2b` y `v_variantes_con_precio_b2b`
- Mapear los campos así:
  - `precio_venta` = `precio_b2b` (precio base; el PVP real se calcula al mostrar)
  - `precio_costo` = `precio_b2b`
  - `precio_b2b_base` = `precio_b2b`
  - `costo_logistica` = 0 (se calcula en tiempo real según el país del comprador)
  - `stock` = `stock_fisico` (producto) o `stock` (variante)
  - `images`, `category_id`, `nombre`, `sku` = datos directos del producto

### Sección Técnica

La migración SQL hará:

```sql
CREATE OR REPLACE FUNCTION public.sync_b2b_catalog_for_store(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ...
BEGIN
  -- Verificar tienda con auto_sync_b2b activado
  -- INSERT nuevos productos/variantes desde v_productos_con_precio_b2b + v_variantes_con_precio_b2b
  -- UPDATE existentes (respetando price_override)
  -- DEACTIVATE los que ya no están en B2B
  -- Log en b2b_sync_logs
  -- Sin emulación de auth, sin cálculo de país/envío
END;
$$;
```

Se mantiene `SECURITY DEFINER` para bypass de RLS al insertar en `seller_catalog`.

