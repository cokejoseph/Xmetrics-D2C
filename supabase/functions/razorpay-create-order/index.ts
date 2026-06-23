/**
 * razorpay-create-order — Supabase Edge Function (public, no JWT required)
 *
 * Creates a Razorpay order and returns the order_id to the frontend for checkout.
 * This function is intentionally public (deployed --no-verify-jwt) because it is
 * called from the /checkout page BEFORE the user has created an account.
 *
 * Security: Server-side amount validation against plan_config prevents price
 * tampering — clients cannot pass an arbitrary amount for plan-based checkouts.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Lock CORS to the app's own origin. Razorpay webhook calls are server-to-server
// and don't need CORS, so this only affects browser preflight requests.
const SITE_URL   = Deno.env.get('SITE_URL') ?? 'https://xmetrics.in'
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173']

function corsHeaders(origin: string | null) {
  const allowed =
    origin && (origin === SITE_URL || DEV_ORIGINS.includes(origin))
      ? origin
      : SITE_URL
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  try {
    const {
      amount,
      currency = 'INR',
      receipt,
      email,
      plan,
      billing_cycle,
    } = await req.json()

    const keyId       = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret   = Deno.env.get('RAZORPAY_KEY_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!keyId || !keySecret) {
      return json({ error: 'Razorpay credentials not configured' }, 500, origin)
    }

    // ── Server-side amount validation ────────────────────────────────────────────
    // If a plan is specified, look up the canonical amount from plan_config and
    // reject any client-supplied amount that does not match. This prevents price
    // tampering on the founding/subscription checkout pages.
    let canonicalAmount: number

    if (plan) {
      const svc = createClient(supabaseUrl, serviceKey)
      const { data: planConfig } = await svc
        .from('plan_config')
        .select('amount_paise, is_active')
        .eq('plan_type', plan)
        .eq('is_active', true)
        .single()

      if (!planConfig) {
        return json({ error: 'Invalid or inactive plan' }, 400, origin)
      }

      canonicalAmount = planConfig.amount_paise as number

      if (amount !== undefined && amount !== canonicalAmount) {
        console.warn(
          `razorpay-create-order: amount mismatch — client sent ${amount}, ` +
          `plan ${plan} requires ${canonicalAmount}`
        )
        return json({ error: 'Amount does not match plan pricing' }, 400, origin)
      }
    } else {
      // Non-plan checkout (generic order payment)
      if (!amount || amount < 100) {
        return json({ error: 'Amount must be at least 100 paise (₹1)' }, 400, origin)
      }
      canonicalAmount = amount as number
    }

    // ── Create Razorpay order ────────────────────────────────────────────────────
    const auth = btoa(`${keyId}:${keySecret}`)

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization':  `Basic ${auth}`,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        amount:   canonicalAmount,
        currency,
        receipt:  receipt ?? `xm_${Date.now()}`,
        notes: {
          ...(email         ? { email }                   : {}),
          // CRITICAL: key must be `plan_type` — subscription-verify-payment reads
          // rzpOrder.notes?.plan_type to activate the subscription after payment.
          ...(plan          ? { plan_type: plan }          : {}),
          ...(billing_cycle ? { billing_cycle }            : {}),
        },
      }),
    })

    if (!rzpResponse.ok) {
      const err = await rzpResponse.json()
      return json(
        { error: err.error?.description ?? 'Razorpay order creation failed' },
        rzpResponse.status,
        origin
      )
    }

    const order = await rzpResponse.json()

    // ── Pre-create a PENDING subscription row for plan checkouts ─────────────────
    // This allows subscription-verify-payment to find the row by razorpay_order_id
    // after payment, even if the brand has not yet been created (founding flow).
    if (email && plan) {
      const svc = createClient(supabaseUrl, serviceKey)
      await svc.from('subscriptions').upsert(
        {
          email:             email.toLowerCase().trim(),
          plan_type:         plan,            // correct column name
          billing_cycle:     billing_cycle ?? 'MONTHLY',
          razorpay_order_id: order.id,
          amount:            canonicalAmount / 100,
          status:            'PENDING',
        },
        { onConflict: 'razorpay_order_id' }
      )
    }

    return json(
      { order_id: order.id, amount: order.amount, currency: order.currency },
      200,
      origin
    )
  } catch {
    return json({ error: 'Internal server error' }, 500, origin)
  }
})
