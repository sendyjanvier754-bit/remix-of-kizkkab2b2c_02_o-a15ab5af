
-- ============================================================
-- Add destination_country_id to email_senders
-- ============================================================
ALTER TABLE public.email_senders
  ADD COLUMN IF NOT EXISTS destination_country_id UUID REFERENCES public.destination_countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_senders_country
  ON public.email_senders(destination_country_id);

-- Drop old unique constraint if exists, add new one with country
ALTER TABLE public.email_senders DROP CONSTRAINT IF EXISTS email_senders_purpose_key;
ALTER TABLE public.email_senders ADD CONSTRAINT email_senders_purpose_country_key UNIQUE (purpose, destination_country_id);

-- ============================================================
-- Create email_templates table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL,
  destination_country_id UUID REFERENCES public.destination_countries(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_templates_purpose_country_key UNIQUE (purpose, destination_country_id)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_purpose ON public.email_templates(purpose);
CREATE INDEX IF NOT EXISTS idx_email_templates_country ON public.email_templates(destination_country_id);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage email_templates"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default templates for each purpose (no country = global fallback)
INSERT INTO public.email_templates (purpose, name, subject, html_content, variables) VALUES
  ('authentication', 'Verificación de Email', 'Verifica tu cuenta', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#071d7f">Verificación de Cuenta</h1><p>Hola {{name}},</p><p>Usa el siguiente enlace para verificar tu cuenta:</p><p><a href="{{verification_url}}" style="display:inline-block;background:#071d7f;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">Verificar Email</a></p><p style="color:#888;font-size:12px">Si no solicitaste esto, ignora este email.</p></div>', '["name","verification_url"]'),
  ('orders', 'Confirmación de Pedido', 'Tu pedido #{{order_number}} ha sido confirmado', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#071d7f">Pedido Confirmado</h1><p>Hola {{name}},</p><p>Tu pedido <strong>#{{order_number}}</strong> ha sido confirmado por <strong>{{total}}</strong>.</p><p>Te notificaremos cuando tu pedido esté en camino.</p><p style="color:#888;font-size:12px">Gracias por tu compra.</p></div>', '["name","order_number","total"]'),
  ('notifications', 'Notificación General', '{{subject}}', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#071d7f">{{title}}</h1><p>{{message}}</p></div>', '["subject","title","message"]'),
  ('marketing', 'Campaña Marketing', '{{subject}}', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#071d7f">{{title}}</h1><p>{{message}}</p><p><a href="{{cta_url}}" style="display:inline-block;background:#071d7f;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">{{cta_text}}</a></p><p style="color:#888;font-size:12px">Si no deseas recibir estos emails, <a href="{{unsubscribe_url}}">desuscríbete aquí</a>.</p></div>', '["subject","title","message","cta_url","cta_text","unsubscribe_url"]'),
  ('support', 'Respuesta de Soporte', 'Re: {{ticket_subject}}', '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#071d7f">Respuesta de Soporte</h1><p>Hola {{name}},</p><p>{{message}}</p><p style="color:#888;font-size:12px">Ticket: {{ticket_id}}</p></div>', '["name","ticket_subject","message","ticket_id"]')
ON CONFLICT (purpose, destination_country_id) DO NOTHING;
