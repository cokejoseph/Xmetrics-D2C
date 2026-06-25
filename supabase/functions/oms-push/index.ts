/**
 * oms-push — Supabase Edge Function
 *
 * Sends a ready-for-fulfillment order to the brand's configured OMS webhook.
 * Signs the payload with HMAC-SHA256 so the OMS can verify origin.
 * Logs every attempt to oms_push_log and updates orders.oms_push_status.
 *
 * Actions:
 *   push_order      — POST order payload to OMS webhook URL
 *   retry_failed    — Retry all FAILED orders for this brand
 *   get_push_log    — Return recent push log entries for an order
 *
 * Deploy:
 *   supabase functions deploy oms-push
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface OmsSettings {
  oms_webhook_url?: string
  oms_webhook_secret?: string
  oms_webhook_enabled?: boolean
  auto_push_green?: boolean
  auto_push_yellow?: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // Verify JWT
  const authHeader = req.headers.get('authorization') ?? ''
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json()
  const { action, brand_id, order_id } = body

  if (!brand_id) return json({ error: 'brand_id required' }, 400)

  // Confirm caller is a brand member
  const { data: membership } = await supabase
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return json({ error: 'Forbidden' }, 403)

  // ── get_push_log ─────────────────────────────────────────────────────────
  if (action === 'get_push_log') {
    if (!order_id) return json({ error: 'order_id required' }, 400)
    const { data, error } = await supabase
      .from('oms_push_log')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('order_id', order_id)
      .order('pushed_at', { ascending: false })
      .limit(20)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, log: data })
  }

  // Load brand settings for webhook URL + secret
  const { data: brand } = await supabase
    .from('brands')
    .select('settings, name')
    .eq('id', brand_id)
    .single()

  if (!brand) return json({ error: 'Brand not found' }, 404)

  const settings = (brand.settings ?? {}) as OmsSettings

  if (!settings.oms_webhook_url) {
    return json({ ok: false, error: 'OMS webhook URL not configured. Go to Settings → Integrations to add it.' }, 400)
  }

  if (settings.oms_webhook_enabled === false) {
    return json({ ok: false, error: 'OMS webhook is disabled in settings.' }, 400)
  }

  // ── push_order ────────────────────────────────────────────────────────────
  if (action === 'push_order') {
    if (!order_id) return json({ error: 'order_id required' }, 400)

    const { data: push_type } = body
    const pushType: 'AUTO' | 'MANUAL' = push_type === 'AUTO' ? 'AUTO' : 'MANUAL'

    // Fetch full order with items, customer, shipments
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        customer:customers(name, phone, email),
        shipments(*)
      `)
      .eq('id', order_id)
      .eq('brand_id', brand_id)
      .single()

    if (orderErr || !order) return json({ ok: false, error: 'Order not found' }, 404)

    if (order.oms_push_status === 'PUSHED') {
      return json({ ok: false, error: 'Order already pushed to OMS' })
    }

    // Determine attempt number
    const { count: prevAttempts } = await supabase
      .from('oms_push_log')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', order_id)

    const attemptNumber = (prevAttempts ?? 0) + 1

    // Build the payload
    const payload = {
      order_id: order.order_number,
      xmetrics_internal_id: order.id,
      status: 'ready_for_fulfillment',
      rto_score: order.rto_risk_score,
      rto_decision: order.routing_decision === 'AUTO_PUSHED'
        ? 'auto_approved'
        : 'manually_approved_by_founder',
      exception_resolved: order.rto_review_status === 'APPROVED',
      customer: {
        name: order.customer?.name ?? order.shipping_address?.name ?? '',
        phone: order.customer?.phone ?? order.shipping_address?.phone ?? '',
        email: order.customer?.email ?? '',
      },
      items: (order.items ?? []).map((item: {
        sku: string; product_name?: string; quantity: number; unit_price: number; cost_price?: number
      }) => ({
        sku: item.sku,
        name: item.product_name ?? item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cogs: item.cost_price ?? 0,
      })),
      shipping_address: order.shipping_address,
      payment_method: order.payment_method,
      payment_status: order.payment_status === 'PAID' ? 'paid' : 'awaiting_collection',
      channel: order.channel.toLowerCase(),
      intelligence_timestamp: new Date().toISOString(),
      xmetrics_order_url: `https://app.xmetrics.in/orders/${order.id}`,
    }

    const payloadStr = JSON.stringify(payload)

    // Sign with HMAC if secret configured
    const signature = settings.oms_webhook_secret
      ? await hmacSign(payloadStr, settings.oms_webhook_secret)
      : null

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (signature) headers['X-Xmetrics-Signature'] = `sha256=${signature}`

    // POST to OMS
    let httpStatus = 0
    let responseBody: unknown = null
    let success = false
    let errorMessage: string | null = null

    try {
      const res = await fetch(settings.oms_webhook_url, {
        method: 'POST',
        headers,
        body: payloadStr,
        signal: AbortSignal.timeout(15_000),
      })
      httpStatus = res.status
      try { responseBody = await res.json() } catch { responseBody = null }
      success = res.ok
      if (!success) errorMessage = `OMS returned HTTP ${res.status}`
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Network error'
    }

    // Log the attempt
    await supabase.from('oms_push_log').insert({
      brand_id,
      order_id,
      order_number: order.order_number,
      push_type: pushType,
      payload,
      http_status: httpStatus,
      response_body: responseBody,
      success,
      error_message: errorMessage,
      attempt_number: attemptNumber,
    })

    // Update order push status
    await supabase.from('orders').update({
      oms_push_status: success ? 'PUSHED' : 'FAILED',
      oms_pushed_at: success ? new Date().toISOString() : null,
      oms_order_id: success && responseBody && typeof responseBody === 'object'
        ? (responseBody as Record<string, string>).oms_order_id ?? null
        : null,
      oms_push_error: success ? null : errorMessage,
      routing_decision: pushType === 'AUTO' ? 'AUTO_PUSHED' : 'MANUALLY_PUSHED',
      routing_decided_at: new Date().toISOString(),
    }).eq('id', order_id)

    // Write to approval_audit_log
    await supabase.from('approval_audit_log').insert({
      brand_id,
      order_id,
      order_number: order.order_number,
      action_type: pushType === 'AUTO' ? 'AUTO_PUSHED_TO_OMS' : 'PUSHED_TO_OMS',
      actor_id: user.id,
      actor_name: membership.role,
      action_timestamp: new Date().toISOString(),
      original_rto_score: order.rto_risk_score,
      original_status: order.oms_push_status,
      new_status: success ? 'PUSHED' : 'FAILED',
      metadata: { push_type: pushType, attempt: attemptNumber, http_status: httpStatus },
    })

    if (success) {
      return json({ ok: true, order_number: order.order_number, attempt: attemptNumber })
    } else {
      return json({ ok: false, error: errorMessage, attempt: attemptNumber })
    }
  }

  // ── retry_failed ──────────────────────────────────────────────────────────
  if (action === 'retry_failed') {
    const { data: failedOrders, error: fetchErr } = await supabase
      .from('orders')
      .select('id, order_number, oms_push_status')
      .eq('brand_id', brand_id)
      .eq('oms_push_status', 'FAILED')
      .limit(50)

    if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500)
    if (!failedOrders?.length) return json({ ok: true, retried: 0, message: 'No failed pushes to retry' })

    let succeeded = 0
    let stillFailed = 0

    for (const order of failedOrders) {
      // Call push_order inline for each failed order
      const retryRes = await fetch(
        `${SUPABASE_URL}/functions/v1/oms-push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ action: 'push_order', brand_id, order_id: order.id, push_type: 'RETRY' }),
        }
      )
      const retryData = await retryRes.json() as { ok: boolean }
      if (retryData.ok) succeeded++
      else stillFailed++
    }

    return json({ ok: true, retried: failedOrders.length, succeeded, still_failed: stillFailed })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
