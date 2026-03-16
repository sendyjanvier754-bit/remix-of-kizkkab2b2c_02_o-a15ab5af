-- =====================================================
-- AUTO-SYNC SEO/OG ON BRANDING CHANGES
-- =====================================================
-- This migration adds a DB-level automation:
-- 1) Trigger watches SEO-related keys in public.branding_settings
-- 2) Trigger function sends webhook (via pg_net) to start a redeploy
--
-- Required Vault secrets (create in Supabase SQL editor or dashboard):
-- - seo_redeploy_webhook_url   (required)
-- - seo_redeploy_webhook_token (optional; sent as Bearer token)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE TABLE IF NOT EXISTS public.branding_seo_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  webhook_url TEXT,
  request_id BIGINT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_seo_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'branding_seo_sync_logs'
      AND policyname = 'Admins can read seo sync logs'
  ) THEN
    CREATE POLICY "Admins can read seo sync logs"
      ON public.branding_seo_sync_logs
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_branding_seo_sync_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url TEXT;
  webhook_token TEXT;
  payload JSONB;
  headers JSONB := '{"Content-Type":"application/json"}'::JSONB;
  req_id BIGINT;
  recently_queued BOOLEAN;
BEGIN
  -- Only react to SEO/share keys.
  IF NEW.key NOT IN (
    'browser_tab_title',
    'browser_meta_description',
    'share_title',
    'share_description',
    'share_image_url',
    'favicon_url',
    'logo_url'
  ) THEN
    RETURN NEW;
  END IF;

  -- Ignore no-op updates.
  IF TG_OP = 'UPDATE' AND NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;

  -- Debounce burst updates (e.g. updateMultiple in admin panel).
  SELECT EXISTS (
    SELECT 1
    FROM public.branding_seo_sync_logs l
    WHERE l.created_at > now() - interval '20 seconds'
      AND l.status IN ('queued', 'sent')
  ) INTO recently_queued;

  IF recently_queued THEN
    INSERT INTO public.branding_seo_sync_logs (
      setting_key,
      old_value,
      new_value,
      status,
      error_message
    ) VALUES (
      NEW.key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
      NEW.value,
      'skipped_recent',
      'Skipped webhook due to cooldown window (20s).'
    );
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
    INTO webhook_url
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'seo_redeploy_webhook_url'
  ORDER BY ds.created_at DESC
  LIMIT 1;

  -- If no webhook configured, skip silently.
  IF webhook_url IS NULL OR btrim(webhook_url) = '' THEN
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
    INTO webhook_token
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'seo_redeploy_webhook_token'
  ORDER BY ds.created_at DESC
  LIMIT 1;

  IF webhook_token IS NOT NULL AND btrim(webhook_token) <> '' THEN
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || webhook_token);
  END IF;

  payload := jsonb_build_object(
    'event', 'branding_seo_changed',
    'project', 'kizkka',
    'setting_key', NEW.key,
    'old_value', CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
    'new_value', NEW.value,
    'changed_at', now(),
    'table', TG_TABLE_NAME,
    'op', TG_OP
  );

  SELECT net.http_post(
    url := webhook_url,
    headers := headers,
    body := payload
  ) INTO req_id;

  INSERT INTO public.branding_seo_sync_logs (
    setting_key,
    old_value,
    new_value,
    webhook_url,
    request_id,
    status
  ) VALUES (
    NEW.key,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
    NEW.value,
    webhook_url,
    req_id,
    'queued'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.branding_seo_sync_logs (
      setting_key,
      old_value,
      new_value,
      webhook_url,
      status,
      error_message
    ) VALUES (
      NEW.key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
      NEW.value,
      webhook_url,
      'error',
      SQLERRM
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branding_seo_sync_webhook ON public.branding_settings;

CREATE TRIGGER trg_branding_seo_sync_webhook
AFTER INSERT OR UPDATE OF value ON public.branding_settings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_branding_seo_sync_webhook();
