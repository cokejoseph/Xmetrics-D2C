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

    const { brand_id } = await req.json()
    if (!brand_id) return json({ error: 'brand_id required' }, 400)

    const svc = createClient(supabaseUrl, serviceKey)

    // ── Verify membership ────────────────────────────────────────────────────
    const { data: membership } = await svc
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) return json({ error: 'Forbidden' }, 403)

    // ── Fetch subscription ───────────────────────────────────────────────────
    const { data: sub } = await svc
      .from('subscriptions')
      .select('*')
      .eq('brand_id', brand_id)
      .single()

    if (!sub) {
      return json({ error: 'No active subscription found' }, 404)
    }

    // ── Live order count since billing_start ─────────────────────────────────
    const { count: ordersCount } = await svc
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .gte('created_at', sub.billing_start_date)

    // ── Live team member count ────────────────────────────────────────────────
    const { count: teamCount } = await svc
      .from('brand_members')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)

    // ── Live integration count ────────────────────────────────────────────────
    const { count: integCount } = await svc
      .from('integrations')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .eq('status', 'CONNECTED')

    const orders_used      = ordersCount  ?? 0
    const team_used        = teamCount    ?? 0
    const integrations_used = integCount  ?? 0
    const orders_limit     = sub.max_orders_per_month
    const team_limit       = sub.max_team_members
    const integrations_limit = sub.max_integrations

    const at_order_limit       = orders_limit  !== null && orders_used  >= orders_limit
    const at_team_limit        = team_limit    !== null && team_used    >= team_limit
    const at_integration_limit = integrations_limit !== null && integrations_used >= integrations_limit

    // ── Update cached counters on the subscription row ───────────────────────
    await svc
      .from('subscriptions')
      .update({
        orders_this_month:    orders_used,
        team_members_count:   team_used,
        integrations_connected: integrations_used,
      })
      .eq('id', sub.id)

    return json({
      plan_type:           sub.plan_type,
      status:              sub.status,
      feature_flags:       sub.feature_flags,
      billing_start_date:  sub.billing_start_date,
      next_renewal_date:   sub.next_renewal_date,
      plan_amount_paise:   sub.plan_amount_paise,

      orders_used,
      orders_limit,
      orders_pct: orders_limit ? Math.round(orders_used / orders_limit * 100) : 0,
      at_order_limit,

      team_used,
      team_limit,
      at_team_limit,

      integrations_used,
      integrations_limit,
      at_integration_limit,

      at_capacity: at_order_limit || at_team_limit,
    })
  } catch (err) {
    console.error('subscription-check-usage error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
