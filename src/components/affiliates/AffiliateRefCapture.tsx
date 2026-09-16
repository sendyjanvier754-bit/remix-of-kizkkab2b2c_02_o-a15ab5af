import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AFFILIATE_REF_KEY, registerAffiliateClick } from "@/hooks/useAffiliates";

/**
 * Captures ?ref=CODE from any URL, stores it locally (30 days)
 * and registers the click for the influencer's stats.
 */
export default function AffiliateRefCapture() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (!ref) return;
    const code = ref.trim().toUpperCase();
    const stored = localStorage.getItem(AFFILIATE_REF_KEY);
    localStorage.setItem(
      AFFILIATE_REF_KEY,
      JSON.stringify({ code, savedAt: Date.now() }),
    );
    let previous: string | null = null;
    try {
      previous = stored ? JSON.parse(stored).code : null;
    } catch {
      previous = null;
    }
    if (previous !== code) {
      registerAffiliateClick(code, location.pathname);
    }
  }, [location.search, location.pathname]);

  return null;
}

/** Returns the stored affiliate code if it is still valid (30 days). */
export function getStoredAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(AFFILIATE_REF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code: string; savedAt: number };
    if (!parsed?.code) return null;
    if (Date.now() - parsed.savedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(AFFILIATE_REF_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}
