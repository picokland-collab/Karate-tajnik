-- Create dedicated private bucket for HUB 3A PDF cache
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'billing-cache',
  'billing-cache',
  false,
  5242880,                   -- 5 MB ceiling per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may read cached PDFs (server route verifies club gate before issuing)
CREATE POLICY "billing_cache_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'billing-cache');

-- Authenticated users may insert cached PDFs
CREATE POLICY "billing_cache_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'billing-cache');
