/**
 * Converts a Supabase Storage public URL to an image-transform URL
 * that lets Supabase resize/compress the image on the fly.
 *
 * Example:
 *   /storage/v1/object/public/bucket/path.jpg
 *   → /storage/v1/render/image/public/bucket/path.jpg?width=400&quality=75
 *
 * Falls back to the original URL for non-Supabase or already-transformed URLs.
 */
export function imgUrl(
  src: string | null | undefined,
  options: { width?: number; quality?: number; format?: 'origin' | 'webp' } = {}
): string {
  if (!src) return '';

  const { width = 400, quality = 80, format = 'webp' } = options;

  // Only transform Supabase Storage object URLs
  if (src.includes('/storage/v1/object/public/')) {
    const transformed = src.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );
    const sep = transformed.includes('?') ? '&' : '?';
    const formatParam = format === 'origin' ? '' : `&format=${format}`;
    return `${transformed}${sep}width=${width}&quality=${quality}${formatParam}`;
  }

  return src;
}
