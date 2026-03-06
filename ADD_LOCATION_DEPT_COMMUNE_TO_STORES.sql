-- =====================================================================
-- Agregar department_id y commune_id a la tabla stores
-- para permitir que los sellers configuren su ubicación completa
-- (país, departamento y comuna) visible en su página de tienda.
-- =====================================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_id    UUID REFERENCES communes(id)    ON DELETE SET NULL;

-- Índices para búsquedas por ubicación
CREATE INDEX IF NOT EXISTS idx_stores_department_id ON stores(department_id);
CREATE INDEX IF NOT EXISTS idx_stores_commune_id    ON stores(commune_id);

SELECT '✅ Columnas department_id y commune_id agregadas a stores' AS resultado;
