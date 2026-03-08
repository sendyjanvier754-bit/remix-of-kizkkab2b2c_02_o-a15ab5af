
-- =============================================
-- Agent sessions table
-- =============================================
CREATE TABLE public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','active','expired','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own sessions"
  ON public.agent_sessions FOR ALL TO authenticated
  USING (agent_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'seller') OR
    public.has_role(auth.uid(), 'sales_agent')
  ))
  WITH CHECK (agent_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'seller') OR
    public.has_role(auth.uid(), 'sales_agent')
  ));

-- =============================================
-- Agent cart drafts table
-- =============================================
CREATE TABLE public.agent_cart_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Borrador',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent_to_checkout','completed','cancelled')),
  shipping_address JSONB,
  market_country TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_cart_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own drafts"
  ON public.agent_cart_drafts FOR ALL TO authenticated
  USING (agent_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'seller') OR
    public.has_role(auth.uid(), 'sales_agent')
  ))
  WITH CHECK (agent_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'seller') OR
    public.has_role(auth.uid(), 'sales_agent')
  ));

CREATE POLICY "Users can read own drafts"
  ON public.agent_cart_drafts FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

-- =============================================
-- Agent cart draft items table
-- =============================================
CREATE TABLE public.agent_cart_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.agent_cart_drafts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_price NUMERIC(12,2) NOT NULL,
  peso_kg NUMERIC(10,4) DEFAULT 0,
  color TEXT,
  size TEXT,
  image TEXT,
  moq INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agent_cart_draft_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage draft items"
  ON public.agent_cart_draft_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_cart_drafts d
    WHERE d.id = draft_id AND d.agent_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_cart_drafts d
    WHERE d.id = draft_id AND d.agent_id = auth.uid()
  ));

CREATE POLICY "Users can read own draft items"
  ON public.agent_cart_draft_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_cart_drafts d
    WHERE d.id = draft_id AND d.target_user_id = auth.uid()
  ));

-- =============================================
-- RPC: agent_push_cart_to_user
-- =============================================
CREATE OR REPLACE FUNCTION public.agent_push_cart_to_user(p_draft_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft RECORD;
  v_cart_id UUID;
  v_item RECORD;
  v_items_count INT := 0;
BEGIN
  SELECT * INTO v_draft FROM agent_cart_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft not found');
  END IF;
  IF v_draft.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft is not in draft status');
  END IF;

  IF v_draft.agent_session_id IS NOT NULL THEN
    PERFORM 1 FROM agent_sessions
    WHERE id = v_draft.agent_session_id
      AND status = 'active'
      AND session_expires_at > NOW();
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Agent session expired');
    END IF;
  END IF;

  SELECT id INTO v_cart_id FROM b2b_carts
  WHERE buyer_user_id = v_draft.target_user_id AND status = 'active'
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    INSERT INTO b2b_carts (buyer_user_id, status)
    VALUES (v_draft.target_user_id, 'active')
    RETURNING id INTO v_cart_id;
  END IF;

  FOR v_item IN SELECT * FROM agent_cart_draft_items WHERE draft_id = p_draft_id
  LOOP
    INSERT INTO b2b_cart_items (
      cart_id, product_id, variant_id, sku, nombre, unit_price,
      quantity, total_price, peso_kg, color, size, image
    ) VALUES (
      v_cart_id, v_item.product_id, v_item.variant_id, v_item.sku,
      v_item.nombre, v_item.unit_price, v_item.quantity,
      v_item.total_price, v_item.peso_kg, v_item.color, v_item.size,
      v_item.image
    );
    v_items_count := v_items_count + 1;
  END LOOP;

  UPDATE agent_cart_drafts SET status = 'sent_to_checkout', updated_at = NOW()
  WHERE id = p_draft_id;

  INSERT INTO notifications (user_id, title, message, data)
  VALUES (
    v_draft.target_user_id,
    'Tu carrito ha sido preparado',
    'Un agente ha preparado tu carrito con ' || v_items_count || ' productos. Revisa y procede al pago.',
    jsonb_build_object('type', 'agent_cart_ready', 'draft_id', p_draft_id, 'cart_id', v_cart_id)
  );

  RETURN jsonb_build_object('success', true, 'cart_id', v_cart_id, 'items_count', v_items_count);
END;
$$;
