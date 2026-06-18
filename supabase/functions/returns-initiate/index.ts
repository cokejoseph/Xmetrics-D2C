/**
 * returns-initiate — Supabase Edge Function
 *
 * Creates a return request for a delivered order. Runs eligibility checks,
 * creates the `returns` row in PENDING_APPROVAL status, and flags suspicious
 * customers (3+ prior returns) with an exception.
 *
 * Deploy: supabase functions deploy returns-initiate
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const VALID_REASONS = ['damaged', 'wrong_item', 'changed_mind', 'defective', 'size_issue'] as const
type ReturnReason = typeof VALID_REASONS[number]

const RETURN_WINDOW_DAYS = 30
const MIN_ORDER_VALUE = 99
const FRAUD_THRESHOLD = 3

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  // User-scoped client — all queries respect RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Parse and validate input ──────────────────────────────────────────────

  let body: { order_id?: string; reason?: string; customer_comment?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { order_id, reason, customer_comment } = body

  if (!order_id) return json({ error: 'order_id is required' }, 400)
  if (!reason || !VALID_REASONS.includes(reason as ReturnReason)) {
    return json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` }, 400)
  }

  // ── Resolve brand ─────────────────────────────────────────────────────────

  const { data: memberRow } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', user.id)
    .single()

  if (!memberRow?.brand_id) return json({ error: 'No brand found for this user' }, 403)
  const brand_id = memberRow.brand_id

  // ── Fetch order ───────────────────────────────────────────────────────────

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, brand_id, customer_id, fulfillment_status, payment_method, gross_amount, discount_amount, created_at, channel, razorpay_payment_id')
    .eq('id', order_id)
    .eq('brand_id', brand_id)
    .single()

  if (orderError || !order) return json({ error: 'Order not found' }, 404)

  // ── Eligibility checks ────────────────────────────────────────────────────

  // 1. Must be DELIVERED
  if (order.fulfillment_status !== 'DELIVERED') {
    return json({
      eligible: false,
      denial_reason: `Order is not yet delivered (status: ${order.fulfillment_status}). Returns are only accepted for delivered orders.`,
    })
  }

  // 2. Return window: 30 days from created_at (proxy for delivery date)
  const daysSince = Math.floor(
    (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSince > RETURN_WINDOW_DAYS) {
    return json({
      eligible: false,
      denial_reason: `Return window expired. Returns must be initiated within ${RETURN_WINDOW_DAYS} days of delivery. This order is ${daysSince} days old.`,
    })
  }

  // 3. Minimum order value
  const orderValue = Number(order.gross_amount) - Number(order.discount_amount)
  if (orderValue < MIN_ORDER_VALUE) {
    return json({
      eligible: false,
      denial_reason: `Order value ₹${orderValue.toFixed(0)} is below the ₹${MIN_ORDER_VALUE} minimum for returns.`,
    })
  }

  // 4. No duplicate active return
  const { data: existingReturn } = await supabase
    .from('returns')
    .select('id, status')
    .eq('order_id', order_id)
    .not('status', 'in', '("AUTO_DENIED")')
    .maybeSingle()

  if (existingReturn) {
    return json({
      eligible: false,
      denial_reason: `A return already exists for this order (status: ${existingReturn.status}, ID: ${existingReturn.id}).`,
    })
  }

  // ── Fraud check: customer with >= 3 prior returns ─────────────────────────

  const { count: priorReturnCount } = await supabase
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', order.customer_id)
    .not('status', 'eq', 'AUTO_DENIED')

  const isFraudFlagged = (priorReturnCount ?? 0) >= FRAUD_THRESHOLD

  // ── Create return record ──────────────────────────────────────────────────

  const refundMethod = order.payment_method === 'COD' ? 'COD_REVERSAL' : 'RAZORPAY'

  const { data: newReturn, error: insertError } = await supabase
    .from('returns')
    .insert({
      brand_id,
      order_id,
      customer_id: order.customer_id,
      return_reason: reason,
      customer_comment: customer_comment ?? null,
      status: 'PENDING_APPROVAL',
      return_window_days: RETURN_WINDOW_DAYS,
      refund_method: refundMethod,
      refund_amount: orderValue,
    })
    .select('id, status, refund_method, refund_amount')
    .single()

  if (insertError || !newReturn) {
    console.error('returns-initiate insert error:', insertError)
    return json({ error: 'Failed to create return request', detail: insertError?.message }, 500)
  }

  // ── Order timeline ────────────────────────────────────────────────────────

  await supabase.from('order_timeline').insert({
    order_id,
    event: `Return requested — ${reason}${customer_comment ? `: "${customer_comment}"` : ''}`,
    actor: user.email ?? 'ops',
    metadata: { return_id: newReturn.id, fraud_flagged: isFraudFlagged },
  })

  // ── Fraud exception ───────────────────────────────────────────────────────

  if (isFraudFlagged) {
    await supabase.from('exceptions').insert({
      brand_id,
      order_id,
      type: 'HIGH_RTO_RISK',
      severity: 'HIGH',
      status: 'UNRESOLVED',
      title: 'High return volume — potential fraud',
      description: `Customer has ${priorReturnCount} prior returns. Manual review recommended before approving return ${newReturn.id} for order #${order.order_number}.`,
    })
  }

  return json({
    eligible: true,
    return_id: newReturn.id,
    fraud_flagged: isFraudFlagged,
    refund_method: refundMethod,
    refund_amount: orderValue,
    message: isFraudFlagged
      ? 'Return created — flagged for manual review (high return volume).'
      : 'Return request created. Awaiting ops approval.',
  })
})
