# ⚡ QUICK START - IMPLEMENTACIÓN EN 1 HORA

## 🎯 Meta: Tener precios dinámicos funcionando hoy

**Tiempo total**: ~60 minutos  
**Pasos**: 6  
**Dificultad**: Fácil  

---

## ⏱ TIMELINE

| Tiempo | Tarea | Duración |
|--------|-------|----------|
| 0:00 - 0:05 | Leer este documento | 5 min |
| 0:05 - 0:15 | Leer EXECUTIVE_SUMMARY | 10 min |
| 0:15 - 0:25 | Ejecutar SQL en Supabase | 10 min |
| 0:25 - 0:30 | Verificar que funcionó | 5 min |
| 0:30 - 0:55 | Actualizar código frontend | 25 min |
| 0:55 - 1:00 | Testing local | 5 min |

---

## ✅ PASO 1: Entender el Concepto (5 min)

```
LEE: EXECUTIVE_SUMMARY_DYNAMIC_PRICING.md
```

**Objetivo**: Entender QUÉ es lo que vas a hacer y POR QUÉ

**Puntos clave**:
- ✓ Antes: cálculo disperso en frontend
- ✓ Después: cálculo centralizado en BD
- ✓ Resultado: cambios automáticos sin editar código
- ✓ Variables en componentes: NO cambian

**Si entiendes esto, continúa. Si no, relée.**

---

## ✅ PASO 2: Aplicar SQL en Supabase (10 min)

### Opción A: Copy-Paste (Recomendado)

1. Abre: https://app.supabase.com/project/fonvunyiaxcjkodrnpox/sql/new
2. Abre archivo: `COPY_PASTE_SQL.md` EN ESTA CARPETA
3. Copia TODO el SQL del archivo
4. Pega en Supabase SQL Editor
5. Haz clic en "RUN" (botón superior derecho)
6. Espera 5-10 segundos

**Resultado esperado**:
```
✓ Éxito (sin errores rojos)
```

Si ves errores:
```
⚠ "relation ... already exists" = NORMAL, ignorar
✗ Error SQL completo en rojo = Problema, ver TROUBLESHOOTING abajo
```

### Opción B: Manual por partes

Si la opción A falla:
1. Abre: `MANUAL_MIGRATION_STEPS.md`
2. Sigue las "Parte 1, 2, 3, 4"
3. Ejecuta cada parte por separado

---

## ✅ PASO 3: Verificar que Funcionó (5 min)

En Supabase SQL Editor, ejecuta:

```sql
SELECT 
  id,
  sku_interno,
  nombre,
  precio_b2b,
  stock_fisico
FROM public.v_productos_con_precio_b2b
LIMIT 3;
```

**Resultado esperado**:
```
id       sku_interno  nombre       precio_b2b  stock_fisico
------   -----------  ----------   ----------  -----------
uuid123  SKU-001      Producto A   12.50       150
uuid456  SKU-002      Producto B   15.75       200
uuid789  SKU-003      Producto C   18.00       100
```

Si ves esto → ✓ ¡SQL funcionó! Continúa con paso 4.

Si no ves esto → ❌ Problema. Ve a TROUBLESHOOTING abajo.

---

## ✅ PASO 4: Actualizar Servicios Frontend (25 min)

**Archivo a cambiar**: `src/services/productService.ts` (o similar)

### Búsqueda y Reemplazo Rápido

En VS Code:
1. Presiona `Ctrl+H` (Find and Replace)
2. **Buscar**: `.from('products')`
3. **Reemplazar**: `.from('v_productos_con_precio_b2b')`
4. Reemplazar TODOS (excepto en comentarios)

### Ejemplo de cambio:

**ANTES**:
```typescript
export async function getProducts() {
  return supabase
    .from('products')  // ← CAMBIAR
    .select('*')
    .eq('is_active', true);
}
```

**DESPUÉS**:
```typescript
export async function getProducts() {
  return supabase
    .from('v_productos_con_precio_b2b')  // ← ACTUALIZADO
    .select('*')
    .eq('is_active', true);
}
```

### Archivos a actualizar:

- [ ] `src/services/productService.ts` (o `catalogService.ts`)
- [ ] `src/services/cartService.ts`
- [ ] `src/hooks/useProducts.ts` (si existe)
- [ ] Buscar y reemplazar `.from('products')` en toda la carpeta `src/`

**Pista**: Si una consulta es compleja, solo asegúrate de que lea de la vista, no de la tabla.

### Herramientas útiles en VS Code:

```
Ctrl+Shift+F  → Find in Files
Ctrl+H        → Find and Replace
Ctrl+Alt+Enter → Replace All
```

---

## ✅ PASO 5: Testing Local (5 min)

### Test 1: ¿Cargan los productos?

1. Inicia la app local: `npm run dev`
2. Ve a la página de catálogo
3. Deberías ver productos con precios

**Esperado**: `Producto A - $12.50` (o similar)

**Si ves error**:
```
ERROR: relation "v_productos_con_precio_b2b" does not exist
→ Solución: SQL no se ejecutó bien en Supabase. Repite Paso 2.
```

### Test 2: ¿El precio es dinámico?

1. En Supabase dashboard:
   ```sql
   UPDATE route_logistics_costs
   SET cost_per_kg = 50  -- cambio temporal
   WHERE segment = 'china_to_transit' LIMIT 1;
   ```

2. En la app local, recarga la página (F5)

3. Los precios deberían haber subido

**Si subió**: ✓ ¡Funciona! El precio es dinámico.

**Si no subió**: ❌ Los servicios aún consultan tabla vieja. Revisa Paso 4.

### Test 3: Revertir el cambio

```sql
UPDATE route_logistics_costs
SET cost_per_kg = 2.50  -- valor original
WHERE segment = 'china_to_transit' LIMIT 1;
```

---

## ✅ PASO 6: Deploy (Opcional hoy)

Si todo funciona en local:

```bash
git add -A
git commit -m "feat: Update services to use dynamic pricing view"
git push
```

Luego en servidor de producción:
```bash
npm run build
npm run start
```

---

## 🆘 TROUBLESHOOTING RÁPIDO

### Error 1: "relation ... does not exist"
```
❌ Vista no existe
✓ Solución: Ejecuta de nuevo el SQL (Paso 2)
```

### Error 2: "column precio_b2b does not exist"
```
❌ Componente aún lee de tabla vieja
✓ Solución: Verifica que consultas usen v_productos_con_precio_b2b
```

### Error 3: "precio_b2b es NULL"
```
❌ Función de cálculo no retorna valor
✓ Solución: Verifica que route_logistics_costs tiene datos
```

### Error 4: Precios no se actualizan
```
❌ Frontend cachea datos
✓ Solución: Limpia cache (F5 en navegador)
```

### Error 5: Queries muy lentas
```
❌ Faltan índices
✓ Solución: Asegúrate de ejecutar la "Parte 4" del SQL (índices)
```

---

## 📝 CHECKLIST FINAL

```
ANTES DE TERMINAR:

Paso 1 - Entender:
  [ ] Leí EXECUTIVE_SUMMARY
  [ ] Entiendo que cambios son automáticos
  [ ] Sé que componentes NO necesitan cambios

Paso 2 - SQL:
  [ ] Ejecuté SQL en Supabase
  [ ] No hay errores críticos

Paso 3 - Verificar:
  [ ] Query de verificación retorna datos
  [ ] Veo precios dinámicos

Paso 4 - Código:
  [ ] Actualicé productService.ts
  [ ] Actualicé cartService.ts
  [ ] Busqué y reemplacé todas las consultas a 'products'

Paso 5 - Testing:
  [ ] Catálogo carga sin errores
  [ ] Precios se ven correctos
  [ ] (Opcional) Cambié un flete y precios se actualizaron

Paso 6 - Deploy:
  [ ] Hice commit y push
  [ ] (Opcional) Desplegué a producción
```

---

## 🎉 ¿LISTO?

Si marcaste todos los checkboxes:

✅ **¡CONGRATULATIONS! Tienes precios dinámicos funcionando.**

Ahora:
- Los precios se calculan en BD (no en frontend)
- Si admin cambia un costo, se propaga automáticamente
- Todos los componentes usan la misma fuente de datos
- Sin cambios en variables de componentes

---

## 📞 AYUDA

¿Algo no funciona?

1. Lee: `MANUAL_MIGRATION_STEPS.md`
2. Lee: `DYNAMIC_PRICING_IMPLEMENTATION.md`
3. Consulta: `ARCHITECTURE_DIAGRAMS.md`

---

## ⏱ TIEMPO ESTIMADO

- Si todo funciona: **60 minutos**
- Si necesitas troubleshoot: **90 minutos**
- Si empiezas desde cero: **2 horas**

---

**Quick Start Version**: 1.0  
**Última actualización**: 31 de Enero, 2026  
**Estado**: Listo para comenzar

🚀 **¡Vamos!**

