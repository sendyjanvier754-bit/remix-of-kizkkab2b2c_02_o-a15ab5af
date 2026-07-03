ALTER TABLE public.kyc_verifications
ADD COLUMN IF NOT EXISTS id_front_url TEXT,
ADD COLUMN IF NOT EXISTS id_back_url TEXT;

UPDATE public.kyc_verifications
SET
  id_front_url = COALESCE(id_front_url, document_front_url),
  id_back_url = COALESCE(id_back_url, document_back_url)
WHERE
  (id_front_url IS NULL AND document_front_url IS NOT NULL)
  OR (id_back_url IS NULL AND document_back_url IS NOT NULL);