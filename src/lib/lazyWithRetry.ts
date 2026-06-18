import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy with automatic recovery from stale chunks after a deploy.
 *
 * When a new version is deployed, the hashed chunk filenames change. Browsers
 * with the old index.html still in memory try to fetch chunks that no longer
 * exist and the dynamic import rejects with a ChunkLoadError / "Failed to
 * fetch dynamically imported module". Without recovery the route silently
 * fails and the user only sees the new page after a manual refresh.
 *
 * Strategy:
 *  1. Try the import.
 *  2. On failure, if we haven't already retried in this session, set a
 *     sessionStorage flag and force a single full reload so the browser
 *     picks up the fresh index.html (and the new chunk hashes).
 *  3. If we've already retried once, rethrow so the ErrorBoundary handles it
 *     instead of looping reloads.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RETRY_KEY = "__lovable_chunk_retry__";
    try {
      const mod = await factory();
      sessionStorage.removeItem(RETRY_KEY);
      return mod;
    } catch (err: any) {
      const message = String(err?.message || err || "");
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch|error loading dynamically imported module|Importing a module script failed/i.test(
          message
        );

      if (!isChunkError) throw err;

      const lastRetryAt = Number(sessionStorage.getItem(RETRY_KEY) || 0);
      const alreadyRetried = Number.isFinite(lastRetryAt) && Date.now() - lastRetryAt < 10_000;
      if (!alreadyRetried) {
        sessionStorage.setItem(RETRY_KEY, String(Date.now()));
        window.location.reload();
        // Return a never-resolving promise so Suspense keeps the loader
        // visible until the reload happens.
        return new Promise(() => {}) as any;
      }
      throw err;
    }
  });
}
