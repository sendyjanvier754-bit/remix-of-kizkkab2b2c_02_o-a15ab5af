

## Plan: Admin Account Management + Simplified Seller Registration Flow

### Overview
Three major changes: (1) Admin module to view/manage all user accounts and change roles, (2) Simplified seller registration flow from within an authenticated user's account, (3) Onboarding progress tracking with reminder notifications.

---

### Part 1: Admin Accounts Module (`/admin/cuentas`)

**New page: `src/pages/admin/AdminAccountsPage.tsx`**
- Table listing all profiles with columns: name, email, role (from user_roles), created_at, status
- Search/filter by name, email, role
- Each row has action to change role via dropdown (user/seller/admin/sales_agent/purchasing_agent)
- Role change logic: update `user_roles` table (delete old role, insert new one)
- When upgrading to seller: auto-create store + sellers record (reuse logic from `useAdminApprovals.ts`)
- When downgrading from seller: keep store but deactivate it

**New hook: `src/hooks/useAdminAccounts.ts`**
- Fetches profiles + user_roles joined
- Mutation for role change with all side effects

**Sidebar update: `src/components/admin/AdminSidebar.tsx`**
- Add "Cuentas" link to main nav items

**Route: `src/App.tsx`**
- Add `/admin/cuentas` route with AdminAccountsPage

---

### Part 2: Simplified Seller Registration from Account Module

**Current flow**: User goes to `/registro-vendedor` (standalone page) → fills long form → creates account OR sends approval request.

**New flow for authenticated users**:
- In `UserProfilePage.tsx` (or via a floating CTA), add "Convertirse en Vendedor" button
- Opens a modal with simplified steps:
  1. Store name + description (2 fields only)
  2. Confirm → creates seller role + store + sellers record immediately (no admin approval needed for self-upgrade, OR sends approval request based on config)
- After creation, redirect to `/seller/cuenta` (SellerAccountPage) to continue full store setup

**Keep `/registro-vendedor`**: Move link to Footer only (remove from login page prominence). Keep page as informational landing.

**Footer update: `src/components/layout/Footer.tsx`**
- Add "Vender en [Platform]" link pointing to `/registro-vendedor`

---

### Part 3: Seller Onboarding Progress Tracker

**Database migration**: Add `seller_onboarding_progress` table:
```sql
CREATE TABLE seller_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  steps_completed JSONB DEFAULT '{}',
  current_step TEXT DEFAULT 'store_info',
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
Steps: `store_info` → `social_media` → `address` → `payment_methods` → `complete`

**New component: `src/components/seller/SellerOnboardingBanner.tsx`**
- Sticky top banner shown when `is_complete = false`
- Shows progress bar with current step
- "Continuar configuración" button links to the appropriate step in SellerAccountPage
- Can be minimized (stored in localStorage)
- When minimized, shows a small floating indicator

**Notification on exit**: When seller navigates away from onboarding without completing:
- Insert a notification in the `notifications` table: "Completa la configuración de tu tienda"
- With `data.action_url` pointing to the right step

**Hook: `src/hooks/useSellerOnboarding.ts`**
- Tracks progress, updates steps, checks completion
- Auto-marks steps as complete when data exists (e.g., store has address → address step complete)

**Integration points**:
- `SellerAccountPage.tsx`: After saving each section, update onboarding progress
- Seller layout: Show `SellerOnboardingBanner` when incomplete

---

### Technical Details

**Files to create:**
- `src/pages/admin/AdminAccountsPage.tsx`
- `src/hooks/useAdminAccounts.ts`
- `src/components/seller/SellerOnboardingBanner.tsx`
- `src/hooks/useSellerOnboarding.ts`
- `src/components/profile/UpgradeToSellerModal.tsx`

**Files to modify:**
- `src/App.tsx` — add route
- `src/components/admin/AdminSidebar.tsx` — add nav item
- `src/components/layout/Footer.tsx` — add seller registration link
- `src/pages/UserProfilePage.tsx` — add upgrade CTA
- `src/pages/LoginPage.tsx` — simplify seller registration references

**Database migration:**
- Create `seller_onboarding_progress` table with RLS (user can read/update own row)

