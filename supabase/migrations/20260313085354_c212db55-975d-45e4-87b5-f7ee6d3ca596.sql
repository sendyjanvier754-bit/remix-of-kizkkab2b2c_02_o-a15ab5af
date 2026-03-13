
-- =============================================
-- Chat Participants table for group chat support
-- =============================================

CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member', 'staff')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE INDEX idx_chat_participants_chat ON public.chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);

-- Enable RLS
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Participants can see their own participations
CREATE POLICY "Users can view own participations"
  ON public.chat_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff can see all participations
CREATE POLICY "Staff can view all participations"
  ON public.chat_participants FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'seller')
    OR public.has_role(auth.uid(), 'sales_agent')
  );

-- Authenticated users can insert themselves as participants
CREATE POLICY "Users can join chats"
  ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- =============================================
-- Update support_chats RLS: participants can view chats
-- =============================================

CREATE POLICY "Participants can view chats"
  ON public.support_chats FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = support_chats.id
      AND cp.user_id = auth.uid()
    )
  );

-- Participants can update chats (pause/close)
CREATE POLICY "Participants can update chats"
  ON public.support_chats FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = support_chats.id
      AND cp.user_id = auth.uid()
    )
  );

-- =============================================
-- Update chat_messages RLS: participants can read messages
-- =============================================

CREATE POLICY "Participants can read chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_messages.chat_id
      AND cp.user_id = auth.uid()
    )
  );

-- Participants can send messages
CREATE POLICY "Participants can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_messages.chat_id
      AND cp.user_id = auth.uid()
    )
  );

-- Participants can mark messages as read
CREATE POLICY "Participants can update message read status"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_messages.chat_id
      AND cp.user_id = auth.uid()
    )
  );
