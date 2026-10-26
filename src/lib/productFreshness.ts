export const REVIEW_STALE_DAYS = 30;

type Reviewable = { reviewed_at?: string | null; updated_at?: string | null; created_at?: string | null };

/** Days since the product was last verified (falls back to created_at). */
export function daysSinceReview(p: Reviewable, now: Date = new Date()): number {
  const ref = p.reviewed_at || p.created_at;
  if (!ref) return Infinity;
  return Math.floor((now.getTime() - new Date(ref).getTime()) / 86_400_000);
}

export function needsReview(p: Reviewable, now: Date = new Date()): boolean {
  return daysSinceReview(p, now) > REVIEW_STALE_DAYS;
}
