-- ============================================================================
-- SISTEMA DE ESTADOS DE REEMBOLSO CON HISTORIAL Y GESTIÓN
-- ============================================================================
-- Estados: pending → under_review → approved → processing → completed / rejected
-- Gestionado por admin o seller (si es producto del seller)
-- ============================================================================

-- 1. Tipo ENUM para estados de reembolso
DO $$ BEGIN
  CREATE TYPE refund_status_enum AS ENUM (
    'pending',           -- Solicitud creada, esperando revisión
    'under_review',      -- En revisión por admin/seller
    'approved',          -- Aprobado, esperando procesamiento
    'processing',        -- Procesando el reembolso
    'completed',         -- Reembolso completado
    'rejected',          -- Rechazado por admin/seller
    'cancelled'          -- Cancelado por el comprador
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Crear tabla refund_requests si no existe
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders_b2b(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  request_type VARCHAR(50) DEFAULT 'manual',
  status refund_status_enum DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approved_amount DECIMAL(10,2),
  refund_method VARCHAR(50),
  refund_reference VARCHAR(100),
  completed_at TIMESTAMPTZ,
  seller_id UUID REFERENCES sellers(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Si la tabla ya existía con columna status antigua, actualizarla
DO $$ 
BEGIN
  -- Intentar eliminar columna status antigua si existe y es de tipo diferente
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refund_requests' 
    AND column_name = 'status'
    AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE refund_requests DROP COLUMN status CASCADE;
    ALTER TABLE refund_requests ADD COLUMN status refund_status_enum DEFAULT 'pending' NOT NULL;
  END IF;
  
  -- Agregar columnas nuevas si no existen
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'reviewed_by') THEN
    ALTER TABLE refund_requests ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'reviewed_at') THEN
    ALTER TABLE refund_requests ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'rejection_reason') THEN
    ALTER TABLE refund_requests ADD COLUMN rejection_reason TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'approved_amount') THEN
    ALTER TABLE refund_requests ADD COLUMN approved_amount DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'refund_method') THEN
    ALTER TABLE refund_requests ADD COLUMN refund_method VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'refund_reference') THEN
    ALTER TABLE refund_requests ADD COLUMN refund_reference VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'completed_at') THEN
    ALTER TABLE refund_requests ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'seller_id') THEN
    ALTER TABLE refund_requests ADD COLUMN seller_id UUID REFERENCES sellers(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refund_requests' AND column_name = 'notes') THEN
    ALTER TABLE refund_requests ADD COLUMN notes TEXT;
  END IF;
END $$;

-- 4. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_reviewed_by ON refund_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_refund_requests_seller_id ON refund_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_user_id ON refund_requests(buyer_user_id);

-- 5. Crear tabla de historial de estados
CREATE TABLE IF NOT EXISTS refund_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  refund_request_id UUID NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  old_status refund_status_enum,
  new_status refund_status_enum NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_refund_status_history_refund ON refund_status_history(refund_request_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_status_history_changed_by ON refund_status_history(changed_by);

-- 6. Trigger para registrar cambios de estado automáticamente
CREATE OR REPLACE FUNCTION log_refund_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo registrar si el status realmente cambió
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO refund_status_history (
      refund_request_id,
      old_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.reviewed_by,
      CASE 
        WHEN NEW.status = 'rejected' THEN NEW.rejection_reason
        WHEN NEW.status = 'completed' THEN 'Reembolso completado exitosamente'
        ELSE NEW.notes
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_refund_status_change ON refund_requests;
CREATE TRIGGER trigger_log_refund_status_change
  AFTER UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_refund_status_change();

-- 7. Función: Cambiar estado de reembolso (con validaciones)
CREATE OR REPLACE FUNCTION change_refund_status(
  p_refund_id UUID,
  p_new_status refund_status_enum,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL,
  p_approved_amount DECIMAL DEFAULT NULL,
  p_refund_method VARCHAR DEFAULT NULL,
  p_refund_reference VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_refund RECORD;
  v_user_role TEXT;
  v_can_manage BOOLEAN := false;
  v_order RECORD;
BEGIN
  -- 1. Verificar que el reembolso existe
  SELECT r.*, o.seller_id
  INTO v_refund
  FROM refund_requests r
  LEFT JOIN orders_b2b o ON r.order_id = o.id
  WHERE r.id = p_refund_id;
  
  IF v_refund IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solicitud de reembolso no encontrada'
    );
  END IF;

  -- 2. Verificar permisos del usuario
  SELECT role INTO v_user_role 
  FROM user_roles 
  WHERE user_id = p_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Admin puede gestionar todos
  IF v_user_role = 'admin' THEN
    v_can_manage := true;
  -- Seller solo puede gestionar sus propios productos
  ELSIF v_user_role = 'seller' THEN
    SELECT COUNT(*) > 0 INTO v_can_manage
    FROM sellers s
    WHERE s.user_id = p_user_id
      AND s.id = v_refund.seller_id;
  END IF;

  IF NOT v_can_manage THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No tiene permisos para gestionar este reembolso'
    );
  END IF;

  -- 3. Validar transiciones de estado permitidas
  IF v_refund.status = 'pending' AND p_new_status NOT IN ('under_review', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transición de estado no permitida desde pending');
  END IF;

  IF v_refund.status = 'under_review' AND p_new_status NOT IN ('approved', 'rejected', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transición de estado no permitida desde under_review');
  END IF;

  IF v_refund.status = 'approved' AND p_new_status NOT IN ('processing', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transición de estado no permitida desde approved');
  END IF;

  IF v_refund.status = 'processing' AND p_new_status NOT IN ('completed', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transición de estado no permitida desde processing');
  END IF;

  IF v_refund.status IN ('completed', 'rejected', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede cambiar el estado de un reembolso finalizado');
  END IF;

  -- 4. Actualizar estado
  UPDATE refund_requests
  SET 
    status = p_new_status,
    reviewed_by = p_user_id,
    reviewed_at = CASE WHEN p_new_status IN ('approved', 'rejected') THEN NOW() ELSE reviewed_at END,
    rejection_reason = CASE WHEN p_new_status = 'rejected' THEN COALESCE(p_rejection_reason, rejection_reason) ELSE rejection_reason END,
    approved_amount = CASE WHEN p_new_status = 'approved' THEN COALESCE(p_approved_amount, amount) ELSE approved_amount END,
    refund_method = CASE WHEN p_new_status = 'processing' THEN COALESCE(p_refund_method, refund_method) ELSE refund_method END,
    refund_reference = CASE WHEN p_new_status = 'processing' THEN COALESCE(p_refund_reference, refund_reference) ELSE refund_reference END,
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    notes = COALESCE(p_notes, notes),
    updated_at = NOW()
  WHERE id = p_refund_id;

  -- 5. Retornar éxito
  RETURN jsonb_build_object(
    'success', true,
    'refund_id', p_refund_id,
    'old_status', v_refund.status,
    'new_status', p_new_status,
    'changed_by', p_user_id,
    'changed_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 8. Vista: Reembolsos con información completa
CREATE OR REPLACE VIEW v_refunds_management AS
SELECT 
  r.id,
  r.order_id,
  o.order_number,
  r.buyer_user_id,
  buyer.email as buyer_email,
  COALESCE(buyer.raw_user_meta_data->>'full_name', buyer.email) as buyer_name,
  r.amount,
  r.approved_amount,
  r.reason,
  r.status,
  r.request_type,
  r.reviewed_by,
  reviewer.email as reviewer_email,
  r.reviewed_at,
  r.rejection_reason,
  r.refund_method,
  r.refund_reference,
  r.completed_at,
  r.seller_id,
  r.notes,
  r.created_at,
  r.updated_at,
  -- Historial de estados
  (
    SELECT json_agg(
      json_build_object(
        'old_status', old_status,
        'new_status', new_status,
        'changed_by', changed_by,
        'changed_at', changed_at,
        'notes', notes
      ) ORDER BY changed_at DESC
    )
    FROM refund_status_history
    WHERE refund_request_id = r.id
  ) as status_history
FROM refund_requests r
LEFT JOIN orders_b2b o ON r.order_id = o.id
LEFT JOIN auth.users buyer ON r.buyer_user_id = buyer.id
LEFT JOIN auth.users reviewer ON r.reviewed_by = reviewer.id;

-- 9. RLS Policies
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admins pueden ver y gestionar todos los reembolsos
DROP POLICY IF EXISTS admin_refund_all ON refund_requests;
CREATE POLICY admin_refund_all ON refund_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Policy: Sellers solo ven reembolsos de sus productos
DROP POLICY IF EXISTS seller_refund_own ON refund_requests;
CREATE POLICY seller_refund_own ON refund_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sellers s
      WHERE s.user_id = auth.uid()
        AND s.id = refund_requests.seller_id
    )
  );

-- Policy: Sellers pueden actualizar sus reembolsos
DROP POLICY IF EXISTS seller_refund_update ON refund_requests;
CREATE POLICY seller_refund_update ON refund_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sellers s
      WHERE s.user_id = auth.uid()
        AND s.id = refund_requests.seller_id
    )
  );

-- Policy: Buyers ven sus propios reembolsos
DROP POLICY IF EXISTS buyer_refund_own ON refund_requests;
CREATE POLICY buyer_refund_own ON refund_requests
  FOR SELECT
  USING (buyer_user_id = auth.uid());

-- History policies
DROP POLICY IF EXISTS refund_history_read ON refund_status_history;
CREATE POLICY refund_history_read ON refund_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'seller')
    )
    OR
    EXISTS (
      SELECT 1 FROM refund_requests
      WHERE id = refund_status_history.refund_request_id
        AND buyer_user_id = auth.uid()
    )
  );

-- 10. Permisos
GRANT EXECUTE ON FUNCTION change_refund_status TO authenticated;
GRANT SELECT ON v_refunds_management TO authenticated;

-- 11. Comentarios
COMMENT ON TYPE refund_status_enum IS 'Estados del flujo de reembolso: pending → under_review → approved → processing → completed/rejected';
COMMENT ON FUNCTION change_refund_status IS 'Cambia el estado de un reembolso con validaciones de permisos y transiciones';
COMMENT ON TABLE refund_status_history IS 'Historial completo de cambios de estado de reembolsos';
COMMENT ON VIEW v_refunds_management IS 'Vista completa de reembolsos con información del comprador, orden, seller y historial';
