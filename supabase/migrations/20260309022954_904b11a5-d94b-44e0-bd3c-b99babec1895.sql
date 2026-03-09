-- ============================================================
-- PORTAL DE AGENTES DE COMPRA - ESQUEMA COMPLETO
-- Módulo empresarial para gestión de compras internacionales
-- ============================================================

-- 1. Tabla de Agentes de Compra
CREATE TABLE IF NOT EXISTS public.purchasing_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    country_code TEXT NOT NULL DEFAULT 'CN',
    country_name TEXT DEFAULT 'China',
    warehouse_address JSONB,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    specializations TEXT[] DEFAULT '{}',
    max_concurrent_pos INTEGER DEFAULT 10,
    current_active_pos INTEGER DEFAULT 0,
    avg_dispatch_hours NUMERIC(10,2) DEFAULT 0,
    total_pos_completed INTEGER DEFAULT 0,
    total_items_processed INTEGER DEFAULT 0,
    quality_score NUMERIC(3,2) DEFAULT 5.00,
    bank_info JSONB,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchasing_agents_status ON public.purchasing_agents(status);
CREATE INDEX IF NOT EXISTS idx_purchasing_agents_country ON public.purchasing_agents(country_code);
CREATE INDEX IF NOT EXISTS idx_purchasing_agents_user ON public.purchasing_agents(user_id);

-- 2. Asignaciones de PO a Agentes
CREATE TABLE IF NOT EXISTS public.po_agent_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.purchasing_agents(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    assignment_type TEXT DEFAULT 'auto' CHECK (assignment_type IN ('auto', 'manual')),
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'rejected')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    dispatch_hours NUMERIC(10,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(po_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_po_assignments_agent ON public.po_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_po_assignments_po ON public.po_agent_assignments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_assignments_status ON public.po_agent_assignments(status);

-- 3. Compras Fragmentadas por PO
CREATE TABLE IF NOT EXISTS public.po_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.master_purchase_orders(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.purchasing_agents(id),
    purchase_number TEXT NOT NULL,
    source_platform TEXT NOT NULL CHECK (source_platform IN ('1688', 'alibaba', 'taobao', 'other')),
    supplier_order_id TEXT,
    supplier_link TEXT,
    payment_link TEXT,
    expected_cost_usd NUMERIC(12,2) DEFAULT 0,
    actual_cost_usd NUMERIC(12,2) DEFAULT 0,
    cart_screencast_url TEXT,
    cart_screencast_uploaded_at TIMESTAMPTZ,
    payment_proof_url TEXT,
    cart_validated BOOLEAN DEFAULT FALSE,
    cart_validated_at TIMESTAMPTZ,
    cart_validated_by UUID REFERENCES auth.users(id),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'awaiting_validation', 'paid', 'rejected')),
    payment_validated_at TIMESTAMPTZ,
    payment_validated_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'cart_submitted', 'payment_pending', 'paid', 'shipped', 'received', 'qc_complete')),
    items_count INTEGER DEFAULT 0,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_purchases_po ON public.po_purchases(po_id);
CREATE INDEX IF NOT EXISTS idx_po_purchases_agent ON public.po_purchases(agent_id);
CREATE INDEX IF NOT EXISTS idx_po_purchases_status ON public.po_purchases(status);

-- 4. Items de cada Compra Fragmentada
CREATE TABLE IF NOT EXISTS public.po_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.po_purchases(id) ON DELETE CASCADE,
    order_item_id UUID,
    product_id UUID,
    variant_id UUID,
    sku TEXT NOT NULL,
    nombre TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cny NUMERIC(12,2),
    unit_price_usd NUMERIC(12,2),
    expected_unit_cost_usd NUMERIC(12,2),
    total_price_usd NUMERIC(12,2),
    qc_status TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending', 'received', 'approved', 'rejected')),
    qc_photos TEXT[] DEFAULT '{}',
    qc_videos TEXT[] DEFAULT '{}',
    qc_notes TEXT,
    qc_reviewed_at TIMESTAMPTZ,
    qc_reviewed_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    requires_rebuy BOOLEAN DEFAULT FALSE,
    rebuy_purchase_id UUID,
    hybrid_tracking_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.po_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_qc ON public.po_purchase_items(qc_status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_tracking ON public.po_purchase_items(hybrid_tracking_id);