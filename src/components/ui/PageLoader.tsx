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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md animate-loader-fade" role="status" aria-live="polite">
      <div className="relative flex flex-col items-center justify-center gap-5">
        <div className="relative" style={{ width: loaderRingSize, height: loaderRingSize }}>
          {/* Brand glow */}
          <div className="absolute -inset-4 rounded-full blur-2xl animate-loader-glow" style={{ background: loaderRingColor }} />
          {/* Track + orbiting arc */}
          <div className="absolute -inset-2 rounded-full" style={{ border: `${loaderRingWidth}px solid ${loaderRingColor}22` }} />
          <div
            className="absolute -inset-2 rounded-full animate-spin pointer-events-none"
            style={{ border: `${loaderRingWidth}px solid transparent`, borderTopColor: loaderRingColor, borderRightColor: `${loaderRingColor}88`, animationDuration: '1.1s' }}
          />
          {/* Logo */}
          <div className="absolute inset-0 rounded-full overflow-hidden bg-background shadow-lg animate-loader-breathe">
            {loaderType === 'video' && loaderUrl ? (
              <video src={loaderUrl} autoPlay loop muted playsInline className={`h-full w-full ${mediaFitClass}`} />
            ) : (
              <img
                src={mediaSrc}
                alt={platformName || 'Logo'}
                className={`h-full w-full ${mediaFitClass}`}
                decoding="async"
                loading="eager"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== faviconUrl) img.src = faviconUrl;
                  else img.style.display = 'none';
                }}
              />
            )}
            {/* Shimmer sweep */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-background/60 to-transparent animate-loader-shimmer" />
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm font-semibold tracking-wide text-foreground/80">
          <span>{platformName || 'Cargando'}</span>
          <span className="flex gap-0.5 ml-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-1 rounded-full animate-loader-dot" style={{ background: loaderRingColor, animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
};
