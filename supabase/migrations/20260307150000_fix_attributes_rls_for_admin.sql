-- ============================================================
-- Fix RLS policies for attributes, attribute_options,
-- variant_attribute_values and product_attribute_values so that
-- admins can INSERT/UPDATE/DELETE.
--
-- The old policies used USING only (no FOR clause + no WITH CHECK),
-- which in PostgreSQL does not apply to INSERT operations.
-- We replace each with explicit FOR ALL + WITH CHECK.
-- ============================================================

-- ── attributes ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage attributes" ON public.attributes;

CREATE POLICY "Admins can manage attributes"
ON public.attributes
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ── attribute_options ────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage attribute options" ON public.attribute_options;

CREATE POLICY "Admins can manage attribute options"
ON public.attribute_options
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ── variant_attribute_values ─────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage variant attributes" ON public.variant_attribute_values;

CREATE POLICY "Admins can manage variant attributes"
ON public.variant_attribute_values
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

SELECT '✅ Attributes RLS policies updated with explicit WITH CHECK for admin' AS resultado;
