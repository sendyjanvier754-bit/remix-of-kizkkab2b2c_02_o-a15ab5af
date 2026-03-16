-- Allow loader video uploads in branding-assets bucket
-- Safe to run multiple times

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/ogg'
]
WHERE id = 'branding-assets';
