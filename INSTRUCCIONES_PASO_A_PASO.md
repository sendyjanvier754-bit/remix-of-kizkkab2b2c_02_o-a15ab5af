# 🔧 REPARACIÓN PASO A PASO

Ejecuta estos archivos **UNO POR UNO** en el SQL Editor de Supabase:

## 📋 ORDEN DE EJECUCIÓN:

### 1️⃣ PASO_1_VERIFICAR_STORES.sql
- **Qué hace:** Verifica qué columnas tiene la tabla `stores`
- **Busca:** ¿Se llama `name` o `nombre`?
- **Acción:** Anota el nombre de la columna

### 2️⃣ PASO_2_DROP_FUNCION.sql
- **Qué hace:** Elimina la función anterior
- **Resultado esperado:** "DROP FUNCTION"

### 3️⃣ PASO_3_CREAR_FUNCION.sql
- **IMPORTANTE:** Antes de ejecutar, **ajusta la línea 45**:
  - Si en PASO_1 viste `name` → déjala como está: `s.name::TEXT`
  - Si en PASO_1 viste `nombre` → cámbiala a: `s.nombre::TEXT`
- **Qué hace:** Crea la función con la columna correcta
- **Resultado esperado:** "CREATE FUNCTION"

### 4️⃣ PASO_4_GRANT_PERMISOS.sql
- **Qué hace:** Da permisos y verifica la función
- **Resultado esperado:** Muestra la función con sus parámetros

### 5️⃣ PASO_5_PROBAR_FUNCION.sql
- **Qué hace:** Prueba si la función retorna datos
- **Resultado esperado:** 
  - Si tienes pedidos pagados: verás los datos
  - Si no tienes: verá "0" pero sin error

---

## ✅ DESPUÉS DE EJECUTAR LOS 5 PASOS:

1. Ve al navegador
2. Presiona **Ctrl+Shift+R** (recarga completa)
3. El error 400 debe desaparecer
4. Tu inventario B2C debe cargar

---

## ❌ SI HAY ERROR EN PASO_3:

Copia el mensaje de error completo y avísame.
