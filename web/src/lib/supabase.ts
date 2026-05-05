import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Internal dashboard — service key bypasses RLS so all buckets are readable.
// Safe client-side here: this app runs on localhost only, never deployed publicly.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (url: RequestInfo | URL, opts?: RequestInit) =>
      fetch(url, { ...opts, cache: 'no-store' }),
  },
})

// Alias so existing imports of supabaseInternal still resolve
export const supabaseInternal = supabase
