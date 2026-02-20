---
# 🎯 DECISIÓN: TRIGGER AUTOMÁTICO + MANUAL OVERRIDE (TICKET #07)

**Documento:** DECISION_TRIGGER_AUTOMATICO_Y_MANUAL.md  
**Fecha:** 19 Febrero 2026  
**Decisión:** Implementar AMBOS patrones (automático + manual)

---

## ❓ PREGUNTA DEL USUARIO

> "TENEMOS QUE ACTUALIZAR EL destination_country_id que se crea automaticamente o cuando se esta agregando a los mercado se agrega manualmente cual recomiendas, o lo dos?"

**Interpretación:**
- Opción A: Automático - system detects country, assigns destination_country_id
- Opción B: Manual - admin/API forcefully assigns destination_country_id
- Opción C: ¿Ambos?

---

## ✅ RECOMENDACIÓN: AMBOS (Automático + Manual Override)

### Rationale

| Caso | Automático | Manual Override | Necesario? |
|------|-----------|-----------------|-----------|
| Usuario se registra con país "Haití" | ✅ Trigger detecta → llena UUID | ❌ No necesario | ✅ SÓLO AUTOMÁTICO |
| Admin crea dirección para testing | ⚠️ Automático funciona pero... | ✅ A veces queremos forzar | ✅ AMBOS |
| Migración de datos / legacy imports | ❌ Inconsistente | ✅ Control total | ✅ SÓLO MANUAL |
| Nueva ruta agregada después | ✅ Automático actualiza | ✅ Fallback si hay error | ✅ AMBOS |

### Ventajas de AMBOS

**Automático (DEFAULT):**
- 99% de usuarios simplemente llenan "Haití" → sistema asigna UUID solo
- Zero risk de NULL values
- Zero risk de mismatch country-UUID
- User experience: "It just works"

**Manual Override (PERMITIDO):**
- Admin puede forzar destino diferente si es necesario
- Fallback para casos excepcionales
- Testing: simular múltiples países sin duplicar datos
- Migración: datos históricos con destinos específicos

---

## 🔧 IMPLEMENTACIÓN: TICKET #07

### PATRON: Trigger Automático + Respetar Manual

```sql
-- PSEUDO-CODE del trigger:

IF destination_country_id IS NULL THEN
  -- Automático: busca por país
  destination_country_id := get_country_uuid_by_name(country)
ELSE
  -- Manual override: se respeta lo que vino
  RETURN NEW  -- con el destination_country_id que pasó el usuario
END IF;
```

### Comportamiento Esperado

**Caso 1: Inserción desde Formulario (Usuario)**
```sql
INSERT INTO addresses (user_id, full_name, street_address, city, country)
VALUES ('user-123', 'Juan', 'Calle 1', 'Port-au-Prince', 'Haití');
-- Resultado: destination_country_id se llena automáticamente (trigger)
-- ✅ User ve su address guardada sin errores
```

**Caso 2: Inserción desde API/Admin con Override**
```sql
INSERT INTO addresses (user_id, full_name, ..., country, destination_country_id)
VALUES ('user-456', 'Admin Test', ..., 'Haití', 'uuid-dominica');
-- Resultado: destination_country_id usa el que vino ('uuid-dominica')
-- ✅ Admin puede simular otro país si quiere
```

**Caso 3: Generación de Dirección sin país (API)**
```sql
INSERT INTO addresses (user_id, full_name, street_address, city)
VALUES ('user-789', 'Invalid', 'Addr', 'City');
-- Resultado: destination_country_id sigue siendo NULL
-- ❌ FK constraint falla → error en BD (intended)
```

---

## 📋 TICKET #07 - SQL IMPLEMENTATION

Archivo: **TICKET_PASO_07_TRIGGER_DESTINATION_COUNTRY.sql**

### Pasos:

1. **CREATE FUNCTION fn_addresses_set_destination_country()**
   - Check: IF NEW.destination_country_id IS NULL
   - Search: SELECT id FROM destination_countries WHERE name ~ country
   - Assign: NEW.destination_country_id := result
   - Fallback: Leave NULL if no match (FK will catch it)

2. **CREATE TRIGGER trg_addresses_set_destination_country**
   - BEFORE INSERT OR UPDATE ON addresses
   - FOR EACH ROW
   - EXECUTE FUNCTION fn_addresses_set_destination_country()

3. **ALTER COLUMN destination_country_id SET NOT NULL**
   - Garantiza que SIEMPRE hay país (ni NULL ni foreign key constraint violations)
   - Solo después de confirmar que trigger + UPDATE mapeo en TICKET #06 completaron

4. **Validación:**
   - Test inserción automática: sin destination_country_id → trigger lo llena
   - Test manual override: con destination_country_id → se respeta
   - Test error case: sin country Y sin destination_country_id → FK falla (expected)

---

## 🎯 BENEFICIOS FINALES

### Para Usuarios
✅ Experiencia fluida: llenan "Haití" → se asigna automáticamente  
✅ No necesitan conocer UUIDs

### Para Admin/QA
✅ Control total si lo necesitan  
✅ Pueden simular otros países para testing  
✅ Fallback para casos excepcionales

### Para Sistema
✅ Garantía: destination_country_id SIEMPRE existe (NOT NULL)  
✅ Integridad: cada address apunta a país válido (FK constraint)  
✅ Performance: índices en destination_country_id  
✅ Auditoria: puedes ver qué país le asignó el sistema vs manual

---

## 📊 IMPACTO EN TICKETS SIGUIENTES

| Ticket | Impacto | Cambio |
|--------|---------|--------|
| #06 | DDL: agregar columna | ✅ Sin cambios (ya listo) |
| **#07** | **Trigger automático** | **✅ Nuevo en plan** |
| #08 | Tablas faltantes | ✅ Sin cambios |
| #09-11 | Triggers, funciones | ✅ Sin cambios |
| #12+ | Frontend | ✅ Sin cambios |

---

## 🚀 NEXT STEPS

### 1. Ejecuta TICKET #06 (DDL - Agregar columna)
- Archivo: TICKET_PASO_06_DDL_AGREGAR_DESTINATION_COUNTRY_ID.sql
- Tiempo: 2 minutos
- Resultado: destination_country_id agregado + datos mapeados

### 2. Ejecuta TICKET #07 (Trigger automático)
- Archivo: TICKET_PASO_07_TRIGGER_DESTINATION_COUNTRY.sql
- Tiempo: 3 minutos
- Resultado: Trigger + validaciones + NOT NULL

### 3. Luego de ambos:
- Actualizar función get_catalog_fastest_shipping_cost_by_product() (TICKET #08)
- Implementar Frontend (TICKET #09+)
- Testing (TICKET #10+)

---

## ✅ VERIFICACIÓN

**Después de ejecutar ambos tickets, debería poder:**

1. Insertar dirección SIN destination_country_id
   ```sql
   INSERT INTO addresses (..., country='Haití') ...;
   -- destination_country_id se llena automáticamente
   ```

2. Insertar dirección CON destination_country_id (override)
   ```sql
   INSERT INTO addresses (..., country='Haití', destination_country_id='uuid-xxx') ...;
   -- Se respeta el UUID que pasaste
   ```

3. Ver todas las direcciones con país UUID
   ```sql
   SELECT a.country, a.destination_country_id, dc.name 
   FROM addresses a
   LEFT JOIN destination_countries dc ON a.destination_country_id = dc.id;
   -- ✅ Todas tienen UUID + nombre de país
   ```

4. Validar integridad (sin orphaned records)
   ```sql
   SELECT * FROM addresses 
   WHERE destination_country_id IS NULL;
   -- ✅ Sin resultados (todas tienen país)
   ```

---

## 🎯 RESUMEN

| Aspecto | Valor |
|--------|-------|
| Patrón | Automático + Manual override permitido |
| Ventaja principal | 99% casos funcionan sin intervención + control cuando se necesita |
| FK garantizado | ✅ SÍ (NOT NULL + constraint) |
| Flexibilidad | ✅ SÍ (admin puede override) |
| Complejidad | ⚠️ Baja (un trigger simple) |
| Testing | ✅ Fácil (test ambos casos) |

**Implementación:** TICKET #07 - TRIGGER AUTOMÁTICO

---

**Estado:** ✅ Decisión tomada, TICKET #07 listo para ejecutar después de TICKET #06
