# 🐛 DEBUG: Botón Guardar No Funciona

## Contexto
Usuario reporta: "el botón para guardar no funciona"

## Componente Afectado
**ProductEditDialog.tsx** - Botón "Guardar Cambios" (línea 776)

## Análisis del Código

### ✅ Estructura del Form (CORRECTO)
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    {/* ... campos ... */}
    <Button type="submit" disabled={updateProduct.isPending}>
      Guardar Cambios
    </Button>
  </form>
</Form>
```

### ✅ Hook useCatalog (CORRECTO)
- `updateProduct` usa `useMutation` de React Query
- Incluye tracking de historial de precios
- Invalida queries correctamente
- Muestra toast de éxito/error

### ✅ Schema Zod (CORRECTO)
```tsx
peso_g: z.coerce.number().min(1, 'Peso debe ser >= 1g').optional().nullable()
```

### ✅ onSubmit Handler (CORRECTO)
```tsx
peso_g: data.peso_g || null  // Línea 167
```

## Posibles Causas

### 1. Error de Validación Silencioso
- El form puede estar fallando validación sin mostrar error
- **Prueba:** Abrir consola del navegador (F12) y verificar errores

### 2. Campos Requeridos Faltantes
- SKU, Nombre son requeridos
- Si están vacíos, el form no se envía

### 3. Estado isPending Bloqueando
- Si `updateProduct.isPending` es `true`, el botón está deshabilitado
- **Prueba:** Verificar si botón aparece deshabilitado (gris)

### 4. Error en Supabase RLS Policies
- Las políticas de seguridad pueden estar bloqueando UPDATE
- **Prueba:** Ver Network tab en DevTools

### 5. userId Undefined
- Si `user?.id` es undefined, puede fallar el tracking de historial
- **Código:** línea 173 pasa `userId: user?.id`

## Plan de Debugging

### Paso 1: Verificar Consola del Navegador
```bash
# Abrir Chrome DevTools (F12)
# Pestaña Console
# Buscar errores rojos
```

### Paso 2: Agregar Logs Temporales
```tsx
const onSubmit = async (data: ProductFormData) => {
  console.log('🔍 onSubmit triggered');
  console.log('📦 Form data:', data);
  console.log('👤 User ID:', user?.id);
  
  // ... resto del código
};
```

### Paso 3: Verificar Estado del Form
```tsx
// Agregar después de la línea 104 (después del useForm)
console.log('📋 Form state:', form.formState);
console.log('❌ Form errors:', form.formState.errors);
```

### Paso 4: Test Manual
1. Abrir AdminCatalogo
2. Click en un producto para editar
3. Cambiar el campo `peso_g`
4. Click en "Guardar Cambios"
5. Observar:
   - ¿El botón se desactiva?
   - ¿Aparece "Guardando..."?
   - ¿Hay toast de error/éxito?
   - ¿Qué muestra la consola?

## Solución Temporal: Verificación Explícita

Si el problema persiste, agregar handler onClick adicional:

```tsx
<Button 
  type="submit" 
  disabled={updateProduct.isPending}
  onClick={(e) => {
    console.log('🔘 Button clicked');
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      console.error('❌ Validation errors:', errors);
      toast({
        title: 'Errores de validación',
        description: Object.values(errors).map(e => e.message).join(', '),
        variant: 'destructive'
      });
    }
  }}
>
  Guardar Cambios
</Button>
```

## Información Necesaria del Usuario

Para resolver este bug necesito:

1. **¿Qué pasa cuando haces click en "Guardar"?**
   - [ ] Nada (sin respuesta)
   - [ ] Botón se deshabilita pero no pasa nada
   - [ ] Aparece un error
   - [ ] Se cierra el diálogo sin guardar

2. **¿En qué pestaña estás?**
   - [ ] General
   - [ ] Variantes
   - [ ] B2B
   - [ ] Mercados
   - [ ] Logística
   - [ ] Multimedia

3. **¿Qué campo estás editando?**
   - [ ] Peso (peso_g)
   - [ ] Precio
   - [ ] Stock
   - [ ] Otro: ___________

4. **¿Aparece algún mensaje de error?**
   - [ ] Sí: ___________
   - [ ] No

5. **¿Consola del navegador muestra errores?**
   - [ ] Sí (captura de pantalla)
   - [ ] No revisé

---

**Fecha:** 2 febrero 2026  
**Prioridad:** 🔴 ALTA  
**Estado:** En investigación
