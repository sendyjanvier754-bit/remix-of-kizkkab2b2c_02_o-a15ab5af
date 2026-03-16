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

-- Keep related SEO keys in sync whenever branding identity/SEO is edited.
-- This solves stale values across:
--   browser_tab_title, share_title, meta_title
--   browser_meta_description, share_description, meta_description
CREATE OR REPLACE FUNCTION public.sync_branding_seo_related_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform_name TEXT;
  v_platform_slogan TEXT;
  v_meta_title TEXT;
  v_browser_title TEXT;
  v_share_title TEXT;
  v_meta_desc TEXT;
  v_browser_desc TEXT;
  v_share_desc TEXT;
  v_derived_title TEXT;
  v_derived_desc TEXT;
BEGIN
  -- Avoid recursive loops from our own upserts.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only react to keys that can influence SEO/share values.
  IF NEW.key NOT IN (
    'platform_name',
    'platform_slogan',
    'meta_title',
    'meta_description',
    'browser_tab_title',
    'browser_meta_description',
    'share_title',
    'share_description'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_platform_name FROM public.branding_settings WHERE key = 'platform_name' LIMIT 1;
  SELECT value INTO v_platform_slogan FROM public.branding_settings WHERE key = 'platform_slogan' LIMIT 1;
  SELECT value INTO v_meta_title FROM public.branding_settings WHERE key = 'meta_title' LIMIT 1;
  SELECT value INTO v_browser_title FROM public.branding_settings WHERE key = 'browser_tab_title' LIMIT 1;
  SELECT value INTO v_share_title FROM public.branding_settings WHERE key = 'share_title' LIMIT 1;

  SELECT value INTO v_meta_desc FROM public.branding_settings WHERE key = 'meta_description' LIMIT 1;
  SELECT value INTO v_browser_desc FROM public.branding_settings WHERE key = 'browser_meta_description' LIMIT 1;
  SELECT value INTO v_share_desc FROM public.branding_settings WHERE key = 'share_description' LIMIT 1;

  -- TITLE GROUP SYNC STRATEGY
  -- - If platform_name/platform_slogan changes => regenerate title from brand identity
  -- - If any title field changes => mirror that exact value to all title fields
  -- - Otherwise use best available existing value
  IF NEW.key IN ('platform_name', 'platform_slogan') THEN
    v_derived_title := CASE
      WHEN COALESCE(v_platform_name, '') <> ''
        THEN v_platform_name || CASE WHEN COALESCE(v_platform_slogan, '') <> '' THEN ' | ' || v_platform_slogan ELSE '' END
      ELSE ''
    END;
  ELSIF NEW.key IN ('meta_title', 'browser_tab_title', 'share_title') THEN
    v_derived_title := COALESCE(NEW.value, '');
  ELSE
    v_derived_title := COALESCE(
      NULLIF(v_meta_title, ''),
      NULLIF(v_browser_title, ''),
      NULLIF(v_share_title, ''),
      CASE
        WHEN COALESCE(v_platform_name, '') <> ''
          THEN v_platform_name || CASE WHEN COALESCE(v_platform_slogan, '') <> '' THEN ' | ' || v_platform_slogan ELSE '' END
        ELSE ''
      END,
      ''
    );
  END IF;

  -- DESCRIPTION GROUP SYNC STRATEGY
  -- - If any description field changes => mirror that exact value to all description fields
  -- - Otherwise use best available existing value
  IF NEW.key IN ('meta_description', 'browser_meta_description', 'share_description') THEN
    v_derived_desc := COALESCE(NEW.value, '');
  ELSE
    v_derived_desc := COALESCE(
      NULLIF(v_meta_desc, ''),
      NULLIF(v_browser_desc, ''),
      NULLIF(v_share_desc, ''),
      ''
    );
  END IF;

  INSERT INTO public.branding_settings (key, value, description)
  VALUES
    ('meta_title', v_derived_title, 'Meta título para SEO'),
    ('browser_tab_title', v_derived_title, 'Título por defecto de la pestaña del navegador'),
    ('share_title', v_derived_title, 'Título por defecto para compartir enlaces (Open Graph/Twitter)'),
    ('meta_description', v_derived_desc, 'Meta descripción para SEO'),
    ('browser_meta_description', v_derived_desc, 'Descripción por defecto (meta description/tooltip del navegador)'),
    ('share_description', v_derived_desc, 'Descripción por defecto para compartir enlaces (Open Graph/Twitter)')
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_branding_seo_related_keys ON public.branding_settings;

CREATE TRIGGER trg_sync_branding_seo_related_keys
AFTER INSERT OR UPDATE OF value ON public.branding_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_branding_seo_related_keys();

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
    'meta_title',
    'meta_description',
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
      'skipped_no_webhook',
      'seo_redeploy_webhook_url is not configured in Vault.'
    );
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
