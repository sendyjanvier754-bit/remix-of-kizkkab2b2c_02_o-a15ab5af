
-- Create email_senders table for multiple sender emails by purpose
CREATE TABLE IF NOT EXISTS public.email_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Siver',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(purpose)
);

-- Enable RLS
ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email senders
CREATE POLICY "Admins can manage email senders"
  ON public.email_senders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default purposes
INSERT INTO public.email_senders (purpose, sender_email, sender_name) VALUES
  ('authentication', '', 'Siver Auth'),
  ('orders', '', 'Siver Pedidos'),
  ('notifications', '', 'Siver Notificaciones'),
  ('marketing', '', 'Siver Marketing'),
  ('support', '', 'Siver Soporte')
ON CONFLICT (purpose) DO NOTHING;
