-- ============================================
-- SIVER MARKET 509 - TABLAS Y FUNCIONES FALTANTES
-- Este archivo contiene elementos que pueden faltar en el esquema actual
-- Ejecutar después de DATABASE_SCHEMA_MIGRATION.sql
-- ============================================

-- ============================================
-- SECCIÓN 1: EXTENSIONES REQUERIDAS
-- ============================================

-- Vector extension para búsqueda por embeddings (IA)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================
-- SECCIÓN 2: TIPOS ENUM FALTANTES O ACTUALIZADOS
-- ============================================

-- Actualizar approval_request_type para incluir todos los valores usados en código
DO $$
BEGIN
    -- Intentar agregar valores faltantes al enum
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'seller_upgrade' AND enumtypid = 'approval_request_type'::regtype) THEN
        ALTER TYPE public.approval_request_type ADD VALUE IF NOT EXISTS 'seller_upgrade';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'referral_bonus' AND enumtypid = 'approval_request_type'::regtype) THEN
        ALTER TYPE public.approval_request_type ADD VALUE IF NOT EXISTS 'referral_bonus';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'credit_limit_increase' AND enumtypid = 'approval_request_type'::regtype) THEN
        ALTER TYPE public.approval_request_type ADD VALUE IF NOT EXISTS 'credit_limit_increase';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'credit_activation' AND enumtypid = 'approval_request_type'::regtype) THEN
        ALTER TYPE public.approval_request_type ADD VALUE IF NOT EXISTS 'credit_activation';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding enum values: %', SQLERRM;
END $$;

-- Actualizar verification_status para incluir pending_verification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_verification' AND enumtypid = 'verification_status'::regtype) THEN
        ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'pending_verification';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding enum values: %', SQLERRM;
END $$;

-- ============================================
-- SECCIÓN 3: TABLAS FALTANTES
-- ============================================

-- Seller Statuses (Stories de vendedores)
CREATE TABLE IF NOT EXISTS public.seller_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    media_type TEXT DEFAULT 'image',
    image_url TEXT,
    content TEXT,
    caption TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Siver Match Profiles (Perfiles para matching inversor-gestor)
CREATE TABLE IF NOT EXISTS public.siver_match_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    profile_type TEXT NOT NULL CHECK (profile_type IN ('investor', 'gestor')),
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    department_id UUID REFERENCES public.departments(id),
    commune_id UUID REFERENCES public.communes(id),
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    rating_avg NUMERIC DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_invested NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Siver Match Sales (Ventas del sistema de matching)
CREATE TABLE IF NOT EXISTS public.siver_match_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number TEXT UNIQUE,
    investor_id UUID NOT NULL REFERENCES public.siver_match_profiles(id),
    gestor_id UUID NOT NULL REFERENCES public.siver_match_profiles(id),
    product_id UUID REFERENCES public.products(id),
    variant_id UUID REFERENCES public.product_variants(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    product_cost NUMERIC NOT NULL,
    suggested_price NUMERIC,
    final_price NUMERIC,
    gestor_commission NUMERIC DEFAULT 0,
    platform_fee NUMERIC DEFAULT 0,
    investor_profit NUMERIC DEFAULT 0,
    department_id UUID REFERENCES public.departments(id),
    commune_id UUID REFERENCES public.communes(id),
    pickup_point_id UUID REFERENCES public.pickup_points(id),
    delivery_address JSONB,
    pickup_code TEXT,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    po_id UUID REFERENCES public.master_purchase_orders(id),
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Siver Match Reviews (Reseñas entre inversores y gestores)
CREATE TABLE IF NOT EXISTS public.siver_match_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.siver_match_sales(id),
    reviewer_profile_id UUID NOT NULL REFERENCES public.siver_match_profiles(id),
    reviewed_profile_id UUID NOT NULL REFERENCES public.siver_match_profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price Settings (Configuración de precios dinámicos)
CREATE TABLE IF NOT EXISTS public.price_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value NUMERIC NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Favorites con campo type para B2B/B2C
-- Agregar columna type si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_favorites' AND column_name = 'type') THEN
        ALTER TABLE public.user_favorites ADD COLUMN type TEXT DEFAULT 'B2C';
    END IF;
END $$;

-- Agregar columna product_id a user_favorites para B2B
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_favorites' AND column_name = 'product_id') THEN
        ALTER TABLE public.user_favorites ADD COLUMN product_id UUID REFERENCES public.products(id);
    END IF;
END $$;

-- ============================================
-- SECCIÓN 4: COLUMNAS FALTANTES EN TABLAS EXISTENTES
-- ============================================

-- Agregar campo 'source' a product_views
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'product_views' AND column_name = 'source') THEN
        ALTER TABLE public.product_views ADD COLUMN source TEXT;
    END IF;
END $$;

-- Agregar campo 'is_email_sent' a notifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' AND column_name = 'is_email_sent') THEN
        ALTER TABLE public.notifications ADD COLUMN is_email_sent BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Agregar campo 'bonus_approved' a referrals
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referrals' AND column_name = 'bonus_approved') THEN
        ALTER TABLE public.referrals ADD COLUMN bonus_approved BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Agregar campo 'balance_debt' a seller_credits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'seller_credits' AND column_name = 'balance_debt') THEN
        ALTER TABLE public.seller_credits ADD COLUMN balance_debt NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Agregar campo 'credit_limit' a seller_credits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'seller_credits' AND column_name = 'credit_limit') THEN
        ALTER TABLE public.seller_credits ADD COLUMN credit_limit NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Agregar campo 'is_credit_active' a seller_credits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'seller_credits' AND column_name = 'is_credit_active') THEN
        ALTER TABLE public.seller_credits ADD COLUMN is_credit_active BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================
-- SECCIÓN 5: VISTAS FALTANTES
-- ============================================

-- Vista markets_dashboard
CREATE OR REPLACE VIEW public.markets_dashboard AS
SELECT 
    m.*,
    dc.name as destination_country_name,
    dc.code as destination_country_code,
    sr.id as shipping_route_id,
    (SELECT COUNT(*) FROM public.market_payment_methods mpm 
     WHERE mpm.market_id = m.id AND mpm.is_active = true) as payment_methods_count
FROM public.markets m
LEFT JOIN public.destination_countries dc ON m.destination_country_id = dc.id
LEFT JOIN public.shipping_routes sr ON m.shipping_route_id = sr.id;

-- ============================================
-- SECCIÓN 6: FUNCIONES RPC FALTANTES
-- ============================================

-- Función para obtener productos trending
CREATE OR REPLACE FUNCTION public.get_trending_products(
    days_back INTEGER DEFAULT 7,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    imagen_principal TEXT,
    precio_mayorista NUMERIC,
    view_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.imagen_principal,
        p.precio_mayorista,
        COUNT(pv.id) as view_count
    FROM products p
    LEFT JOIN product_views pv ON pv.product_id = p.id
        AND pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
    WHERE p.is_active = true
    GROUP BY p.id
    ORDER BY view_count DESC
    LIMIT limit_count;
END;
$$;

-- Función para búsqueda por vector/embedding
CREATE OR REPLACE FUNCTION public.match_products(
    query_embedding TEXT,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    imagen_principal TEXT,
    precio_mayorista NUMERIC,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Si no hay embedding, devolver productos aleatorios
    IF query_embedding IS NULL OR query_embedding = '' THEN
        RETURN QUERY
        SELECT 
            p.id,
            p.nombre,
            p.imagen_principal,
            p.precio_mayorista,
            0.0::FLOAT as similarity
        FROM products p
        WHERE p.is_active = true
        ORDER BY RANDOM()
        LIMIT match_count;
        RETURN;
    END IF;
    
    -- Búsqueda por similitud de embedding
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.imagen_principal,
        p.precio_mayorista,
        1 - (p.embedding <=> query_embedding::vector) as similarity
    FROM products p
    WHERE p.is_active = true
      AND p.embedding IS NOT NULL
      AND 1 - (p.embedding <=> query_embedding::vector) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Función para generar número de PO
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO counter FROM master_purchase_orders;
    new_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
    RETURN new_number;
END;
$$;

-- Función para generar número de venta Siver Match
CREATE OR REPLACE FUNCTION public.generate_match_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO counter FROM siver_match_sales;
    new_number := 'SM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
    RETURN new_number;
END;
$$;

-- Función para generar código de pickup
CREATE OR REPLACE FUNCTION public.generate_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$;

-- Función para obtener/crear PO activo
CREATE OR REPLACE FUNCTION public.get_or_create_active_po()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    active_po_id UUID;
    new_po_number TEXT;
BEGIN
    -- Buscar PO abierto
    SELECT id INTO active_po_id
    FROM master_purchase_orders
    WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si no existe, crear uno nuevo
    IF active_po_id IS NULL THEN
        new_po_number := generate_po_number();
        INSERT INTO master_purchase_orders (po_number, status)
        VALUES (new_po_number, 'open')
        RETURNING id INTO active_po_id;
    END IF;
    
    RETURN active_po_id;
END;
$$;

-- Función para estadísticas de consolidación
CREATE OR REPLACE FUNCTION public.get_consolidation_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_open_orders', (SELECT COUNT(*) FROM orders_b2b WHERE status = 'pending' AND po_id IS NULL),
        'total_open_amount', COALESCE((SELECT SUM(total_amount) FROM orders_b2b WHERE status = 'pending' AND po_id IS NULL), 0),
        'active_po_count', (SELECT COUNT(*) FROM master_purchase_orders WHERE status = 'open'),
        'linked_orders_count', (SELECT COUNT(*) FROM po_order_links)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Función para vincular órdenes a PO
CREATE OR REPLACE FUNCTION public.link_mixed_orders_to_po(p_po_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    linked_count INTEGER := 0;
    order_rec RECORD;
BEGIN
    -- Vincular órdenes B2B pendientes
    FOR order_rec IN 
        SELECT id, 'b2b' as order_type, seller_id, total_quantity
        FROM orders_b2b 
        WHERE status = 'pending' 
          AND payment_status = 'paid'
          AND po_id IS NULL
    LOOP
        INSERT INTO po_order_links (po_id, order_id, order_type, unit_count)
        VALUES (p_po_id, order_rec.id, order_rec.order_type, order_rec.total_quantity);
        
        UPDATE orders_b2b SET po_id = p_po_id, po_linked_at = NOW() WHERE id = order_rec.id;
        linked_count := linked_count + 1;
    END LOOP;
    
    -- Actualizar totales del PO
    UPDATE master_purchase_orders
    SET 
        total_orders = (SELECT COUNT(*) FROM po_order_links WHERE po_id = p_po_id),
        total_quantity = (SELECT COALESCE(SUM(unit_count), 0) FROM po_order_links WHERE po_id = p_po_id),
        updated_at = NOW()
    WHERE id = p_po_id;
    
    RETURN linked_count;
END;
$$;

-- Función para expirar órdenes pendientes
CREATE OR REPLACE FUNCTION public.fn_expire_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE orders_b2b
        SET 
            status = 'expired',
            payment_status = 'expired',
            updated_at = NOW()
        WHERE 
            payment_status = 'pending'
            AND created_at < NOW() - INTERVAL '48 hours'
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM expired;
    
    RETURN expired_count;
END;
$$;

-- Función para validar entrega de courier
CREATE OR REPLACE FUNCTION public.validate_courier_delivery(
    p_qr_code TEXT,
    p_security_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    delivery_rec RECORD;
BEGIN
    SELECT * INTO delivery_rec
    FROM order_deliveries
    WHERE customer_qr_code = p_qr_code
      AND security_pin = p_security_pin
      AND status != 'delivered';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código inválido o ya entregado');
    END IF;
    
    UPDATE order_deliveries
    SET status = 'delivered', confirmed_at = NOW()
    WHERE id = delivery_rec.id;
    
    RETURN jsonb_build_object('success', true, 'delivery_id', delivery_rec.id, 'order_id', delivery_rec.order_id);
END;
$$;

-- Función para confirmar entrega en pickup point
CREATE OR REPLACE FUNCTION public.confirm_pickup_point_delivery(
    p_qr_code TEXT,
    p_physical_pin TEXT,
    p_operator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    delivery_rec RECORD;
BEGIN
    SELECT * INTO delivery_rec
    FROM order_deliveries
    WHERE customer_qr_code = p_qr_code
      AND security_pin = p_physical_pin
      AND status = 'ready_for_pickup';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código inválido o no disponible para recogida');
    END IF;
    
    UPDATE order_deliveries
    SET 
        status = 'delivered',
        confirmed_at = NOW(),
        confirmed_by = p_operator_id
    WHERE id = delivery_rec.id;
    
    RETURN jsonb_build_object('success', true, 'delivery_id', delivery_rec.id, 'order_id', delivery_rec.order_id);
END;
$$;

-- ============================================
-- SECCIÓN 7: RLS POLICIES ADICIONALES
-- ============================================

-- Políticas para seller_statuses
ALTER TABLE public.seller_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active statuses" ON public.seller_statuses FOR SELECT USING (is_active = true);
CREATE POLICY "Store owners can manage statuses" ON public.seller_statuses FOR ALL 
    USING (EXISTS (SELECT 1 FROM stores WHERE id = store_id AND owner_user_id = auth.uid()));

-- Políticas para siver_match_profiles
ALTER TABLE public.siver_match_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.siver_match_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.siver_match_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.siver_match_profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- Políticas para siver_match_sales
ALTER TABLE public.siver_match_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view their sales" ON public.siver_match_sales FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM siver_match_profiles WHERE id = investor_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM siver_match_profiles WHERE id = gestor_id AND user_id = auth.uid())
        OR is_admin(auth.uid())
    );

-- Políticas para price_settings
ALTER TABLE public.price_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.price_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.price_settings FOR ALL USING (is_admin(auth.uid()));

-- ============================================
-- SECCIÓN 8: ÍNDICES ADICIONALES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_seller_statuses_store ON public.seller_statuses(store_id);
CREATE INDEX IF NOT EXISTS idx_seller_statuses_expires ON public.seller_statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_siver_match_profiles_user ON public.siver_match_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_siver_match_sales_investor ON public.siver_match_sales(investor_id);
CREATE INDEX IF NOT EXISTS idx_siver_match_sales_gestor ON public.siver_match_sales(gestor_id);
CREATE INDEX IF NOT EXISTS idx_siver_match_sales_status ON public.siver_match_sales(status);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON public.product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_created ON public.product_views(created_at);

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
