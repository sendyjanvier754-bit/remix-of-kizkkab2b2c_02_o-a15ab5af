-- =============================================
-- Support Chat System
-- =============================================

-- Chat status enum
CREATE TYPE public.chat_status AS ENUM ('waiting', 'active', 'paused', 'closed');

-- Support chats table
CREATE TABLE public.support_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Soporte',
  -- Who opened the chat
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional order reference
  order_id UUID NULL,
  order_type TEXT NULL CHECK (order_type IN ('b2b', 'b2c')),
  -- Chat state
  status chat_status NOT NULL DEFAULT 'waiting',
  -- Assigned staff member (null = waiting for someone)
  assigned_to UUID NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NULL,
  -- Metadata
  paused_by UUID NULL REFERENCES auth.users(id),
  paused_at TIMESTAMPTZ NULL,
  closed_by UUID NULL REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ NULL,
  close_reason TEXT NULL,
  -- Counters for unread
  unread_customer INT NOT NULL DEFAULT 0,
  unread_staff INT NOT NULL DEFAULT 0,
  -- Timestamps
  last_message_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  file_url TEXT NULL,
  file_name TEXT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_chats_created_by ON public.support_chats(created_by);
CREATE INDEX idx_support_chats_assigned_to ON public.support_chats(assigned_to);
CREATE INDEX idx_support_chats_status ON public.support_chats(status);
CREATE INDEX idx_support_chats_order ON public.support_chats(order_id, order_type);
CREATE INDEX idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for support_chats
-- =============================================

-- Customers can see their own chats
CREATE POLICY "Users can view own chats"
  ON public.support_chats FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Customers can create chats
CREATE POLICY "Users can create chats"
  ON public.support_chats FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Customers can update own chats (pause/close)
CREATE POLICY "Users can update own chats"
  ON public.support_chats FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Staff (admin/seller/sales_agent) can view all chats
CREATE POLICY "Staff can view all chats"
  ON public.support_chats FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'seller')
    OR public.has_role(auth.uid(), 'sales_agent')
  );

-- Staff can update any chat (assign, pause, close)
CREATE POLICY "Staff can update all chats"
  ON public.support_chats FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'seller')
    OR public.has_role(auth.uid(), 'sales_agent')
  );

-- =============================================
-- RLS Policies for chat_messages
-- =============================================

-- Users can read messages from their own chats
CREATE POLICY "Users can read own chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_chats sc
      WHERE sc.id = chat_messages.chat_id
      AND sc.created_by = auth.uid()
    )
  );

-- Staff can read all messages
CREATE POLICY "Staff can read all chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'seller')
    OR public.has_role(auth.uid(), 'sales_agent')
  );

-- Authenticated users can send messages to chats they participate in
CREATE POLICY "Users can send messages to own chats"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_chats sc
      WHERE sc.id = chat_messages.chat_id
      AND (
        sc.created_by = auth.uid()
        OR sc.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'seller')
        OR public.has_role(auth.uid(), 'sales_agent')
      )
    )
  );

-- Users can mark messages as read
CREATE POLICY "Users can update message read status"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_chats sc
      WHERE sc.id = chat_messages.chat_id
      AND (
        sc.created_by = auth.uid()
        OR sc.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
    )
  );

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;