import { useEffect, useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  fallbackSrcs?: (string | null | undefined)[];
  alt: string;
  className?: string;
  /**
   * "eager" by default to avoid the "image only appears after navigating away and back"
   * issue caused by lazy loading of slow external CDNs (e.g. 1688/Alibaba).
   */
  loading?: 'eager' | 'lazy';
}

const PLACEHOLDER = '/placeholder.svg';

/**
 * Robust product image:
 *  - Uses referrerPolicy="no-referrer" so external CDNs (1688, alibaba, etc.) don't
 *    block hotlinking requests with a 403.
 *  - Falls back through `fallbackSrcs` (e.g. galería) and finally to /placeholder.svg
 *    if the primary image fails or returns 0x0.
 *  - Shows a skeleton background until the image actually decodes, instead of
 *    rendering the `alt` text as broken-image fallback.
 */
const ProductImage = ({
  src,
  fallbackSrcs = [],
  alt,
  className,
  loading = 'eager',
}: ProductImageProps) => {
  // Build ordered candidate list (dedup, drop falsy)
  const candidates = [src, ...fallbackSrcs, PLACEHOLDER]
    .filter((s): s is string => Boolean(s && s.trim()))
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Reset when the primary src changes
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [src]);

  const currentSrc = candidates[index] ?? PLACEHOLDER;

  return (
    <div className={`relative bg-muted overflow-hidden ${className ?? ''}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={(e) => {
          const img = e.currentTarget;
          // Some CDNs return an empty/0x0 image instead of erroring → treat as failure.
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            if (index < candidates.length - 1) setIndex(index + 1);
            return;
          }
          setLoaded(true);
        }}
        onError={() => {
          if (index < candidates.length - 1) {
            setIndex(index + 1);
            setLoaded(false);
          } else {
            setLoaded(true);
          }
        }}
      />
    </div>
  );
};

export default ProductImage;
