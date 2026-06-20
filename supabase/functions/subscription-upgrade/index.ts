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

const PLAN_RANK: Record<string, number> = { STARTER: 1, GROWTH: 2, SCALE: 3, ENTERPRISE: 4 }

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

    const { brand_id, new_plan_type } = await req.json()
    if (!brand_id || !new_plan_type) return json({ error: 'brand_id and new_plan_type required' }, 400)

    const svc = createClient(supabaseUrl, serviceKey)

    // ── Verify OWNER/ADMIN ───────────────────────────────────────────────────
    const { data: membership } = await svc
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .single()

    if (!membership) return json({ error: 'Forbidden — must be OWNER or ADMIN' }, 403)

    // ── Fetch current subscription ───────────────────────────────────────────
    const { data: currentSub } = await svc
      .from('subscriptions')
      .select('*')
      .eq('brand_id', brand_id)
      .single()

    if (!currentSub) return json({ error: 'No active subscription found' }, 404)
    if (currentSub.status === 'CANCELLED') return json({ error: 'Cannot upgrade a cancelled subscription' }, 400)

    // ── Validate plan direction ──────────────────────────────────────────────
    const currentRank = PLAN_RANK[currentSub.plan_type] ?? 0
    const newRank     = PLAN_RANK[new_plan_type] ?? 0

    if (newRank <= currentRank) {
      return json({ error: 'Downgrade not supported mid-cycle. Cancel and resubscribe at a lower plan.' }, 400)
    }

    // ── Fetch new plan config ────────────────────────────────────────────────
    const { data: newPlan } = await svc
      .from('plan_config')
      .select('*')
      .eq('plan_type', new_plan_type)
      .eq('is_active', true)
      .single()

    if (!newPlan) return json({ error: 'Invalid plan' }, 400)
    if (newPlan.amount_paise === 0) {
      return json({ error: 'Enterprise plan requires manual setup. Contact sales@xmetrics.in' }, 400)
    }

    // ── Calculate pro-rata for remaining cycle ───────────────────────────────
    const today        = new Date()
    const renewalDate  = currentSub.next_renewal_date ? new Date(currentSub.next_renewal_date) : null
    const daysLeft     = renewalDate ? Math.max(0, Math.ceil((renewalDate.getTime() - today.getTime()) / 86400000)) : 0
    const dailyOldRate = currentSub.plan_amount_paise / 30
    const dailyNewRate = newPlan.amount_paise / 30
    const proRata      = Math.round((dailyNewRate - dailyOldRate) * daysLeft)

    // ── Update subscription to new plan ──────────────────────────────────────
    const { error: updateErr } = await svc
      .from('subscriptions')
      .update({
        plan_type:           new_plan_type,
        plan_amount_paise:   newPlan.amount_paise,
        max_orders_per_month: newPlan.max_orders,
        max_team_members:    newPlan.max_team_members,
        max_integrations:    newPlan.max_integrations,
        feature_flags:       newPlan.features,
        status:              'ACTIVE',
        status_updated_at:   today.toISOString(),
        orders_this_month:   0,
      })
      .eq('id', currentSub.id)

    if (updateErr) {
      console.error('subscription upgrade error:', updateErr)
      return json({ error: 'Failed to update subscription' }, 500)
    }

    // ── History event ────────────────────────────────────────────────────────
    await svc.from('subscription_history').insert({
      subscription_id: currentSub.id,
      event:           'PLAN_UPGRADED',
      old_status:      currentSub.plan_type,
      new_status:      new_plan_type,
      metadata: {
        from_plan:    currentSub.plan_type,
        to_plan:      new_plan_type,
        pro_rata_paise: proRata,
        days_left:    daysLeft,
      },
    })

    return json({
      success:       true,
      new_plan_type,
      pro_rata_paise: proRata,
      days_left:     daysLeft,
      message:       `Upgraded to ${newPlan.display_name}. Pro-rata charge of ₹${Math.round(proRata / 100)} applies.`,
    })
  } catch (err) {
    console.error('subscription-upgrade error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
