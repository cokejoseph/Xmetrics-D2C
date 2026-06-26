/**
 * oms-status-sync — Supabase Edge Function
 *
 * Inbound webhook called by the OMS when order status changes.
 * Verifies the HMAC-SHA256 signature, then updates the order's
 * fulfillment_status and shipment data in Xmetrics.
 *
 * OMS should POST to:
 *   POST /functions/v1/oms-status-sync
 *   Headers: X-Xmetrics-Signature: sha256=<hmac>
 *            X-Brand-Id: <brand_id>
 *   Body: { order_id, status, awb?, tracking_url?, shipped_timestamp? }
 *
 * No JWT required — authenticated by HMAC signature + brand_id header.
 *
 * Deploy:
 *   supabase functions deploy oms-status-sync
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-xmetrics-signature, x-brand-id',
}

async function verifyHmac(payload: string, secret: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBytes = new Uint8Array(
    signature.replace('sha256=', '').match(/.{2}/g)!.map(h => parseInt(h, 16))
  )
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
}

const OMS_STATUS_MAP: Record<string, string> = {
  'received':         'PROCESSING',
  'packing':          'PACKING',
  'packed':           'READY_TO_SHIP',
  'ready_to_ship':    'READY_TO_SHIP',
  'shipped':          'SHIPPED',
  'in_transit':       'IN_TRANSIT',
  'out_for_delivery': 'OUT_FOR_DELIVERY',
  'delivered':        'DELIVERED',
  'cancelled':        'CANCELLED',
  'rto':              'RTO_INITIATED',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const brandId = req.headers.get('x-brand-id')
  const incomingSignature = req.headers.get('x-xmetrics-signature')

  if (!brandId) return json({ error: 'Missing X-Brand-Id header' }, 400)

  const rawBody = await req.text()

  // Load brand settings to verify HMAC
  const { data: brand } = await supabase
    .from('brands')
    .select('settings')
    .eq('id', brandId)
    .single()

  if (!brand) return json({ error: 'Brand not found' }, 404)

  const settings = (brand.settings ?? {}) as {
    oms_webhook_secret?: string
    oms_webhook_enabled?: boolean
  }

  // Verify signature — MANDATORY. A status push with no signature (or for a
  // brand that hasn't configured a secret) is untrusted and must be rejected,
  // otherwise anyone who knows a brand_id + order number could forge shipment
  // status. Fail closed.
  if (!settings.oms_webhook_secret) {
    return json({ error: 'OMS webhook secret not configured for this brand' }, 401)
  }
  if (!incomingSignature) {
    return json({ error: 'Missing X-Xmetrics-Signature header' }, 401)
  }
  const valid = await verifyHmac(rawBody, settings.oms_webhook_secret, incomingSignature)
  if (!valid) return json({ error: 'Invalid signature' }, 401)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { order_id: orderNumber, status, awb, tracking_url, shipped_timestamp, oms_order_id } = body as {
    order_id: string
    status: string
    awb?: string
    tracking_url?: string
    shipped_timestamp?: string
    oms_order_id?: string
  }

  if (!orderNumber || !status) return json({ error: 'order_id and status required' }, 400)

  // Look up the order by order_number (or xmetrics_internal_id)
  const { data: order } = await supabase
    .from('orders')
    .select('id, brand_id, order_number, fulfillment_status')
    .eq('brand_id', brandId)
    .eq('order_number', orderNumber)
    .single()

  if (!order) return json({ error: `Order ${orderNumber} not found for this brand` }, 404)

  const newFulfillmentStatus = OMS_STATUS_MAP[status.toLowerCase()] ?? null

  // Update order fulfillment status
  const orderUpdates: Record<string, unknown> = {}
  if (newFulfillmentStatus) orderUpdates.fulfillment_status = newFulfillmentStatus
  if (oms_order_id) orderUpdates.oms_order_id = oms_order_id

  if (Object.keys(orderUpdates).length > 0) {
    await supabase.from('orders').update(orderUpdates).eq('id', order.id)
  }

  // Upsert shipment record if AWB provided
  if (awb) {
    await supabase.from('shipments').upsert({
      brand_id: brandId,
      order_id: order.id,
      courier: 'OMS',
      awb_number: awb,
      tracking_number: awb,
      status: newFulfillmentStatus === 'DELIVERED' ? 'DELIVERED'
        : newFulfillmentStatus === 'RTO_INITIATED' ? 'RTO_INITIATED'
        : newFulfillmentStatus === 'IN_TRANSIT' ? 'IN_TRANSIT'
        : 'IN_TRANSIT',
      delivered_at: newFulfillmentStatus === 'DELIVERED' ? (shipped_timestamp ?? new Date().toISOString()) : null,
    }, { onConflict: 'order_id,awb_number' })
  }

  // Add timeline event
  await supabase.from('order_timeline').insert({
    order_id: order.id,
    event: `OMS status update: ${status}`,
    actor: 'OMS',
    metadata: { status, awb: awb ?? null, tracking_url: tracking_url ?? null },
  })

  return json({ ok: true, order_number: orderNumber, new_status: newFulfillmentStatus ?? status })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
