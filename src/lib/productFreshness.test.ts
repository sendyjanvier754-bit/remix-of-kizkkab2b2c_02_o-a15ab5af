import { describe, it, expect } from 'vitest';
import { needsReview, daysSinceReview } from './productFreshness';

const now = new Date('2026-10-26T12:00:00Z');

describe('product review freshness', () => {
  it('flags products verified more than 30 days ago', () => {
    expect(needsReview({ reviewed_at: '2026-09-20T12:00:00Z' }, now)).toBe(true);
  });
  it('does not flag products verified exactly 30 days ago', () => {
    expect(needsReview({ reviewed_at: '2026-09-26T12:00:00Z' }, now)).toBe(false);
  });
  it('falls back to created_at when never verified', () => {
    expect(daysSinceReview({ reviewed_at: null, updated_at: null, created_at: '2026-08-27T12:00:00Z' }, now)).toBe(60);
  });
});
