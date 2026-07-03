ALTER TABLE public.kyc_verifications
ADD COLUMN IF NOT EXISTS fiscal_document_url TEXT;