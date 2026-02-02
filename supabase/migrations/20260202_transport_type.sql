-- Agregar columna transport_type a shipping_tiers
-- Relaciona cada tier con su tipo de transporte (marítimo o aéreo)

ALTER TABLE shipping_tiers 
  ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20) DEFAULT 'maritimo' CHECK (transport_type IN ('maritimo', 'aereo'));

-- Actualizar tiers existentes según tier_type
UPDATE shipping_tiers
SET transport_type = CASE 
  WHEN tier_type = 'express' THEN 'aereo'
  ELSE 'maritimo'
END
WHERE transport_type IS NULL;

-- Comentarios
COMMENT ON COLUMN shipping_tiers.transport_type IS 'Tipo de transporte: maritimo (consolidado, más lento) o aereo (express, más rápido)';
