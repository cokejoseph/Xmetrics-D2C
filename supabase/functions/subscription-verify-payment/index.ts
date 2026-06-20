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

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const keyId       = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret   = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keySecret) return json({ error: 'Razorpay credentials not configured' }, 500)

    // ── Auth ────────────────────────────────────────────────────────────────
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, brand_id } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !brand_id) {
      return json({ error: 'Missing required fields' }, 400)
    }

    // ── Verify HMAC signature ────────────────────────────────────────────────
    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (expected !== razorpay_signature) {
      return json({ error: 'Invalid signature — payment not verified' }, 400)
    }

    const svc = createClient(supabaseUrl, serviceKey)

    // ── Fetch order from Razorpay to get plan_type from notes ───────────────
    const rzpOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { 'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    })
    if (!rzpOrderRes.ok) return json({ error: 'Could not fetch order from Razorpay' }, 500)

    const rzpOrder    = await rzpOrderRes.json()
    const plan_type   = rzpOrder.notes?.plan_type as string
    const amount_paid = rzpOrder.amount as number

    if (!plan_type) return json({ error: 'plan_type missing from order notes' }, 400)

    // ── Lookup plan limits ───────────────────────────────────────────────────
    const { data: plan } = await svc
      .from('plan_config')
      .select('*')
      .eq('plan_type', plan_type)
      .single()

    if (!plan) return json({ error: 'Plan not found' }, 400)

    // ── Verify user is OWNER/ADMIN of the brand ──────────────────────────────
    const { data: membership } = await svc
      .from('brand_members')
      .select('email')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .single()

    if (!membership) return json({ error: 'Forbidden' }, 403)

    // ── Upsert subscription row ──────────────────────────────────────────────
    const today   = new Date()
    const renewal = new Date(today)
    renewal.setDate(renewal.getDate() + 30)

    const subRow = {
      brand_id,
      plan_type,
      status:                'ACTIVE',
      status_updated_at:     today.toISOString(),
      razorpay_order_id,
      razorpay_payment_id,
      billing_start_date:    today.toISOString().slice(0, 10),
      next_renewal_date:     renewal.toISOString().slice(0, 10),
      plan_amount_paise:     plan.amount_paise,
      paid_amount_paise:     amount_paid,
      payment_method:        'RAZORPAY',
      max_orders_per_month:  plan.max_orders,
      max_team_members:      plan.max_team_members,
      max_integrations:      plan.max_integrations,
      feature_flags:         plan.features,
      email:                 membership.email ?? user.email,
      renewal_attempt_count: 0,
      orders_this_month:     0,
    }

    const { data: sub, error: upsertErr } = await svc
      .from('subscriptions')
      .upsert(subRow, { onConflict: 'brand_id' })
      .select('id')
      .single()

    if (upsertErr) {
      console.error('subscription upsert error:', upsertErr)
      return json({ error: 'Failed to activate subscription' }, 500)
    }

    // ── Write history events ─────────────────────────────────────────────────
    await svc.from('subscription_history').insert([
      {
        subscription_id: sub.id,
        event:           'PAYMENT_SUCCESS',
        new_status:      'ACTIVE',
        razorpay_event_id: razorpay_payment_id,
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
          plan_type,
          amount_paise: amount_paid,
        },
      },
      {
        subscription_id: sub.id,
        event:           'ACTIVATED',
        old_status:      'PENDING',
        new_status:      'ACTIVE',
        metadata:        { plan_type, next_renewal_date: renewal.toISOString().slice(0, 10) },
      },
    ])

    return json({ success: true, subscription_id: sub.id, plan_type, next_renewal_date: renewal.toISOString().slice(0, 10) })
  } catch (err) {
    console.error('subscription-verify-payment error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
