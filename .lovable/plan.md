

## Plan: Fix "Cuenta" navigation for logged-in users

### Problem
When a logged-in user clicks "Cuenta", they hit `/cuenta` (LoginPage), which redirects them to `/` instead of `/perfil`.

### Change
**Only `src/pages/LoginPage.tsx`** — line 66: change `'/'` to `'/perfil'` for already-authenticated USER role redirect.

```typescript
// Line 65-66: Change from
} else if (role === UserRole.USER) {
  navigate('/', { replace: true });
// To
} else if (role === UserRole.USER) {
  navigate('/perfil', { replace: true });
```

The post-login redirect in `useAuth.tsx` stays as `/` (home) — no change needed there.

### Result
- **Fresh login (USER)**: → `/` (home) — unchanged
- **Already logged in, clicks "Cuenta"**: → `/perfil`

