# 🚀 AdminLogisticaRutas - Guía Rápida

## Flujo de Configuración

```
1️⃣ CREAR RUTA
   └─> Nombre + Origen + Destino
   
2️⃣ SELECCIONAR RUTA
   └─> Click en la ruta
   
3️⃣ AGREGAR TIPO DE ENVÍO
   └─> Standard (📦 Marítimo/Consolidado)
   └─> Express (⚡ Aéreo/Prioritario)
   
4️⃣ CONFIGURAR TRAMOS
   └─> Tramo A: China→USA ($/kg, días)
   └─> Tramo B: USA→Haití ($/lb, días)
   
5️⃣ RESULTADO
   └─> ✅ Ruta "Lista para usar"
```

---

## Estados de Ruta

| Estado | Visual | Significado |
|--------|--------|-------------|
| ✅ **Lista para usar** | Border verde + Badge verde | Tiene tipos configurados y está activa |
| ⚠️ **Necesita configuración** | Border naranja + Badge naranja | Sin tipos de envío configurados |
| **Inactiva** | Badge gris | Desactivada pero configurada |

---

## Ejemplo Rápido

### Crear Standard Marítimo

```yaml
Tipo de Envío: Standard
Transporte: Marítimo
Nombre: "Standard - Consolidado Marítimo"

Tramo A (China→USA):
  Costo: $8.00/kg
  Mínimo: $5.00
  ETA: 15-25 días

Tramo B (USA→Haití):
  Costo: $5.00/lb
  Mínimo: $3.00
  ETA: 3-7 días

Capacidades:
  ✓ Permite oversize
  ✓ Permite sensibles
  ✓ Activo
```

### Crear Express Aéreo

```yaml
Tipo de Envío: Express
Transporte: Aéreo
Nombre: "Express - Prioritario"

Tramo A: $15/kg, 5-10 días
Tramo B: $10/lb, 1-3 días

Capacidades:
  ✗ NO oversize
  ✓ Sensibles
  ✓ Activo
```

---

## Resultado Final

```
┌─────────────────────────────────────┐
│ China → USA → Haití                 │
│ ✅ Lista para usar      [Editar]   │
│ CN → HT                             │
│ [📦 Standard (1)] [⚡ Express (1)]  │
└─────────────────────────────────────┘
```

---

## Checklist ✅

Antes de que una ruta funcione en checkout:

- [x] Ruta creada
- [x] Al menos 1 tipo de envío (Standard o Express)
- [x] Tipo de transporte elegido (Marítimo/Aéreo)
- [x] Costos configurados (Tramo A + B)
- [x] ETAs configurados (Tramo A + B)
- [x] Tipo activo
- [x] Ruta activa

---

## Troubleshooting

### Selector no aparece en checkout
❌ Problema: Ruta sin tipos configurados
✅ Solución: Agregar al menos 1 tipo de envío

### Opciones vacías
❌ Problema: Dirección sin cobertura
✅ Solución: Verificar que zona de dirección tenga ruta asignada

### Precios incorrectos
❌ Problema: Costos mal configurados
✅ Solución: Revisar costos/kg y costos/lb en cada tramo

---

## Acceso Rápido

📍 **Ruta**: `/admin/logistica/rutas`
📄 **Documentación**: [MEJORAS_ADMIN_LOGISTICA.md](MEJORAS_ADMIN_LOGISTICA.md)
🔗 **Integración**: [B2B_SHIPPING_SELECTOR_INTEGRATION.md](B2B_SHIPPING_SELECTOR_INTEGRATION.md)
