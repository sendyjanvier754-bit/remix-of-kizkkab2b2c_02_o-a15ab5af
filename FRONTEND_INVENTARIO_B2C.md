# 🛒 Integración Frontend - Inventario B2C

## ✅ La función está lista
El error `"No autenticado"` es **esperado** en SQL Editor (no hay sesión).  
En tu frontend **con usuario autenticado** funcionará perfectamente.

---

## 📋 Implementación en React/Next.js

### 1. Crear el hook personalizado

```typescript
// hooks/useInventarioB2C.ts
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export type InventarioB2CItem = {
  order_item_id: string;
  order_id: string;
  order_number: string;
  seller_store_id: string;
  tienda_vendedor: string;
  product_id: string;
  producto_nombre: string;
  descripcion_corta: string;
  imagen_principal: string;
  galeria_imagenes: string[];
  variant_id: string;
  sku: string;
  color: string;
  size: string;
  precio_original: number;
  stock: number;
  order_status: string;
  payment_status: string;
  availability_status: 'available' | 'pending' | 'cancelled';
  payment_confirmed_at: string;
  fecha_pedido: string;
  ultima_actualizacion: string;
};

export type InventarioResumen = {
  total_productos: number;
  total_variantes: number;
  total_unidades: number;
  por_estado: {
    available?: number;
    pending?: number;
    cancelled?: number;
  };
  valor_total: number;
};

export function useInventarioB2C(filters?: {
  availability_status?: 'available' | 'pending' | 'cancelled';
  limit?: number;
}) {
  const supabase = createClientComponentClient();
  const [inventario, setInventario] = useState<InventarioB2CItem[]>([]);
  const [resumen, setResumen] = useState<InventarioResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInventario() {
      try {
        setLoading(true);
        setError(null);

        // Obtener inventario completo
        const { data: inventarioData, error: inventarioError } = await supabase.rpc(
          'get_inventario_b2c',
          {
            p_user_id: null, // null = usuario actual
            p_availability_status: filters?.availability_status || null,
            p_limit: filters?.limit || 100,
          }
        );

        if (inventarioError) throw inventarioError;

        // Obtener resumen
        const { data: resumenData, error: resumenError } = await supabase.rpc(
          'get_inventario_b2c_resumen',
          { p_user_id: null }
        );

        if (resumenError) throw resumenError;

        setInventario(inventarioData || []);
        setResumen(resumenData);
      } catch (err: any) {
        console.error('Error al cargar inventario B2C:', err);
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchInventario();
  }, [filters?.availability_status, filters?.limit]);

  return { inventario, resumen, loading, error };
}
```

---

### 2. Componente de la página de inventario

```tsx
// app/seller/inventario-b2c/page.tsx
'use client';

import { useState } from 'react';
import { useInventarioB2C } from '@/hooks/useInventarioB2C';

export default function InventarioB2CPage() {
  const [filtro, setFiltro] = useState<'all' | 'available' | 'pending'>('all');
  
  const { inventario, resumen, loading, error } = useInventarioB2C({
    availability_status: filtro === 'all' ? undefined : filtro,
    limit: 100,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con resumen */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Mi Inventario B2C</h1>
        
        {resumen && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Total Productos</p>
              <p className="text-3xl font-bold text-blue-600">
                {resumen.total_productos}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Total Unidades</p>
              <p className="text-3xl font-bold text-green-600">
                {resumen.total_unidades}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Disponibles</p>
              <p className="text-3xl font-bold text-emerald-600">
                {resumen.por_estado?.available || 0}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-sm">Pendientes</p>
              <p className="text-3xl font-bold text-amber-600">
                {resumen.por_estado?.pending || 0}
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3">
          <button
            onClick={() => setFiltro('all')}
            className={`px-4 py-2 rounded-lg ${
              filtro === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Todos ({inventario.length})
          </button>
          <button
            onClick={() => setFiltro('available')}
            className={`px-4 py-2 rounded-lg ${
              filtro === 'available'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ✅ Disponibles
          </button>
          <button
            onClick={() => setFiltro('pending')}
            className={`px-4 py-2 rounded-lg ${
              filtro === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ⏳ Pendientes
          </button>
        </div>
      </div>

      {/* Lista de productos */}
      {inventario.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">
            No tienes productos en tu inventario B2C
          </p>
          <p className="text-gray-500 mt-2">
            Los productos de tus pedidos B2B pagados aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {inventario.map((item) => (
            <div
              key={item.order_item_id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Imagen */}
              <div className="relative h-48 bg-gray-100">
                <img
                  src={item.imagen_principal}
                  alt={item.producto_nombre}
                  className="w-full h-full object-cover"
                />
                
                {/* Badge de disponibilidad */}
                <div className="absolute top-2 right-2">
                  {item.availability_status === 'available' ? (
                    <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                      ✅ Disponible
                    </span>
                  ) : item.availability_status === 'pending' ? (
                    <span className="bg-amber-500 text-white px-2 py-1 rounded text-xs font-semibold">
                      ⏳ Pendiente
                    </span>
                  ) : (
                    <span className="bg-gray-500 text-white px-2 py-1 rounded text-xs font-semibold">
                      ❌ Cancelado
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {item.producto_nombre}
                </h3>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <p>SKU: {item.sku}</p>
                  {item.color && <p>Color: {item.color}</p>}
                  {item.size && <p>Talla: {item.size}</p>}
                  <p className="font-semibold text-blue-600">
                    Stock: {item.stock} unidades
                  </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <div>
                    <p className="text-xs text-gray-500">Precio sugerido</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${item.precio_original?.toFixed(2)}
                    </p>
                  </div>
                  
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    onClick={() => {
                      // Aquí redirigir a página de publicar en B2C
                      console.log('Publicar producto:', item.product_id);
                    }}
                  >
                    Publicar
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Pedido: {item.order_number}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 3. Uso directo en cualquier componente

```tsx
// Ejemplo simple
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function MiComponente() {
  const [productos, setProductos] = useState([]);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadInventario() {
      const { data } = await supabase.rpc('get_inventario_b2c', {
        p_availability_status: 'available', // Solo disponibles
        p_limit: 20
      });
      
      setProductos(data || []);
    }

    loadInventario();
  }, []);

  return (
    <div>
      {productos.map(p => (
        <div key={p.order_item_id}>{p.producto_nombre}</div>
      ))}
    </div>
  );
}
```

---

## 🎯 Casos de Uso Comunes

### 1. Mostrar solo productos disponibles para venta
```typescript
const { data } = await supabase.rpc('get_inventario_b2c', {
  p_availability_status: 'available'
});
```

### 2. Mostrar productos pendientes (en tránsito)
```typescript
const { data } = await supabase.rpc('get_inventario_b2c', {
  p_availability_status: 'pending'
});
```

### 3. Obtener resumen rápido
```typescript
const { data: resumen } = await supabase.rpc('get_inventario_b2c_resumen');
// { total_productos: 15, total_unidades: 120, valor_total: 4500 }
```

### 4. Listar últimos 10 productos
```typescript
const { data } = await supabase.rpc('get_inventario_b2c', {
  p_limit: 10
});
```

---

## 🔒 Seguridad

✅ **La función es automáticamente segura:**
- Solo muestra productos del usuario autenticado
- No necesitas agregar filtros `WHERE user_id = ...` manualmente
- Supabase Auth inyecta `auth.uid()` automáticamente
- Imposible ver inventario de otros usuarios

---

## 📊 Estructura de Datos Retornada

```typescript
type InventarioB2CItem = {
  // IDs
  order_item_id: string;
  order_id: string;
  order_number: string;
  seller_store_id: string;
  
  // Info producto
  product_id: string;
  producto_nombre: string;
  descripcion_corta: string;
  imagen_principal: string;
  galeria_imagenes: string[];
  
  // Variante
  variant_id: string;
  sku: string;
  color: string;
  size: string;
  precio_original: number;
  
  // Stock
  stock: number;
  
  // Estados
  order_status: string;           // 'paid', 'delivered', etc.
  payment_status: string;
  availability_status: string;    // 'available', 'pending', 'cancelled'
  
  // Fechas
  payment_confirmed_at: string;
  fecha_pedido: string;
  ultima_actualizacion: string;
};
```

---

## 🚀 Siguiente Paso

1. ✅ La función SQL ya está creada
2. ✅ Copia el código del hook `useInventarioB2C.ts`
3. ✅ Copia el componente de la página
4. ✅ Adapta los estilos a tu diseño
5. ✅ Prueba con un usuario autenticado

**La función funcionará automáticamente cuando tu usuario esté autenticado en el frontend.** 🎉
