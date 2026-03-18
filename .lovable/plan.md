

## Problem: CORS headers mismatch in `process-product-images` edge function

The error "Edge Function returned a non-2xx status code" occurs because the `process-product-images` edge function has **incomplete CORS headers**. The Supabase JS client v2.99 sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`) that are not listed in the function's `Access-Control-Allow-Headers`. This causes the browser's CORS preflight (OPTIONS) request to be rejected, blocking all subsequent requests.

The edge function logs confirm this: the function boots but never processes any request (no `Processing action:` log entries appear), meaning requests are being rejected at the CORS preflight stage.

### Fix

**File: `supabase/functions/process-product-images/index.ts` (line 6)**

Update the CORS headers to match the full set required by the current Supabase client:

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

Then redeploy the edge function. Single line change, no other modifications needed.

