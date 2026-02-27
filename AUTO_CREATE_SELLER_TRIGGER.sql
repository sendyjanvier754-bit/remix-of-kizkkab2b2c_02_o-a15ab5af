-- =====================================================
-- TRIGGER: Auto-crear vendedor cuando se crea una tienda
-- =====================================================
-- Automáticamente crea un registro en 'sellers' cuando:
-- 1. Se crea una nueva tienda
-- 2. Un usuario con rol seller/admin crea su primera tienda
-- =====================================================

-- Función para auto-crear seller
CREATE OR REPLACE FUNCTION public.auto_create_seller_from_store()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Obtener el rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = NEW.owner_user_id;

  -- Solo crear seller si es seller o admin
  IF v_user_role IN ('seller', 'admin') THEN
    -- Verificar si ya existe un seller para este usuario
    IF NOT EXISTS (SELECT 1 FROM sellers WHERE user_id = NEW.owner_user_id) THEN
      -- Crear el registro de seller
      INSERT INTO sellers (
        user_id,
        store_id,
        business_name,
        business_type,
        is_verified,
        verification_status,
        commission_rate,
        is_active
      ) VALUES (
        NEW.owner_user_id,
        NEW.id,
        NEW.name,
        'retail',
        CASE WHEN v_user_role = 'admin' THEN true ELSE false END,
        CASE WHEN v_user_role = 'admin' THEN 'verified'::verification_status ELSE 'pending_verification'::verification_status END,
        10.00,
        true
      );

      RAISE NOTICE '✅ Seller auto-creado para tienda: %', NEW.name;
    ELSE
      -- Si ya existe seller, solo actualizar el store_id
      UPDATE sellers
      SET store_id = NEW.id,
          business_name = NEW.name,
          updated_at = NOW()
      WHERE user_id = NEW.owner_user_id;

      RAISE NOTICE '✅ Seller actualizado con nueva tienda: %', NEW.name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_auto_create_seller ON stores;
CREATE TRIGGER trigger_auto_create_seller
  AFTER INSERT ON stores
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_seller_from_store();

-- =====================================================
-- Función para auto-crear seller cuando cambia el rol
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_create_seller_from_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_store_id UUID;
  v_store_name TEXT;
BEGIN
  -- Solo actuar si el rol cambió a seller o admin
  IF NEW.role IN ('seller', 'admin') AND (OLD.role IS NULL OR OLD.role NOT IN ('seller', 'admin')) THEN
    
    -- Verificar si ya existe un seller
    IF NOT EXISTS (SELECT 1 FROM sellers WHERE user_id = NEW.id) THEN
      
      -- Buscar si el usuario ya tiene una tienda
      SELECT id, name INTO v_store_id, v_store_name
      FROM stores
      WHERE owner_user_id = NEW.id
      LIMIT 1;

      -- Si tiene tienda, crear seller con esa tienda
      IF v_store_id IS NOT NULL THEN
        INSERT INTO sellers (
          user_id,
          store_id,
          business_name,
          business_type,
          is_verified,
          verification_status,
          commission_rate,
          is_active
        ) VALUES (
          NEW.id,
          v_store_id,
          v_store_name,
          'retail',
          CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
          CASE WHEN NEW.role = 'admin' THEN 'verified'::verification_status ELSE 'pending_verification'::verification_status END,
          10.00,
          true
        );

        RAISE NOTICE '✅ Seller auto-creado para usuario % con tienda existente', NEW.email;
      ELSE
        -- Si no tiene tienda, crear seller sin store_id (se agregará cuando cree la tienda)
        INSERT INTO sellers (
          user_id,
          store_id,
          business_name,
          business_type,
          is_verified,
          verification_status,
          commission_rate,
          is_active
        ) VALUES (
          NEW.id,
          NULL,
          NEW.full_name,
          'retail',
          CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
          CASE WHEN NEW.role = 'admin' THEN 'verified'::verification_status ELSE 'pending_verification'::verification_status END,
          10.00,
          true
        );

        RAISE NOTICE '✅ Seller auto-creado para usuario % sin tienda', NEW.email;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger para cambio de rol
DROP TRIGGER IF EXISTS trigger_auto_create_seller_on_role_change ON profiles;
CREATE TRIGGER trigger_auto_create_seller_on_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role IN ('seller', 'admin'))
  EXECUTE FUNCTION auto_create_seller_from_role_change();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver triggers creados
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%seller%'
ORDER BY trigger_name;

-- =====================================================
-- RESULTADO:
-- =====================================================
-- ✅ Trigger en 'stores': Crea seller cuando se crea tienda
-- ✅ Trigger en 'profiles': Crea seller cuando rol cambia a seller/admin
-- ✅ Futuros vendedores se crearán automáticamente
-- ✅ Sistema completamente automatizado
-- =====================================================
