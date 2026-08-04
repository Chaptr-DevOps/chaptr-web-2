import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS. Only import this in trusted server
 * contexts that have no user session to authenticate with (e.g. the Stripe
 * webhook), never in anything reachable from a client component.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
