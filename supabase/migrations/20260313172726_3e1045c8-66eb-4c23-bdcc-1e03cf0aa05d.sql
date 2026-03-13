CREATE TABLE public.shared_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared carts" ON public.shared_carts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create shared carts" ON public.shared_carts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);