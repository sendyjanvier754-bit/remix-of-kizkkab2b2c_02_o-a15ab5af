import { useEffect } from 'react';

/**
 * Prevents page scroll while `active` is true.
 *
 * Safe for nested overlays: uses a ref-count stored as `body.dataset.scrollLockCount`
 * so that N concurrent callers each acquire/release the lock independently.
 * Scroll is only restored once the last lock is released.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const body = document.body;
    const html = document.documentElement;
    const currentCount = Number(body.dataset.scrollLockCount || '0');

    if (currentCount === 0) {
      body.dataset.scrollLockBodyOverflow = body.style.overflow || '';
      body.dataset.scrollLockHtmlOverflow = html.style.overflow || '';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
    }

    body.dataset.scrollLockCount = String(currentCount + 1);

    return () => {
      const count = Number(body.dataset.scrollLockCount || '0');
      const nextCount = Math.max(0, count - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset.scrollLockBodyOverflow || '';
        html.style.overflow = body.dataset.scrollLockHtmlOverflow || '';
        delete body.dataset.scrollLockCount;
        delete body.dataset.scrollLockBodyOverflow;
        delete body.dataset.scrollLockHtmlOverflow;
      } else {
        body.dataset.scrollLockCount = String(nextCount);
      }
    };
  }, [active]);
}
