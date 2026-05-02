-- 1. Add columns to support_chats
ALTER TABLE public.support_chats
  ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_context text NOT NULL DEFAULT 'support';

CREATE INDEX IF NOT EXISTS idx_support_chats_route_id ON public.support_chats(route_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_context ON public.support_chats(chat_context);

-- 2. Helper: is current user the driver of a route
CREATE OR REPLACE FUNCTION public.is_route_driver(_user_id uuid, _route_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_routes dr
    JOIN public.drivers d ON d.id = dr.driver_id
    WHERE dr.id = _route_id AND d.user_id = _user_id
  );
$$;

-- 3. Helper: is current user a manager of the pickup point of an order
CREATE OR REPLACE FUNCTION public.is_order_pickup_manager(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders_b2c o
    JOIN public.pickup_point_managers ppm
      ON ppm.pickup_point_id = o.pickup_point_id
    WHERE o.id = _order_id
      AND ppm.user_id = _user_id
      AND ppm.is_active = true
  );
$$;

-- 4. RLS policies on support_chats for partner access
DROP POLICY IF EXISTS "Drivers can view their route chats" ON public.support_chats;
CREATE POLICY "Drivers can view their route chats"
ON public.support_chats FOR SELECT
TO authenticated
USING (
  route_id IS NOT NULL
  AND public.is_route_driver(auth.uid(), route_id)
);

DROP POLICY IF EXISTS "Drivers can update their route chats" ON public.support_chats;
CREATE POLICY "Drivers can update their route chats"
ON public.support_chats FOR UPDATE
TO authenticated
USING (route_id IS NOT NULL AND public.is_route_driver(auth.uid(), route_id))
WITH CHECK (route_id IS NOT NULL AND public.is_route_driver(auth.uid(), route_id));

DROP POLICY IF EXISTS "Pickup managers can view their order chats" ON public.support_chats;
CREATE POLICY "Pickup managers can view their order chats"
ON public.support_chats FOR SELECT
TO authenticated
USING (
  order_id IS NOT NULL
  AND chat_context = 'partner_order'
  AND public.is_order_pickup_manager(auth.uid(), order_id)
);

DROP POLICY IF EXISTS "Pickup managers can update their order chats" ON public.support_chats;
CREATE POLICY "Pickup managers can update their order chats"
ON public.support_chats FOR UPDATE
TO authenticated
USING (
  order_id IS NOT NULL
  AND chat_context = 'partner_order'
  AND public.is_order_pickup_manager(auth.uid(), order_id)
)
WITH CHECK (
  order_id IS NOT NULL
  AND chat_context = 'partner_order'
  AND public.is_order_pickup_manager(auth.uid(), order_id)
);

-- 5. RLS policies on chat_messages for partner access
DROP POLICY IF EXISTS "Drivers can view route chat messages" ON public.chat_messages;
CREATE POLICY "Drivers can view route chat messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_chats sc
    WHERE sc.id = chat_messages.chat_id
      AND sc.route_id IS NOT NULL
      AND public.is_route_driver(auth.uid(), sc.route_id)
  )
);

DROP POLICY IF EXISTS "Drivers can send route chat messages" ON public.chat_messages;
CREATE POLICY "Drivers can send route chat messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_chats sc
    WHERE sc.id = chat_messages.chat_id
      AND sc.route_id IS NOT NULL
      AND public.is_route_driver(auth.uid(), sc.route_id)
  )
);

DROP POLICY IF EXISTS "Pickup managers can view order chat messages" ON public.chat_messages;
CREATE POLICY "Pickup managers can view order chat messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_chats sc
    WHERE sc.id = chat_messages.chat_id
      AND sc.order_id IS NOT NULL
      AND sc.chat_context = 'partner_order'
      AND public.is_order_pickup_manager(auth.uid(), sc.order_id)
  )
);

DROP POLICY IF EXISTS "Pickup managers can send order chat messages" ON public.chat_messages;
CREATE POLICY "Pickup managers can send order chat messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_chats sc
    WHERE sc.id = chat_messages.chat_id
      AND sc.order_id IS NOT NULL
      AND sc.chat_context = 'partner_order'
      AND public.is_order_pickup_manager(auth.uid(), sc.order_id)
  )
);

-- 6. RPC: get or create a partner chat (avoids duplicates)
CREATE OR REPLACE FUNCTION public.get_or_create_partner_chat(
  p_context text,         -- 'partner_order' | 'partner_route'
  p_order_id uuid DEFAULT NULL,
  p_route_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_user_id uuid := auth.uid();
  v_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_context NOT IN ('partner_order', 'partner_route') THEN
    RAISE EXCEPTION 'Contexto inválido';
  END IF;

  -- Try find existing
  IF p_context = 'partner_route' AND p_route_id IS NOT NULL THEN
    SELECT id INTO v_chat_id
    FROM public.support_chats
    WHERE route_id = p_route_id AND chat_context = 'partner_route'
    LIMIT 1;
  ELSIF p_context = 'partner_order' AND p_order_id IS NOT NULL THEN
    SELECT id INTO v_chat_id
    FROM public.support_chats
    WHERE order_id = p_order_id AND chat_context = 'partner_order'
    LIMIT 1;
  END IF;

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  v_title := COALESCE(
    p_title,
    CASE
      WHEN p_context = 'partner_route' THEN 'Chat de ruta'
      ELSE 'Chat de pedido (punto de recogida)'
    END
  );

  INSERT INTO public.support_chats (
    title, created_by, order_id, route_id, chat_context, status, order_type
  )
  VALUES (
    v_title,
    v_user_id,
    p_order_id,
    p_route_id,
    p_context,
    'active',
    CASE WHEN p_order_id IS NOT NULL THEN 'b2c' ELSE NULL END
  )
  RETURNING id INTO v_chat_id;

  -- Add participant
  INSERT INTO public.chat_participants (chat_id, user_id, role)
  VALUES (v_chat_id, v_user_id, 'partner')
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  -- System message
  INSERT INTO public.chat_messages (chat_id, sender_id, content, message_type)
  VALUES (
    v_chat_id,
    v_user_id,
    'Chat iniciado',
    'system'
  );

  RETURN v_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_partner_chat(text, uuid, uuid, text) TO authenticated;