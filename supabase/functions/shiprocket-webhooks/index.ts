/**
 * shiprocket-webhooks — Supabase Edge Function
 *
 * Receives Shiprocket shipment tracking webhooks and updates shipment +
 * order statuses in Sentinal. Also creates exceptions for critical events
 * like RTO initiation.
 *
 * Shiprocket sends a JSON POST with an "event" field.
 * Key events handled:
 *   SHIPMENT_PICKUP_GENERATED    → status: LABEL_CREATED
 *   SHIPMENT_PICKED_UP           → status: PICKED_UP
 *   SHIPMENT_OUT_FOR_DELIVERY    → status: OUT_FOR_DELIVERY
 *   SHIPMENT_DELIVERED           → status: DELIVERED
 *   SHIPMENT_RETURNED            → status: RTO_INITIATED (creates exception)
 *   SHIPMENT_UNDELIVERED         → status: RTO_INITIATED (creates exception)
 *   NDR_RAISED                   → creates ADDRESS_ISSUE exception
 *
 * Authentication: Shiprocket signs webhooks with a token in the header
 * X-Shiprocket-Token (simple bearer token from dashboard settings).
 *
 * Deploy:
 *   supabase functions deploy shiprocket-webhooks --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Shiprocket has no reliable per-event id, so we can't dedup at the top.
// Instead make the side-effect idempotent: don't create a second UNRESOLVED
// exception of the same type for an order that already has one (a re-sent
// SHIPMENT_RETURNED / NDR_RAISED otherwise piles up duplicates).
async function ensureException(row: {
  brand_id: string; order_id: string; type: string
  severity: string; status: string; title: string; description: string
}) {
  const { data: existing } = await supabase
    .from('exceptions')
    .select('id')
    .eq('brand_id', row.brand_id)
    .eq('order_id', row.order_id)
    .eq('type', row.type)
    .eq('status', 'UNRESOLVED')
    .maybeSingle()
  if (existing) return
  await supabase.from('exceptions').insert(row)
}

// Shiprocket → Sentinal status map
const SHIPMENT_STATUS_MAP: Record<string, string> = {
  SHIPMENT_PICKUP_GENERATED: 'LABEL_CREATED',
  SHIPMENT_PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  SHIPMENT_PICKED_UP: 'PICKED_UP',
  SHIPMENT_IN_TRANSIT: 'IN_TRANSIT',
  SHIPMENT_OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  SHIPMENT_DELIVERED: 'DELIVERED',
  SHIPMENT_RETURNED: 'RTO_INITIATED',
  SHIPMENT_UNDELIVERED: 'RTO_INITIATED',
  SHIPMENT_LOST: 'LOST',
  NDR_RAISED: 'IN_TRANSIT',  // stays in transit but exception created
}

const FULFILLMENT_STATUS_MAP: Record<string, string> = {
  LABEL_CREATED: 'READY_TO_SHIP',
  PICKUP_SCHEDULED: 'READY_TO_SHIP',
  PICKED_UP: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  RTO_INITIATED: 'RTO_INITIATED',
  LOST: 'RTO_INITIATED',
}

interface ShiprocketPayload {
  event: string
  awb: string
  order_id?: string        // Shiprocket's internal order ID
  channel_order_id?: string  // The merchant's order number (our order_number)
  courier: string
  tracking_data?: {
    track_status: number
    current_status: string
    delivered_date?: string
    etd?: string
  }
  brand_id?: string        // Passed via query param or embedded in payload
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const brandIdFromQuery = url.searchParams.get('brand_id')

  let body: ShiprocketPayload
  try {
    body = await req.json() as ShiprocketPayload
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const brandId = brandIdFromQuery ?? body.brand_id

  if (!brandId) {
    return json({ error: 'brand_id required' }, 400)
  }

  // Verify token if set in integration credentials
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('brand_id', brandId)
    .eq('platform', 'SHIPROCKET')
    .single()

  // Token is MANDATORY. If it isn't configured we reject — never trust an
  // unauthenticated POST, which could otherwise spoof DELIVERED / RTO events and
  // corrupt order state. (Mirrors the Shopify HMAC requirement.)
  const webhookToken = integration?.credentials?.webhook_token as string | undefined
  if (!webhookToken) {
    return json({ error: 'Shiprocket webhook token not configured. Add it in Settings → Integrations → Shiprocket.' }, 401)
  }
  const incomingToken = req.headers.get('x-shiprocket-token')
  if (incomingToken !== webhookToken) {
    return json({ error: 'Invalid webhook token' }, 401)
  }

  const { event, awb, channel_order_id, courier } = body

  if (!awb) {
    return json({ ok: true, note: 'No AWB — skipped' })
  }

  const sentinalStatus = SHIPMENT_STATUS_MAP[event] ?? 'IN_TRANSIT'
  const fulfillmentStatus = FULFILLMENT_STATUS_MAP[sentinalStatus] ?? 'IN_TRANSIT'

  // ── Update shipment ──────────────────────────────────────────────────────
  const shipmentUpdate: Record<string, unknown> = {
    status: sentinalStatus,
    courier: courier ?? 'Shiprocket',
  }
  if (sentinalStatus === 'DELIVERED' && body.tracking_data?.delivered_date) {
    shipmentUpdate.delivered_at = body.tracking_data.delivered_date
  }

  const { data: shipment } = await supabase
    .from('shipments')
    .update(shipmentUpdate)
    .eq('brand_id', brandId)
    .eq('awb_number', awb)
    .select('order_id')
    .single()

  // If shipment not found by AWB, try to find by order number
  let orderId: string | null = shipment?.order_id ?? null
  if (!orderId && channel_order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('id')
      .eq('brand_id', brandId)
      .eq('order_number', channel_order_id)
      .single()
    if (order) orderId = order.id

    if (orderId) {
      // Upsert shipment if not found
      await supabase.from('shipments').upsert({
        brand_id: brandId,
        order_id: orderId,
        courier: courier ?? 'Shiprocket',
        awb_number: awb,
        tracking_number: awb,
        status: sentinalStatus,
        pickup_scheduled_at: null,
        delivered_at: sentinalStatus === 'DELIVERED' ? body.tracking_data?.delivered_date ?? null : null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'order_id,awb_number' })
    }
  }

  // ── Update order fulfillment status ──────────────────────────────────────
  if (orderId) {
    // Forward-only — never regress a terminal DELIVERED/RTO via an out-of-order
    // or duplicate webhook.
    await supabase.rpc('set_fulfillment_status_forward', { p_order_id: orderId, p_status: fulfillmentStatus })

    // ── Timeline event ──────────────────────────────────────────────────────
    const eventLabels: Record<string, string> = {
      SHIPMENT_PICKED_UP: 'Shipment picked up by courier',
      SHIPMENT_IN_TRANSIT: 'Shipment in transit',
      SHIPMENT_OUT_FOR_DELIVERY: 'Out for delivery',
      SHIPMENT_DELIVERED: 'Delivered to customer',
      SHIPMENT_RETURNED: 'RTO initiated — shipment returned',
      SHIPMENT_UNDELIVERED: 'Delivery failed — RTO initiated',
      NDR_RAISED: 'Non-delivery report raised — address issue',
    }
    await supabase.from('order_timeline').insert({
      order_id: orderId,
      event: eventLabels[event] ?? `Shipment update: ${event}`,
      actor: 'shiprocket',
      metadata: { event, awb, shiprocket_status: body.tracking_data?.current_status },
    })

    // ── Create exceptions for critical events ────────────────────────────────
    if (event === 'SHIPMENT_RETURNED' || event === 'SHIPMENT_UNDELIVERED') {
      await ensureException({
        brand_id: brandId,
        order_id: orderId,
        type: 'RTO_INITIATED',
        severity: 'HIGH',
        status: 'UNRESOLVED',
        title: `RTO Initiated — AWB ${awb}`,
        description: `Shipment ${awb} returned by ${courier ?? 'courier'}. Order needs reconciliation.`,
      })
    }

    if (event === 'NDR_RAISED') {
      await ensureException({
        brand_id: brandId,
        order_id: orderId,
        type: 'ADDRESS_ISSUE',
        severity: 'MEDIUM',
        status: 'UNRESOLVED',
        title: `NDR Raised — AWB ${awb}`,
        description: `Non-delivery report raised for shipment ${awb}. Verify customer address.`,
      })
    }

    if (event === 'SHIPMENT_LOST') {
      await ensureException({
        brand_id: brandId,
        order_id: orderId,
        type: 'STUCK_SHIPMENT',
        severity: 'CRITICAL',
        status: 'UNRESOLVED',
        title: `Shipment Lost — AWB ${awb}`,
        description: `Shipment ${awb} reported as lost by ${courier ?? 'courier'}. Raise claim immediately.`,
      })
    }
  }

  // Update integration sync time
  await supabase
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('platform', 'SHIPROCKET')

  return json({ ok: true, event, awb, status: sentinalStatus })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
