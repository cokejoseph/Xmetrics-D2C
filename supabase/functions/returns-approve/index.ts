/**
 * returns-approve — Supabase Edge Function
 *
 * Called by ops after physically inspecting a returned item.
 * Requires return.status = RECEIVED.
 *
 * Flow:
 *   - GOOD condition      → full refund
 *   - DAMAGED / DEFECTIVE → 50% partial refund
 *
 * Prepaid orders: POST to Razorpay /v1/payments/{id}/refund
 * COD orders:     Create exception for manual bank/UPI refund
 *
 * Also:
 *   - Increments product.inventory_count for GOOD returns
 *   - Flags DAMAGED returns for warehouse inspection
 *   - Updates order_timeline
 *
 * Deploy: supabase functions deploy returns-approve
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

const VALID_CONDITIONS = ['GOOD', 'DAMAGED', 'DEFECTIVE'] as const
type ReturnCondition = typeof VALID_CONDITIONS[number]

async function issueRazorpayRefund(
  paymentId: string,
  amountPaise: number,
  notes: Record<string, string>
): Promise<{ refund_id: string } | { error: string }> {
  const auth = btoa(
    `${Deno.env.get('RAZORPAY_KEY_ID') ?? ''}:${Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''}`
  )

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, notes }),
  })

  const data = await res.json() as Record<string, unknown> & { error?: { description?: string }; id?: string }
  if (!res.ok) return { error: data?.error?.description ?? `Razorpay ${res.status}` }
  return { refund_id: data.id as string }
}

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { return_id?: string; return_condition?: string; notes?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const { return_id, return_condition, notes } = body

  if (!return_id) return json({ error: 'return_id is required' }, 400)
  if (!return_condition || !VALID_CONDITIONS.includes(return_condition as ReturnCondition)) {
    return json({ error: `return_condition must be one of: ${VALID_CONDITIONS.join(', ')}` }, 400)
  }

  // ── Fetch return + order ───────────────────────────────────────────────────

  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select(`
      *,
      orders (
        id, order_number, brand_id, customer_id, channel,
        payment_method, gross_amount, discount_amount, razorpay_payment_id,
        order_items ( product_id, quantity )
      ),
      customers ( name, phone, email )
    `)
    .eq('id', return_id)
    .single()

  if (retErr || !ret) return json({ error: 'Return not found' }, 404)

  if (ret.status !== 'RECEIVED') {
    return json({
      error: `Return must be in RECEIVED status to approve refund. Current: ${ret.status}.`,
    }, 400)
  }

  const order    = ret.orders   as AnyRecord
  const customer = ret.customers as AnyRecord
  const isGood   = return_condition === 'GOOD'

  // ── Calculate refund amount ───────────────────────────────────────────────

  const baseAmount   = Number(ret.refund_amount ?? (Number(order.gross_amount) - Number(order.discount_amount)))
  const refundAmount = isGood ? baseAmount : Math.round(baseAmount * 0.5 * 100) / 100

  // ── Issue refund ──────────────────────────────────────────────────────────

  let razorpayRefundId: string | null = null
  let codRefundStatus: string | null  = null

  if (ret.refund_method === 'RAZORPAY') {
    const paymentId = order.razorpay_payment_id as string | null
    if (!paymentId) {
      return json({
        error: 'No Razorpay payment ID on order. Cannot issue automated refund — process manually.',
        manual_required: true,
      }, 400)
    }

    const result = await issueRazorpayRefund(
      paymentId,
      Math.round(refundAmount * 100),
      { return_id, reason: ret.return_reason, condition: return_condition }
    )

    if ('error' in result) {
      await supabase.from('exceptions').insert({
        brand_id: ret.brand_id,
        order_id: ret.order_id,
        type:     'FAILED_PAYMENT',
        severity: 'CRITICAL',
        status:   'UNRESOLVED',
        title:    'Return refund failed',
        description: `₹${refundAmount} refund for return ${return_id} (order #${order.order_number}) failed: ${result.error}. Process manually in Razorpay dashboard.`,
      })

      return json({
        ok: false,
        error: result.error,
        message: 'Razorpay refund failed. Exception created — ops team notified.',
      }, 207)
    }

    razorpayRefundId = result.refund_id

  } else {
    // COD — manual refund via bank/UPI
    codRefundStatus = 'PENDING'

    await supabase.from('exceptions').insert({
      brand_id: ret.brand_id,
      order_id: ret.order_id,
      type:     'PENDING_SETTLEMENT',
      severity: 'MEDIUM',
      status:   'UNRESOLVED',
      title:    'COD return refund pending',
      description: `Customer ${customer?.name ?? ''} (${customer?.phone ?? ''}) returned ₹${refundAmount.toFixed(2)}. Send refund via bank transfer / UPI. Return ID: ${return_id}.`,
    })
  }

  // ── Inventory reconciliation ──────────────────────────────────────────────

  const inventoryUpdatedAt = isGood ? new Date().toISOString() : null

  if (isGood) {
    const items = (order.order_items ?? []) as AnyRecord[]
    for (const item of items) {
      if (!item.product_id) continue

      const { data: product } = await supabase
        .from('products')
        .select('inventory_count')
        .eq('id', item.product_id)
        .single()

      if (product) {
        await supabase
          .from('products')
          .update({ inventory_count: (product.inventory_count ?? 0) + item.quantity })
          .eq('id', item.product_id)
      }
    }

    // If Shopify order — flag for manual Shopify inventory sync
    if (order.channel === 'SHOPIFY') {
      await supabase.from('exceptions').insert({
        brand_id: ret.brand_id,
        order_id: ret.order_id,
        type:     'FAILED_WEBHOOK',
        severity: 'LOW',
        status:   'UNRESOLVED',
        title:    'Shopify inventory needs update',
        description: `Resellable return from Shopify order #${order.order_number}. Update Shopify inventory levels manually or via bulk sync. Return ID: ${return_id}.`,
      })
    }
  } else {
    // Damaged — flag for warehouse to dispose or write off
    await supabase.from('exceptions').insert({
      brand_id: ret.brand_id,
      order_id: ret.order_id,
      type:     'FAILED_WEBHOOK',
      severity: 'MEDIUM',
      status:   'UNRESOLVED',
      title:    `Damaged return — warehouse action needed`,
      description: `Returned item from order #${order.order_number} received in ${return_condition} condition. Dispose or write off stock. Return ID: ${return_id}.`,
    })
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  await supabase.from('returns').update({
    status:                   'REFUND_INITIATED',
    return_condition,
    return_eligible_for_resale: isGood,
    return_approved_date:     new Date().toISOString(),
    return_approved_by:       user.email ?? user.id,
    return_approval_notes:    notes ?? null,
    refund_amount:            refundAmount,
    razorpay_refund_id:       razorpayRefundId,
    cod_refund_status:        codRefundStatus,
    inventory_updated_at:     inventoryUpdatedAt,
  }).eq('id', return_id)

  const refundLabel = ret.refund_method === 'RAZORPAY'
    ? `initiated via Razorpay (${razorpayRefundId})`
    : `queued for manual COD refund`

  await supabase.from('order_timeline').insert({
    order_id: ret.order_id,
    event: `Return approved. ${isGood ? 'Full' : '50% partial'} refund of ₹${refundAmount.toFixed(2)} ${refundLabel}. Item condition: ${return_condition}.`,
    actor:    user.email ?? 'ops',
    metadata: { return_id, refund_amount: refundAmount, condition: return_condition, razorpay_refund_id: razorpayRefundId },
  })

  return json({
    ok: true,
    return_id,
    refund_amount:       refundAmount,
    refund_method:       ret.refund_method,
    razorpay_refund_id:  razorpayRefundId,
    cod_refund_status:   codRefundStatus,
    inventory_restocked: isGood,
    message: ret.refund_method === 'RAZORPAY'
      ? `₹${refundAmount.toFixed(2)} refund initiated via Razorpay.`
      : `₹${refundAmount.toFixed(2)} COD refund queued — exception created for manual processing.`,
  })
})
