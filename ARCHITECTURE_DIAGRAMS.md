# 🎨 ARQUITECTURA VISUAL - PRECIOS DINÁMICOS

## Antes vs Después

```
╔════════════════════════════════════════════════════════════════════════════╗
║                         ANTES - CÁLCULO DISPERSO                          ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Frontend Componentes:                                                    ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         ║
║  │ ProductCard.tsx  │  │ CartItem.tsx     │  │ InvestorDash...  │         ║
║  │                  │  │                  │  │                  │         ║
║  │ calculatePrice() │  │ calculatePrice() │  │ calculatePrice() │         ║
║  │ resultado: $10   │  │ resultado: $10   │  │ resultado: $10   │         ║
║  └──────────────────┘  └──────────────────┘  └──────────────────┘         ║
║         ↓                     ↓                      ↓                     ║
║    (¿Inconsistencia?)    (¿Inconsistencia?)    (¿Inconsistencia?)         ║
║                                                                            ║
║  Base de datos:                                                           ║
║  ┌──────────────────────────────────────────────────────────────┐         ║
║  │ tabla products                                               │         ║
║  │ • precio_mayorista = $10 (estático, nunca se actualiza)      │         ║
║  │ • Si admin cambio flete: nadie se entera                     │         ║
║  └──────────────────────────────────────────────────────────────┘         ║
║                                                                            ║
║  Problema: Cambios en logística = editar 5+ archivos            ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════════════╗
║                      DESPUÉS - CÁLCULO CENTRALIZADO                        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Frontend Componentes (SIN CAMBIOS):                                      ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         ║
║  │ ProductCard.tsx  │  │ CartItem.tsx     │  │ InvestorDash...  │         ║
║  │                  │  │                  │  │                  │         ║
║  │ {product.       │  │ {item.           │  │ {product.        │         ║
║  │  precio_b2b}    │  │  precio_b2b}     │  │  precio_b2b}     │         ║
║  │ resultado: $12  │  │ resultado: $12   │  │ resultado: $12   │         ║
║  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘         ║
║           │                     │                     │                   ║
║           └─────────────────────┴─────────────────────┘                   ║
║                                 ↓                                         ║
║  Base de Datos (THE SOURCE OF TRUTH):                                    ║
║  ┌──────────────────────────────────────────────────────────────┐         ║
║  │ v_productos_con_precio_b2b (VISTA)                          │         ║
║  │                                                              │         ║
║  │ SELECT calculate_b2b_price(id, market_id, country)          │         ║
║  │   Fórmula: $5 + $3 + $2 + $2(fees) = $12 ✓                  │         ║
║  │                                                              │         ║
║  │ Hechos en tiempo real:                                       │         ║
║  │ • Si admin cambia flete de $3 → $5: resultado = $14 al      │         ║
║  │   instante en TODOS los componentes                          │         ║
║  │ • Si cambia fee de 12% → 15%: resultado = $15 automático    │         ║
║  │                                                              │         ║
║  └──────────────────────────────────────────────────────────────┘         ║
║                                                                            ║
║  Ventaja: Cambios automáticos = sin editar código              ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────┐
│ USUARIO FINAL ABRE CATÁLOGO                                         │
└────────────────────────────┬──────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: src/components/Catalog.tsx                               │
│                                                                     │
│ const products = await supabase                                    │
│   .from('v_productos_con_precio_b2b')  ← VISTA DINÁMICA            │
│   .select('*')                                                     │
│   .eq('categoria_id', categoryId)                                  │
│                                                                     │
│ return products.map(p => <ProductCard price={p.precio_b2b} />)    │
└────────────────────────────┬──────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SUPABASE POSTGRESQL - FUNCIÓN CALCULA PRECIO                        │
│                                                                     │
│ SELECT * FROM v_productos_con_precio_b2b WHERE category = '...'   │
│                            ↓                                       │
│ Para cada producto:                                                │
│ SELECT calculate_b2b_price(product_id, market_id, country_id)     │
│                            ↓                                       │
│ Función calcula:                                                   │
│   1. Costo Fábrica        ($5.00)                                  │
│   2. + Costo Tramo A      ($2.50)  ← from route_logistics_costs   │
│   3. + Costo Tramo B      ($2.00)  ← from route_logistics_costs   │
│   4. + Platform Fee (12%) ($1.50)  ← AUTOMÁTICO                   │
│   ───────────────────────────────                                  │
│   = PRECIO FINAL          ($11.00)                                 │
│                                                                     │
└────────────────────────────┬──────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│ RESULTADO AL USUARIO                                               │
│                                                                     │
│ Producto: Widget A                                                 │
│ Precio B2B: $11.00  ← DINÁMICO, calculado en tiempo real           │
│ Stock: 150 unidades                                                │
│ Acción: Agregar a carrito                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Actualización Automática

```
┌──────────────────────────────────────────────────────────────────┐
│ ADMIN CAMBIA COSTO DE FLETE EN MÓDULO DE LOGÍSTICA              │
└──────────────────┬───────────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ UPDATE route_logistics_costs                                     │
│ SET cost_per_kg = 5.50  ← WAS: 2.50                             │
│ WHERE segment = 'china_to_transit'                              │
└──────────────────┬───────────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ VISTA SE ACTUALIZA AUTOMÁTICAMENTE                              │
│                                                                  │
│ v_productos_con_precio_b2b recalcula:                           │
│   Costo Fábrica ($5.00)                                         │
│ + Tramo A: AHORA $5.50 (antes $2.50) ← CAMBIO PROPAGADO        │
│ + Tramo B ($2.00)                                               │
│ + Fees ($1.50)                                                  │
│ = $14.00 (antes $11.00)                                         │
│                                                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ USUARIO ABRE CATÁLOGO → VE PRECIO ACTUALIZADO AL INSTANTE       │
│                                                                  │
│ Antes: Producto Widget A = $11.00                               │
│ Después: Producto Widget A = $14.00  ← ¡CAMBIO AUTOMÁTICO!      │
│                                                                  │
│ Sin necesidad de:                                                │
│ ✗ Editar código frontend                                        │
│ ✗ Recompilar la app                                             │
│ ✗ Hacer deploy                                                  │
│ ✗ Editar múltiples archivos                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Componentes de Arquitectura

```
                    ┌─ CONSULTA ─────────────────────┐
                    │                                 │
                    ↓                                 ↓
        ┌────────────────────────┐    ┌──────────────────────────┐
        │ Frontend Services      │    │ PostgreSQL Functions     │
        │                        │    │                          │
        │ • productService.ts    │───→│ calculate_b2b_price()    │
        │ • catalogService.ts    │    │                          │
        │ • cartService.ts       │    │ (Lógica centralizada)    │
        │ • marketService.ts     │    │                          │
        └────────────────────────┘    └──────────────────────────┘
                    ↑                         ↑
                    │                         │
                    │                    ┌────┴─────────┐
                    │                    │              │
                    │         ┌──────────────┐   ┌──────────────┐
                    │         │ route_       │   │ products     │
                    │         │ logistics_   │   │              │
                    │         │ costs        │   │ • costo_base │
                    │         │              │   │ • weight_kg  │
                    │         │ • segment    │   │ • dimensions │
                    │         │ • cost_per_kg│  │              │
                    │         └──────────────┘   └──────────────┘
                    │
                    │
        ┌────────────────────────┐
        │ Frontend Components    │
        │                        │
        │ • ProductCard.tsx      │
        │   {product.precio_b2b} │
        │                        │
        │ • CartItem.tsx         │
        │   {item.precio_b2b}    │
        │                        │
        │ • InvestorDash.tsx     │
        │   {product.precio_b2b} │
        │                        │
        │ ← SIN CAMBIOS          │
        └────────────────────────┘
```

---

## Vistas SQL Disponibles

```
┌─────────────────────────────────────────────────────────────────┐
│ v_productos_con_precio_b2b (USO PRINCIPAL)                     │
│                                                                 │
│ SELECT * FROM v_productos_con_precio_b2b                       │
│                                                                 │
│ Campos:                                                         │
│ • id, sku_interno, nombre                                      │
│ • precio_b2b ← DINÁMICO (calculado)                            │
│ • stock_fisico, categoria_id, ...                              │
│ • y TODOS los campos de products                               │
│                                                                 │
│ Uso: Catálogo, búsqueda, carrito                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ v_productos_mercado_precio (MULTI-MERCADO)                     │
│                                                                 │
│ SELECT * FROM v_productos_mercado_precio                       │
│                                                                 │
│ Campos:                                                         │
│ • id, sku_interno, nombre                                      │
│ • precio_b2b ← POR MERCADO (dinámico)                          │
│ • market_id, market_name, market_currency                      │
│ • destination_country_id, destination_country_name             │
│                                                                 │
│ Uso: Consultas específicas de mercado                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ v_pricing_breakdown (SOLO ADMIN)                               │
│                                                                 │
│ SELECT * FROM v_pricing_breakdown                              │
│                                                                 │
│ Campos:                                                         │
│ • product_id, sku_interno, nombre                              │
│ • costo_fabrica (desglose)                                     │
│ • costo_tramo_a (desglose)                                     │
│ • costo_tramo_b (desglose)                                     │
│ • fee_plataforma (desglose)                                    │
│ • precio_b2b_final (total)                                     │
│ • market_id, destination_country                               │
│                                                                 │
│ Uso: Panel Admin, auditoría, transparencia                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Matriz de Impacto

```
┌───────────────────┬─────────────┬──────────────────────────────┐
│ Aspecto           │ Antes       │ Después                      │
├───────────────────┼─────────────┼──────────────────────────────┤
│ Fuente de Datos   │ 5+ archivos │ 1 función (BD)               │
│ Actualización     │ Manual      │ Automática                   │
│ Riesgo            │ Alto        │ Bajo                         │
│ Complejidad       │ Alta        │ Baja                         │
│ Mantenimiento     │ Difícil     │ Fácil                        │
│ Variables .tsx    │ Sin cambios │ Sin cambios ✓                │
│ Performance       │ Variable    │ Optimizado                   │
│ Seguridad         │ Cliente     │ Servidor (más seguro)        │
├───────────────────┼─────────────┼──────────────────────────────┤
│ IMPACTO TOTAL     │ ⚠ Frágil    │ ✓ Robusto                    │
└───────────────────┴─────────────┴──────────────────────────────┘
```

---

## Resumen Visual

```
╔════════════════════════════════════════════════════════════════════╗
║                  NUEVA ARQUITECTURA DE PRECIOS                     ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║                    ┌─────────────────────┐                        ║
║                    │   FRONTEND APPS     │                        ║
║                    │                     │                        ║
║                    │ {product.precio_b2b}│                        ║
║                    └──────────┬──────────┘                        ║
║                               │ CONSULTA                          ║
║                               ↓                                   ║
║                    ┌─────────────────────────┐                   ║
║                    │ v_productos_con_       │                   ║
║                    │ precio_b2b (VISTA)      │                   ║
║                    │                         │                   ║
║                    │ precio_b2b DINÁMICO ✓  │                   ║
║                    └──────────┬──────────────┘                   ║
║                               │                                  ║
║                    ┌──────────┴──────────┐                       ║
║                    ↓                     ↓                       ║
║        ┌────────────────────┐  ┌──────────────────┐             ║
║        │ calculate_b2b_     │  │ route_logistics_ │             ║
║        │ price()            │  │ costs            │             ║
║        │                    │  │ (admin updatea)  │             ║
║        │ Costo_Fabrica +    │  │                  │             ║
║        │ Tramo_A +          │  │ Si cambia:       │             ║
║        │ Tramo_B +          │  │ → Vista recalcula│             ║
║        │ Platform_Fees      │  │ → Apps actualiza │             ║
║        │ = precio_b2b ✓     │  │                  │             ║
║        └────────────────────┘  └──────────────────┘             ║
║                                                                    ║
║  ✓ Transparencia: Desglose visible en v_pricing_breakdown        ║
║  ✓ Consistencia: Todos usan la misma fuente                      ║
║  ✓ Automatización: Cambios se propagan al instante               ║
║  ✓ Seguridad: Cálculo en servidor, no en cliente                 ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

**Diagrama creado**: 31 de Enero, 2026  
**Versión**: 1.0  
**Estado**: Listo para referencia

