

## Plan: Remove separator bars between category tabs

Remove the `border-r border-[#0a3a9f]` classes from the three places in `GlobalMobileHeader.tsx` where they appear on the category buttons (the home icon button, the "Todo" button, and the individual category buttons).

### Changes

**File: `src/components/layout/GlobalMobileHeader.tsx`**
- Line 465: Remove `border-r border-[#0a3a9f]` from the home icon button class
- Line 473: Remove `border-r border-[#0a3a9f]` from the "Todo" button class
- Line 487: Remove the conditional `border-r border-[#0a3a9f]` from category buttons

