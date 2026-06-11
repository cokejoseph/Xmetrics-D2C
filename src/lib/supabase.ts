import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const DEMO_MODE = !SUPABASE_URL || SUPABASE_URL === ''

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
