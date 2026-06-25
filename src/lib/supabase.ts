import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const DEMO_MODE = !SUPABASE_URL || SUPABASE_URL === ''

// Production safety: a demo-mode build serves client-side SEED data, never the
// customer's real records. That is correct for the public showcase deploy, but
// catastrophic if it happens because env vars failed to load on a build that was
// meant to be live. Surface it loudly (non-fatal) so a misconfigured production
// deploy is obvious in the console/monitoring instead of silently showing fake
// data to real users.
if (DEMO_MODE && import.meta.env.PROD) {
  console.warn(
    '[Xmetrics] Running in DEMO_MODE in a production build — VITE_SUPABASE_URL is not set. ' +
    'All data shown is client-side seed data. If this build was meant to connect to live ' +
    'Supabase, the environment variables did not load. Verify VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

// A configured build missing only the anon key is always a misconfiguration —
// the client cannot authenticate. Fail fast rather than throwing opaque errors
// on every query.
if (!DEMO_MODE && !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Xmetrics] VITE_SUPABASE_URL is set but VITE_SUPABASE_ANON_KEY is missing. ' +
    'Both are required to connect to Supabase.'
  )
}

export const supabase = DEMO_MODE
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)

/**
 * Call a Supabase edge function with anon-key auth (no user JWT required).
 * Used for functions deployed with verify_jwt: false — works in demo and
 * pre-login sessions where supabase.functions.invoke would be rejected.
 */
export async function callEdgeFunction(name: string, body: object) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `Edge function ${name} failed (${res.status})`)
  return json
}

/**
 * Call a JWT-protected Supabase edge function using the user's active session token.
 * Use this for subscription-* functions that verify the caller's identity server-side.
 */
export async function callAuthEdgeFunction<T = unknown>(name: string, body: object): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No active session')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Edge function ${name} failed (${res.status})`)
  return json
}
