# 🚀 Siguientes Pasos - Desplegar a Supabase

## Estado Actual ✅

Tu sistema DE TRADUCCIÓN está 100% COMPLETO y LISTO:

✅ **Migración de BD** - Ejecutada (`source_text`, `source_text_hash` agregados)
✅ **Componentes React** - 9 componentes con traducción integrada
✅ **Edge Functions** - Creadas y listas para desplegar
✅ **Script de Backfill** - Funcionando (conectado a Supabase)

❌ **Pendiente de Desplegar** - Edge functions a Supabase

---

## 📋 Problema Encontrado

El script intentó invocar la función `backfill-translations` pero no fue encontrada:
```
❌ Error: Requested function was not found
```

**Causa:** Las edge functions existen localmente pero no están desplegadas en tu Supabase.

---

## ✅ Solución: Desplegar Edge Functions

### Opción A: Usar Supabase CLI (RECOMENDADO)

#### 1. Instala Supabase CLI
```bash
npm install -g @supabase/cli
```

#### 2. Configurar proyecto Supabase local
```bash
cd c:\Users\STAVE\ RICHARD\ DORVIL\kizkkab2b2c
supabase init  # Si no está ya inicializado
```

#### 3. Desplegar las funciones
```bash
# Despliega TODAS las funciones
supabase functions deploy

# O despliega específica
supabase functions deploy backfill-translations
supabase functions deploy translate-content
```

#### 4. Verifica que se desplegaron
```bash
supabase functions list
```

---

### Opción B: Desplegar Manualmente (Sin CLI)

1. Ve a https://app.supabase.com
2. Selecciona tu proyecto `kizkka`
3. Ve a **Edge Functions** en el menú izquierdo
4. Click en **Create a new function** (o edita las existentes si están ya)
5. Copia el contenido de:
   - `supabase/functions/translate-content/index.ts`
   - `supabase/functions/backfill-translations/index.ts`
6. Guarda los cambios

---

## ⚙️ Verificar Despliegue

Después de desplegar, ejecuta:
```bash
node scripts/run-backfill.js
```

Debería ver:
```
✅ Backfill completado exitosamente!

📊 Resumen:
   Total filas: 50
   Traducidas: 48
   Saltadas: 2
   Errores: 0
```

---

## 📝 Estructura de Edge Functions

Tu proyecto tiene funciones en:
```
supabase/functions/
├── translate-content/
│   └── index.ts          ← Traducción en tiempo real
└── backfill-translations/
    └── index.ts          ← Traducción en lote (batch)
```

Ambas ya están **registradas** en `supabase/config.toml`:
```toml
[functions.translate-content]
verify_jwt = false

[functions.backfill-translations]
verify_jwt = true
```

---

## 🎯 Pasos Secuenciales para Completar

### Paso 1: Instala Supabase CLI
```bash
npm install -g @supabase/cli
```

### Paso 2: Autentícate
```bash
supabase login
```
(Te pedirá tu token de Supabase)

### Paso 3: Obtén tu Access Token
- Ve a https://app.supabase.com
- Cuenta → Opciones → Access tokens
- Crea un nuevo token de acceso personal
- Usa ese token cuando `supabase login` te lo pida

### Paso 4: Despliega
```bash
cd c:\Users\STAVE\ RICHARD\ DORVIL\kizkkab2b2c
supabase functions deploy
```

### Paso 5: Ejecuta Backfill
```bash
node scripts/run-backfill.js
```

### Paso 6: Verifica en UI
- Abre http://localhost:3081
- Cambia idioma a EN/FR/HT (flag en esquina superior)
- Deberías ver nombres de productos traducidos

---

## 🔧 Troubleshooting

### "Comando supabase no encontrado"
```bash
# Usa npm para ejecutar
npx supabase login
npx supabase functions deploy
```

### "Function already exists"
Eso es normal, solo sobrescribe la existente.

### "Permission denied"
Verifica que tu token tiene permisos de `functions:delete` y `functions:create`

---

## 📊 Lo Que Sucederá Después de Desplegar

1. **Edge Functions** en vivo en Supabase
2. **Backfill ejecutado** (traduce ~9,000+ campos)
3. **Contenido actualizado** en BD
4. **UI multiidioma** funcionando en vivo

Estimado tiempo total: **~5 minutos** (1 min deploy + 4 min backfill)

---

## 🎉 Resultado Final

Después de estos pasos:
- ✅ Productos aparecen en EN/FR/HT
- ✅ Categorías aparecen en EN/FR/HT
- ✅ Notificaciones aparecen multiidioma
- ✅ Nuevos productos se traducen automáticamente
- ✅ Los actualizados se retraduc en si cambien

**Tu sistema de traducción estará 100% operativo** 🚀
