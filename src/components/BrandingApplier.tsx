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
  const platformSlogan = getValue('platform_slogan');
  const faviconUrl = getValue('favicon_url');
  const logoUrl = getValue('logo_url');
  const browserTabTitle = getValue('browser_tab_title');
  const browserMetaDescription = getValue('browser_meta_description');
  const shareTitle = getValue('share_title');
  const shareDescription = getValue('share_description');
  const shareImageUrl = getValue('share_image_url');

  // Update favicon when branding loads
  useEffect(() => {
    const sourceIconUrl = faviconUrl || logoUrl;
    if (!sourceIconUrl) return;

    const versioned = `${sourceIconUrl}${sourceIconUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

    const ensureLink = (selector: string, rel: string, sizes?: string): HTMLLinkElement => {
      let link = document.querySelector<HTMLLinkElement>(selector);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        if (sizes) link.setAttribute('sizes', sizes);
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      if (sizes) link.setAttribute('sizes', sizes);
      return link;
    };

    const applyFavicon = (hrefs?: Record<number, string>) => {
      // Multi-size icon links help browsers pick the sharpest one available.
      const icon16 = ensureLink("link[rel='icon'][sizes='16x16']", 'icon', '16x16');
      const icon32 = ensureLink("link[rel='icon'][sizes='32x32']", 'icon', '32x32');
      const icon48 = ensureLink("link[rel='icon'][sizes='48x48']", 'icon', '48x48');
      const icon64 = ensureLink("link[rel='icon'][sizes='64x64']", 'icon', '64x64');
      const icon192 = ensureLink("link[rel='icon'][sizes='192x192']", 'icon', '192x192');
      const icon512 = ensureLink("link[rel='icon'][sizes='512x512']", 'icon', '512x512');
      const iconDefault = ensureLink("link[rel='icon']:not([sizes])", 'icon');
      const shortcut = ensureLink("link[rel='shortcut icon']", 'shortcut icon');
      const appleTouch = ensureLink("link[rel='apple-touch-icon']", 'apple-touch-icon', '180x180');

      const fallback = versioned;

      icon16.href = hrefs?.[16] || fallback;
      icon32.href = hrefs?.[32] || fallback;
      icon48.href = hrefs?.[48] || fallback;
      icon64.href = hrefs?.[64] || fallback;
      icon192.href = hrefs?.[192] || fallback;
      icon512.href = hrefs?.[512] || fallback;
      iconDefault.href = hrefs?.[512] || hrefs?.[192] || fallback;
      shortcut.href = hrefs?.[32] || fallback;
      appleTouch.href = hrefs?.[180] || hrefs?.[192] || fallback;

      [icon16, icon32, icon48, icon64, icon192, icon512, iconDefault, shortcut, appleTouch].forEach((link) => {
        link.type = 'image/png';
      });
    };

    let cancelled = false;

    (async () => {
      const circularDataUrls = await createCircularFaviconDataUrls(versioned, [16, 32, 48, 64, 180, 192, 512]);
      if (cancelled) return;
      applyFavicon(circularDataUrls || undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [faviconUrl, logoUrl]);

  // Update default document title
  useEffect(() => {
    if (platformName) {
      setBrandingName(platformName);
      const defaultTitle = browserTabTitle || `${platformName}${platformSlogan ? ` | ${platformSlogan}` : ''}`;
      const previousDefaultTitle = document.documentElement.dataset.defaultBrandingTitle || '';
      const staticBootTitles = new Set([
        'Vite App',
        'Siver Market 509 | Marketplace Mayorista B2B en Haití',
      ]);

      // Only set if no page has already set a custom title
      if (!document.title || staticBootTitles.has(document.title) || document.title === previousDefaultTitle) {
        document.title = defaultTitle;
        document.documentElement.dataset.defaultBrandingTitle = defaultTitle;
      }
    }

    const defaultDescription = browserMetaDescription || shareDescription || platformSlogan || '';
    if (defaultDescription) {
      setOrCreateMeta('description', defaultDescription);
      setOrCreateMeta('og:description', defaultDescription);
      setOrCreateMeta('twitter:description', defaultDescription);
    }

    const socialTitle = shareTitle || browserTabTitle || platformName;
    if (socialTitle) {
      setOrCreateMeta('og:title', socialTitle);
      setOrCreateMeta('twitter:title', socialTitle);
    }

    const socialImage = shareImageUrl || logoUrl || faviconUrl;
    if (socialImage) {
      setOrCreateMeta('og:image', socialImage);
      setOrCreateMeta('twitter:image', socialImage);
    }
  }, [
    platformName,
    platformSlogan,
    browserTabTitle,
    browserMetaDescription,
    shareTitle,
    shareDescription,
    shareImageUrl,
    logoUrl,
    faviconUrl,
  ]);

  return null;
}

function setOrCreateMeta(key: string, content: string) {
  const isTwitterOrDescription = key.startsWith('twitter:') || key === 'description';
  const attr = isTwitterOrDescription ? 'name' : 'property';

  let meta = document.querySelector(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

async function createCircularFaviconDataUrls(url: string, sizes: number[]): Promise<Record<number, string> | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const out: Record<number, string> = {};
        for (const size of sizes) {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.clearRect(0, 0, size, size);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.save();
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          const scale = Math.max(size / img.width, size / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = (size - drawW) / 2;
          const dy = (size - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
          ctx.restore();

          out[size] = canvas.toDataURL('image/png');
        }

        if (Object.keys(out).length === 0) {
          resolve(null);
          return;
        }

        resolve(out);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}
