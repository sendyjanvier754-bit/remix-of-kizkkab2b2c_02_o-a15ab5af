

## Issues Found

### 1. Product prices show B2B when seller is in "Vista Cliente"
**ProductCard** (line 56) and **ProductGrid** (line 37) check `user?.role` directly to determine `isB2BUser`, completely ignoring `isClientPreview`. This means even in client preview mode, B2B prices, profit badges, and MOQ info are shown.

**Affected files:**
- `src/components/landing/ProductCard.tsx` - line 56: `const isB2BUser = user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN;` -- needs to also check `!isClientPreview`
- `src/components/landing/ProductGrid.tsx` - line 37: same pattern, needs `isClientPreview` check

### 2. Vista Cliente switch button missing from SellerLayout headers
- **SellerLayout** uses `Header` without passing `showViewModeSwitch={true}` (line 44), so the toggle button does not appear on seller pages like `/seller/adquisicion-lotes`
- **SellerMobileHeader** has no view mode switch button at all
- **SellerDesktopHeader** has no view mode switch button at all

### 3. GlobalMobileHeader missing the view mode switch button
The `GlobalMobileHeader` imports `toggleViewMode` and `canToggle` but never renders a toggle button in the UI.

### 4. MarketplacePage title says "Adquisicion de Lotes" (B2B title)
The marketplace page likely shows B2B-oriented title/layout regardless of view mode.

---

## Plan

### A. Fix ProductCard to respect isClientPreview
- Import `useViewMode` in `ProductCard.tsx`
- Change `isB2BUser` to: `(user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN) && !isClientPreview`

### B. Fix ProductGrid to respect isClientPreview
- Import `useViewMode` in `ProductGrid.tsx`
- Same pattern: add `&& !isClientPreview` to `isB2BUser`

### C. Add view mode switch to SellerLayout's Header
- In `SellerLayout.tsx`, pass `showViewModeSwitch={true}` to the `Header` component (line 44)

### D. Add view mode toggle to SellerMobileHeader
- Import `useViewMode`
- Add a small toggle button (Eye/EyeOff icon) in the top action bar, similar to GlobalMobileHeader style

### E. Add view mode toggle to GlobalMobileHeader
- Render a toggle button in the top bar when `canToggle` is true (the imports already exist, just the UI is missing)

These changes ensure that when a seller activates "Vista Cliente", all pages consistently show B2C prices, B2C cart, and B2C UI -- and the toggle is accessible from every header variant including mobile.

