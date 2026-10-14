CREATE TABLE public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  user_id uuid,
  language text NOT NULL DEFAULT 'es',
  source text NOT NULL DEFAULT 'newsletter',
  status text NOT NULL DEFAULT 'subscribed',
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.email_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_subscribers TO authenticated;
GRANT ALL ON public.email_subscribers TO service_role;
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.email_subscribers FOR INSERT TO anon, authenticated WITH CHECK (status = 'subscribed');
CREATE POLICY "Admins manage subscribers" ON public.email_subscribers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_email_subscribers_updated BEFORE UPDATE ON public.email_subscribers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  preheader text,
  html_content text NOT NULL DEFAULT '',
  cta_label text,
  cta_url text,
  segment text NOT NULL DEFAULT 'all',
  language text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'draft',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.email_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_email_campaigns_updated BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_sends TO authenticated;
GRANT ALL ON public.email_campaign_sends TO service_role;
ALTER TABLE public.email_campaign_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view sends" ON public.email_campaign_sends FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));