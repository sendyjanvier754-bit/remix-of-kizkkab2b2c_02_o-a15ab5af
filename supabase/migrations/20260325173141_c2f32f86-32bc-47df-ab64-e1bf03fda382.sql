-- Add RLS policies for b2b_margin_ranges (UPDATE, DELETE, INSERT, SELECT)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated select on b2b_margin_ranges" ON b2b_margin_ranges;
  DROP POLICY IF EXISTS "Allow authenticated insert on b2b_margin_ranges" ON b2b_margin_ranges;
  DROP POLICY IF EXISTS "Allow authenticated update on b2b_margin_ranges" ON b2b_margin_ranges;
  DROP POLICY IF EXISTS "Allow authenticated delete on b2b_margin_ranges" ON b2b_margin_ranges;
END $$;

ALTER TABLE b2b_margin_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select on b2b_margin_ranges"
ON b2b_margin_ranges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on b2b_margin_ranges"
ON b2b_margin_ranges FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on b2b_margin_ranges"
ON b2b_margin_ranges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on b2b_margin_ranges"
ON b2b_margin_ranges FOR DELETE TO authenticated USING (true);