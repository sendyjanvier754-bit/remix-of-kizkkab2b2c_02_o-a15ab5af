import { useEffect, useState } from "react";
import { useBranding } from "@/hooks/useBranding";

/**
 * Full-page loading overlay.
 *
 * Center media (image / gif / video) is configurable from Admin → Identidad:
 *   branding_settings.loader_media_url  — URL of the media file
 *   branding_settings.loader_media_type — 'image' | 'gif' | 'video'  (default: 'image')
 *
 * Falls back to the site favicon when no branding media is configured.
 */
export const PageLoader = () => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const logoUrl = getValue('logo_url');
  const loaderUrl = getValue('loader_media_url');
  const loaderType = getValue('loader_media_type') || 'image';
  const loaderFit = getValue('loader_media_fit') || 'cover';
  const loaderRingColor = getValue('loader_ring_color') || '#1d4ed8';
  const loaderRingSizeRaw = Number(getValue('loader_ring_size') || '96');
  const loaderRingWidthRaw = Number(getValue('loader_ring_width') || '4');
  const loaderRingSize = Number.isFinite(loaderRingSizeRaw)
    ? Math.min(220, Math.max(56, loaderRingSizeRaw))
    : 96;
  const loaderRingWidth = Number.isFinite(loaderRingWidthRaw)
    ? Math.min(12, Math.max(2, loaderRingWidthRaw))
    : 4;
  const mediaFitClass = loaderFit === 'contain' ? 'object-scale-down' : 'object-cover';

  // Favicon fallback — resolved at runtime so dynamic favicons are supported
  const [faviconUrl, setFaviconUrl] = useState<string>("/favicon.png");

  useEffect(() => {
    const updateFavicon = () => {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link?.href) setFaviconUrl(link.href);
    };
    updateFavicon();
    const observer = new MutationObserver(updateFavicon);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, []);

  // Prefer explicit loader media, then logo (usually higher-res), then favicon.
  const mediaSrc = loaderUrl || logoUrl || faviconUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center justify-center gap-3">
        <div className="relative" style={{ width: loaderRingSize, height: loaderRingSize }}>
          {/* Circular media base (fills the same diameter as spinner ring) */}
          <div className="absolute inset-0 rounded-full overflow-hidden bg-background" style={{ border: `1px solid ${loaderRingColor}33` }}>
            {loaderType === 'video' && loaderUrl ? (
              <video
                src={loaderUrl}
                autoPlay
                loop
                muted
                playsInline
                className={`h-full w-full ${mediaFitClass}`}
              />
            ) : (
              <img
                src={mediaSrc}
                alt="Loading…"
                className={`h-full w-full ${mediaFitClass}`}
                decoding="async"
                loading="eager"
                style={{ imageRendering: 'auto' }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== faviconUrl) {
                    img.src = faviconUrl;
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />
            )}
          </div>

          {/* Spinning ring overlay */}
          <div
            className="absolute inset-0 animate-spin rounded-full border-4 pointer-events-none"
            style={{ borderColor: loaderRingColor, borderTopColor: 'transparent', borderWidth: loaderRingWidth }}
          />
        </div>

        <p className="text-sm font-semibold text-foreground/80">
          {platformName || 'Cargando...' }
        </p>
      </div>
    </div>
  );
};
