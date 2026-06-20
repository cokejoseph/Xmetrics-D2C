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

    const supabaseUrl   = Deno.env.get('SUPABASE_URL')!
    const anonKey       = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const keyId         = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret     = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keyId || !keySecret) return json({ error: 'Razorpay credentials not configured' }, 500)

    // ── Authenticate user ───────────────────────────────────────────────────
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { brand_id, plan_type } = await req.json()
    if (!brand_id || !plan_type) return json({ error: 'brand_id and plan_type are required' }, 400)

    // ── Verify user belongs to the brand ────────────────────────────────────
    const svc = createClient(supabaseUrl, serviceKey)
    const { data: membership } = await svc
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .single()

    if (!membership) return json({ error: 'Forbidden — must be OWNER or ADMIN' }, 403)

    // ── Lookup plan config ───────────────────────────────────────────────────
    const { data: plan, error: planErr } = await svc
      .from('plan_config')
      .select('*')
      .eq('plan_type', plan_type)
      .eq('is_active', true)
      .single()

    if (planErr || !plan) return json({ error: 'Invalid or inactive plan' }, 400)
    if (plan.amount_paise === 0) return json({ error: 'Enterprise plan requires manual setup. Contact sales.' }, 400)

    // ── Get brand email for Razorpay prefill ────────────────────────────────
    const { data: brand } = await svc.from('brands').select('name').eq('id', brand_id).single()

    // ── Create Razorpay order ────────────────────────────────────────────────
    const receipt = `sub_${brand_id.slice(0, 8)}_${Date.now()}`
    const rzpRes  = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Authorization':  `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        amount:   plan.amount_paise,
        currency: 'INR',
        receipt,
        notes: {
          brand_id,
          plan_type,
          brand_name: brand?.name ?? '',
          user_email: user.email ?? '',
        },
      }),
    })

    if (!rzpRes.ok) {
      const err = await rzpRes.json()
      return json({ error: err.error?.description ?? 'Razorpay order creation failed' }, rzpRes.status)
    }

    const order = await rzpRes.json()

    return json({
      order_id:    order.id,
      amount:      order.amount,
      currency:    order.currency,
      key_id:      keyId,
      plan_type,
      plan_name:   plan.display_name,
      user_email:  user.email,
      brand_name:  brand?.name ?? '',
    })
  } catch (err) {
    console.error('subscription-create-order error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
