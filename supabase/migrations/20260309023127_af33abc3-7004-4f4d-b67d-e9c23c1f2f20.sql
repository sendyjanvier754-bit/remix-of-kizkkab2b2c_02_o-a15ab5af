-- ============================================================
-- PORTAL DE AGENTES DE COMPRA - PARTE 4
-- RLS Policies y Storage
-- ============================================================

ALTER TABLE public.purchasing_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_qc_access ENABLE ROW LEVEL SECURITY;

-- Políticas para agentes de compra
DROP POLICY IF EXISTS "Admins full access to purchasing_agents" ON public.purchasing_agents;
CREATE POLICY "Admins full access to purchasing_agents" ON public.purchasing_agents
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents view own profile" ON public.purchasing_agents;
CREATE POLICY "Agents view own profile" ON public.purchasing_agents
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Políticas para asignaciones
DROP POLICY IF EXISTS "Admins full access to po_agent_assignments" ON public.po_agent_assignments;
CREATE POLICY "Admins full access to po_agent_assignments" ON public.po_agent_assignments
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents view own assignments" ON public.po_agent_assignments;
CREATE POLICY "Agents view own assignments" ON public.po_agent_assignments
    FOR SELECT TO authenticated
    USING (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Agents update own assignments" ON public.po_agent_assignments;
CREATE POLICY "Agents update own assignments" ON public.po_agent_assignments
    FOR UPDATE TO authenticated
    USING (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()));

-- Políticas para compras
DROP POLICY IF EXISTS "Admins full access to po_purchases" ON public.po_purchases;
CREATE POLICY "Admins full access to po_purchases" ON public.po_purchases
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents manage own purchases" ON public.po_purchases;
CREATE POLICY "Agents manage own purchases" ON public.po_purchases
    FOR ALL TO authenticated
    USING (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()))
    WITH CHECK (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()));

-- Políticas para items de compra
DROP POLICY IF EXISTS "Admins full access to po_purchase_items" ON public.po_purchase_items;
CREATE POLICY "Admins full access to po_purchase_items" ON public.po_purchase_items
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents manage own purchase items" ON public.po_purchase_items;
CREATE POLICY "Agents manage own purchase items" ON public.po_purchase_items
    FOR ALL TO authenticated
    USING (purchase_id IN (
        SELECT pp.id FROM po_purchases pp 
        JOIN purchasing_agents pa ON pa.id = pp.agent_id 
        WHERE pa.user_id = auth.uid()
    ))
    WITH CHECK (purchase_id IN (
        SELECT pp.id FROM po_purchases pp 
        JOIN purchasing_agents pa ON pa.id = pp.agent_id 
        WHERE pa.user_id = auth.uid()
    ));

-- Políticas para envíos
DROP POLICY IF EXISTS "Admins full access to po_shipments" ON public.po_shipments;
CREATE POLICY "Admins full access to po_shipments" ON public.po_shipments
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents manage own shipments" ON public.po_shipments;
CREATE POLICY "Agents manage own shipments" ON public.po_shipments
    FOR ALL TO authenticated
    USING (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()))
    WITH CHECK (agent_id IN (SELECT id FROM purchasing_agents WHERE user_id = auth.uid()));

-- Políticas para items de envío
DROP POLICY IF EXISTS "Admins full access to po_shipment_items" ON public.po_shipment_items;
CREATE POLICY "Admins full access to po_shipment_items" ON public.po_shipment_items
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents manage own shipment items" ON public.po_shipment_items;
CREATE POLICY "Agents manage own shipment items" ON public.po_shipment_items
    FOR ALL TO authenticated
    USING (shipment_id IN (
        SELECT ps.id FROM po_shipments ps 
        JOIN purchasing_agents pa ON pa.id = ps.agent_id 
        WHERE pa.user_id = auth.uid()
    ));

-- Políticas para reconciliación
DROP POLICY IF EXISTS "Admins full access to po_reconciliation" ON public.po_reconciliation;
CREATE POLICY "Admins full access to po_reconciliation" ON public.po_reconciliation
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents view po_reconciliation" ON public.po_reconciliation;
CREATE POLICY "Agents view po_reconciliation" ON public.po_reconciliation
    FOR SELECT TO authenticated
    USING (po_id IN (
        SELECT paa.po_id FROM po_agent_assignments paa
        JOIN purchasing_agents pa ON pa.id = paa.agent_id
        WHERE pa.user_id = auth.uid()
    ));

-- Políticas para acceso de inversionistas
DROP POLICY IF EXISTS "Investors view own qc access" ON public.investor_qc_access;
CREATE POLICY "Investors view own qc access" ON public.investor_qc_access
    FOR SELECT TO authenticated
    USING (investor_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access to investor_qc_access" ON public.investor_qc_access;
CREATE POLICY "Admins full access to investor_qc_access" ON public.investor_qc_access
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket para multimedia de agentes
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-media', 'agent-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Agents can upload media" ON storage.objects;
CREATE POLICY "Agents can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'agent-media' AND
    (EXISTS (SELECT 1 FROM purchasing_agents WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Anyone can view agent media" ON storage.objects;
CREATE POLICY "Anyone can view agent media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'agent-media');

DROP POLICY IF EXISTS "Agents can update own media" ON storage.objects;
CREATE POLICY "Agents can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-media' AND
    (EXISTS (SELECT 1 FROM purchasing_agents WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Agents can delete own media" ON storage.objects;
CREATE POLICY "Agents can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-media' AND
    (EXISTS (SELECT 1 FROM purchasing_agents WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
);