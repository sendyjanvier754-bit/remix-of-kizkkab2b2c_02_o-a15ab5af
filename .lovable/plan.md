

## Plan: Complete and fix category translations

### Problems found
1. **Several UI surfaces still render raw `cat.name`** (no translation hook applied):
   - `src/components/landing/CategoryGrid.tsx` (homepage round category bubbles)
   - `src/components/landing/CategoryCard.tsx` (receives `label` directly)
   - `src/pages/CategoriesPage.tsx` (root tabs, secondary, final subcategories — mobile + desktop)
   - `src/components/b2b/HeaderB2B.tsx` (category pill bar)
   - `src/components/layout/GlobalMobileHeader.tsx` (mobile category nav)
   - Subcategorías selector in `CategoryProductsPage.tsx`
2. **Translation quality is bad** in `content_translations` because the current `translate-content` edge function uses **MyMemory** (free, no context). Examples found in DB:
   - "Relojes" → EN "Orologi" (Italian) instead of "Watches"
   - "Tops" → HT "Tèt" (heads), should stay "Tops"
   - "Juguetes y juegos" → EN "Oyuncaklar ve Oyunlar" (Turkish)
   - "Hombre" → HT "Male" (English instead of "Gason")
   - HTML entities like `&amp;` not decoded
3. **New categories** are not auto-translated on creation (no trigger / hook in the admin create flow).

### Changes

**A. Apply `useTranslatedList('category', …)` everywhere categories render**
- `CategoryGrid.tsx`: wrap with `useTranslatedList`, pass translated label to `CategoryCard`.
- `CategoriesPage.tsx`: build a single translated map and replace `cat.name` / `sub.name` / `selectedRoot.name` / `selectedSecondary.name` with translated values (mobile + desktop).
- `HeaderB2B.tsx`: translate the root category pills.
- `GlobalMobileHeader.tsx`: translate category names in mobile nav.
- `CategoryProductsPage.tsx`: translate the `<option>` labels of subcategories.

**B. Replace MyMemory with Lovable AI Gateway in `supabase/functions/translate-content/index.ts`**
- Use `google/gemini-3-flash-preview` via `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Send a strong system prompt: "You are translating short e-commerce category / product / banner labels from {source} to {target}. Return ONLY the translation, no quotes, no explanations. Preserve brand names, units, and proper nouns. For Haitian Creole use natural Kreyòl Ayisyen, not English transliteration."
- Use tool-calling for structured output `{translations: {field: text}}` to translate all fields of one entity in a single call (cheaper, more consistent context).
- Decode HTML entities (`&amp;` → `&`) before saving.
- Handle 429 / 402 with graceful fallback to original text.
- Keep the existing hash + cache logic and `content_translations` upsert.

**C. Regenerate existing category translations**
- Add a one-shot script call (via the `backfill-translations` edge function, which already exists) restricted to `entity_type='category'` after the edge function is upgraded — this overwrites the bad rows because the source_text_hash still matches but the translation will be re-fetched only if missing. So we'll also clear the existing category rows first via a migration `DELETE FROM content_translations WHERE entity_type='category'` before re-running the backfill.

**D. Auto-translate on new category creation**
- Add a Postgres trigger `AFTER INSERT OR UPDATE OF name, description ON public.categories` that calls a small SECURITY DEFINER function which uses `pg_net` (already used elsewhere in the project) to invoke the `translate-content` edge function asynchronously for `en`, `fr`, `ht`. If `pg_net` is not available, fallback: call `syncEntityTranslations('category', id, {name, description})` from `src/lib/translationSync.ts` inside the admin "Create category" mutation.

### Technical notes
- The `useTranslatedList` hook is already in place and works; only call sites are missing.
- `translate-content` config keeps `verify_jwt = false` (already set).
- Lovable AI key (`LOVABLE_API_KEY`) is auto-provisioned — no user action needed.
- Migration to wipe stale category translations runs once; backfill repopulates them with high-quality output.

### Out of scope
- Manual admin UI to edit category translations (can be added later if needed).
- Re-translating products / banners / countries (same fix can be applied later by re-running the backfill for those entity types).

