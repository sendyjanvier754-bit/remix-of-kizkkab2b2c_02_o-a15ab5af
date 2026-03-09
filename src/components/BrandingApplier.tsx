import { useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';
import { setBrandingName } from '@/services/pdfGenerators';

/**
 * Invisible component mounted once at app root.
 * Applies dynamic branding to the document:
 *  - favicon (<link rel="icon">)
 *  - default document title (when no page-specific useSEO is active)
 */
export function BrandingApplier() {
  const { getValue } = useBranding();

  const platformName = getValue('platform_name');
  const faviconUrl = getValue('favicon_url');

  // Update favicon when branding loads
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);

  // Update default document title
  useEffect(() => {
    if (platformName) {
      setBrandingName(platformName);
      // Only set if no page has already set a custom title (i.e. title equals the bare html default)
      if (!document.title || document.title === 'Vite App') {
        document.title = platformName;
      }
    }
  }, [platformName]);

  return null;
}
