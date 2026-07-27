/**
 * Detects whether a URL points to a video asset based on its extension.
 * Used by banners (and any hero-like carousel) to decide between <img> and <video>.
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv'];

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext));
}
