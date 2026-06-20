import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { brand_id, cancellation_reason } = await req.json()
    if (!brand_id) return json({ error: 'brand_id required' }, 400)

    const svc = createClient(supabaseUrl, serviceKey)

    // ── Only OWNER can cancel ────────────────────────────────────────────────
    const { data: membership } = await svc
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .eq('role', 'OWNER')
      .single()

    if (!membership) return json({ error: 'Forbidden — only the account OWNER can cancel' }, 403)

    // ── Fetch current subscription ───────────────────────────────────────────
    const { data: sub } = await svc
      .from('subscriptions')
      .select('id, status, next_renewal_date, plan_type')
      .eq('brand_id', brand_id)
      .single()

    if (!sub) return json({ error: 'No subscription found' }, 404)
    if (sub.status === 'CANCELLED') return json({ error: 'Already cancelled' }, 400)

    const now = new Date().toISOString()

    // ── Update subscription status ───────────────────────────────────────────
    const { error: updateErr } = await svc
      .from('subscriptions')
      .update({
        status:              'CANCELLED',
        status_updated_at:   now,
        cancelled_at:        now,
        cancellation_reason: cancellation_reason ?? null,
        next_renewal_date:   null,
      })
      .eq('id', sub.id)

    if (updateErr) {
      console.error('subscription cancel error:', updateErr)
      return json({ error: 'Failed to cancel subscription' }, 500)
    }

    // ── History event ────────────────────────────────────────────────────────
    await svc.from('subscription_history').insert({
      subscription_id: sub.id,
      event:           'CANCELLED',
      old_status:      sub.status,
      new_status:      'CANCELLED',
      metadata: {
        reason:              cancellation_reason ?? null,
        cancelled_by:        user.email,
        was_renewal_date:    sub.next_renewal_date,
      },
    })

    return json({
      success:          true,
      effective_date:   sub.next_renewal_date ?? now.slice(0, 10),
      message:          sub.next_renewal_date
        ? `Subscription cancelled. Access continues until ${sub.next_renewal_date}. Data retained for 30 days after that.`
        : 'Subscription cancelled immediately.',
    })
  } catch (err) {
    console.error('subscription-cancel error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
