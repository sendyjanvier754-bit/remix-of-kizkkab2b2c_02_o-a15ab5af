# 🎨 Configuración de Imágenes del Hero del Marketplace

## ✅ **El sistema ya está configurado**

Las imágenes del hero (carrusel principal) del marketplace **ya son configurables** desde el módulo de administración. No es necesario tocar código para cambiarlas.

---

## 📍 **Cómo acceder**

1. Ir a: **`/admin/banners`**
2. O desde el panel de administración → **"Gestión de Banners"**

---

## 🚀 **Pasos para configurar los banners**

### **Paso 1: Insertar banners por defecto** (Solo primera vez)

Si no aparecen banners en la lista, ejecutar el script SQL:

```bash
# Abrir Supabase Dashboard → SQL Editor
# Ejecutar el archivo: INSERT_DEFAULT_HERO_BANNERS.sql
```

Esto creará 3 banners iniciales con las imágenes actuales:
- `navidad-1.png` → "Bienvenido a Siver"
- `navidad-2.png` → "Explora Nuestras Ofertas"  
- `navidad-3.png` → "Nuevos Productos"

### **Paso 2: Editar un banner existente**

1. En `/admin/banners`, hacer clic en el botón **✏️ Editar**
2. Cambiar cualquiera de estos campos:
   - **Título**: Nombre interno del banner (no se muestra al público)
   - **Imagen**: 
     - Opción A: Subir nueva imagen (botón "Seleccionar imagen")
     - Opción B: Poner URL de imagen externa
   - **Link**: URL a donde redirige al hacer clic
   - **Público objetivo**: 
     - `B2C` → Solo clientes finales (marketplace público)
     - `Sellers` → Solo vendedores (panel B2B)
     - `Todos` → Ambos
   - **Activo**: Activar/desactivar el banner
   - **Orden**: Número de posición (1, 2, 3, etc.)

3. Hacer clic en **💾 Guardar**

### **Paso 3: Crear un nuevo banner**

1. En `/admin/banners`, hacer clic en **➕ Nuevo Banner**
2. Llenar el formulario con los mismos campos de arriba
3. Hacer clic en **💾 Crear**

### **Paso 4: Eliminar un banner**

1. Hacer clic en el botón **🗑️ Eliminar**
2. Confirmar la acción

---

## 🎯 **Características adicionales**

### **Banners temporales**

Puedes configurar banners para que se muestren solo en fechas específicas:

```sql
-- Ejemplo: Banner solo en Navidad
UPDATE admin_banners 
SET 
  starts_at = '2025-12-01 00:00:00',
  ends_at = '2025-12-31 23:59:59'
WHERE title = 'Promoción Navideña';
```

### **Control de orden**

Los banners se muestran según el campo `sort_order`:
- `1` → Primer banner
- `2` → Segundo banner
- `3` → Tercer banner, etc.

### **Múltiples públicos**

- `target_audience = 'b2c'` → Solo en `/marketplace` (público)
- `target_audience = 'sellers'` → Solo en `/seller/*` (vendedores)
- `target_audience = 'all'` → En ambos lados

---

## 📂 **Dónde subir las imágenes**

### **Opción 1: Storage público** (Recomendado)

Las imágenes se suben automáticamente a **Supabase Storage** cuando usas el botón "Seleccionar imagen" en el módulo:

- Bucket: `product-images` (o crear uno específico para banners)
- URL generada: `https://[project].supabase.co/storage/v1/object/public/...`

### **Opción 2: Rutas locales**

Poner las imágenes en la carpeta `public/` del proyecto:
```
public/
  ├── navidad-1.png
  ├── navidad-2.png
  ├── navidad-3.png
  └── hero/
      ├── verano-2024.png
      └── ofertas-especiales.png
```

Luego usar rutas como: `/navidad-1.png` o `/hero/verano-2024.png`

### **Opción 3: URLs externas**

Usar cualquier URL pública:
```
https://images.unsplash.com/photo-...
https://cdn.midominio.com/banner.jpg
https://ejemplo.com/imagenes/hero.png
```

---

## 🔍 **Verificación**

Después de configurar los banners:

1. Ir a **`/marketplace`** (o `/` si es la home)
2. Ver el carrusel del hero
3. Los banners deben aparecer automáticamente
4. Si no aparecen, verificar:
   - ✅ El banner está **activo** (`is_active = true`)
   - ✅ El `target_audience` es correcto (`b2c` para público)
   - ✅ Las fechas son válidas (o `starts_at` y `ends_at` son `null`)

---

## 🛠️ **Solución de problemas**

### **No aparecen los banners en el hero**

1. Verificar que existen banners en la base de datos:
```sql
SELECT * FROM admin_banners 
WHERE is_active = true 
  AND target_audience IN ('b2c', 'all')
ORDER BY sort_order;
```

2. Si no hay banners, ejecutar `INSERT_DEFAULT_HERO_BANNERS.sql`

3. Limpiar caché del navegador (Ctrl + F5)

### **La imagen no carga**

1. Verificar que la URL de la imagen es accesible
2. Si es ruta local (`/imagen.png`), verificar que el archivo existe en `public/`
3. Si es Supabase Storage, verificar que el bucket es público

### **Los cambios no se reflejan inmediatamente**

- El sistema usa caché de 5 minutos
- Esperar 5 minutos o recargar con Ctrl + F5

---

## 📊 **Estructura de la tabla**

```sql
CREATE TABLE admin_banners (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  target_audience TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## ✨ **Resumen**

- ✅ **Ya configurado**: No tocar código
- 🎨 **Gestión visual**: Interfaz en `/admin/banners`
- 📸 **Subida fácil**: Drag & drop de imágenes
- ⏰ **Programación**: Banners temporales opcionales
- 🎯 **Multi-público**: B2C, Sellers, o ambos
- 🔄 **Actualización automática**: Los cambios se reflejan en tiempo real

---

## 📞 **Soporte**

Si necesitas ayuda adicional, los archivos relevantes son:

- **Componente Hero**: `src/components/landing/HeroSection.tsx`
- **Hook de datos**: `src/hooks/useMarketplaceData.ts` → `useMarketplaceBanners()`
- **Módulo admin**: `src/pages/admin/AdminBanners.tsx`
- **Tabla DB**: `admin_banners`
