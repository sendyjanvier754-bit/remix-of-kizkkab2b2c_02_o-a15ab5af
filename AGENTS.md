# Project rules

- Routing uses TanStack Start file routes in `src/routes/`; legacy react-router imports go through `src/lib/router-compat.tsx` so old call sites keep working.
- Link previews (WhatsApp, social, Google) come from each route's `head()` rendered on the server; client-side meta changes are invisible to crawlers.
- Product share metadata is read server-side by `src/lib/product-share.functions.ts` (variant image first, then product image).
- Backend services stay as Supabase Edge Functions in the external Supabase project because their secrets live there.
- Browser-only storage (localStorage) must not be read during the first render; gate it behind `useHydrated()` to avoid hydration mismatches.
