/**
 * shiprocket-proxy — Supabase Edge Function
 *
 * Proxies Shiprocket API calls server-side (avoids CORS, keeps password secret).
 * Handles JWT auth exchange (email+password → Shiprocket token) and caches
 * the token for 9 days (Shiprocket tokens expire in 10 days).
 *
 * Actions:
 *   test_connection   — POST /auth/login to get token + account info
 *   create_shipment   — POST /orders/create/adhoc (create + assign courier)
 *   track             — GET /courier/track/awb/:awb
 *   cancel_shipment   — POST /orders/cancel/shipment/awbs
 *   generate_labels   — POST /orders/print/label
 *
 * Deploy:
 *   supabase functions deploy shiprocket-proxy
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external'

// Token cache: brand_id → { token, expires_at }
const tokenCache = new Map<string, { token: string; expires_at: number }>()

async function getShiprocketToken(email: string, password: string, cacheKey: string): Promise<string | null> {
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expires_at > Date.now()) return cached.token

  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const d = await res.json() as { token?: string }
  if (!d.token) return null

  // Cache for 9 days (token is valid for 10)
  tokenCache.set(cacheKey, { token: d.token, expires_at: Date.now() + 9 * 24 * 60 * 60 * 1000 })
  return d.token
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // Verify JWT
  const authHeader = req.headers.get('authorization') ?? ''
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json()
  const { action, email, password } = body

  if (!email || !password) return json({ error: 'email and password required' }, 400)

  const cacheKey = `${user.id}:${email}`

  // ── test_connection ───────────────────────────────────────────────────────
  if (action === 'test_connection') {
    const token = await getShiprocketToken(email, password, cacheKey)
    if (!token) return json({ ok: false, error: 'Invalid Shiprocket credentials' })

    const res = await fetch(`${SR_BASE}/company`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return json({ ok: false, error: `Shiprocket returned ${res.status}` })
    const d = await res.json() as { company_name?: string }
    return json({ ok: true, company_name: d.company_name ?? 'Shiprocket Account', email })
  }

  // ── track ─────────────────────────────────────────────────────────────────
  if (action === 'track') {
    const { awb } = body
    if (!awb) return json({ error: 'awb required' }, 400)

    const token = await getShiprocketToken(email, password, cacheKey)
    if (!token) return json({ ok: false, error: 'Auth failed' })

    const res = await fetch(`${SR_BASE}/courier/track/awb/${awb}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return json({ ok: false, error: `HTTP ${res.status}` })
    const d = await res.json() as {
      tracking_data?: {
        track_status: number
        current_status: string
        delivered_date?: string
        etd?: string
        shipment_track_activities?: Array<{
          date: string; activity: string; location: string
        }>
      }
    }
    const td = d.tracking_data
    return json({
      ok: true,
      current_status: td?.current_status,
      etd: td?.etd,
      activities: td?.shipment_track_activities ?? [],
    })
  }

  // ── create_shipment ───────────────────────────────────────────────────────
  if (action === 'create_shipment') {
    const { shipment } = body
    if (!shipment) return json({ error: 'shipment payload required' }, 400)

    const token = await getShiprocketToken(email, password, cacheKey)
    if (!token) return json({ ok: false, error: 'Auth failed' })

    // Step 1: Create the order
    const createRes = await fetch(`${SR_BASE}/orders/create/adhoc`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: shipment.order_number,
        order_date: new Date().toISOString().split('T')[0],
        channel_id: shipment.channel_id ?? '',
        billing_customer_name: shipment.billing_customer_name,
        billing_last_name: '',
        billing_address: shipment.billing_address,
        billing_city: shipment.billing_city,
        billing_pincode: shipment.billing_pincode,
        billing_state: shipment.billing_state,
        billing_country: shipment.billing_country ?? 'India',
        billing_email: 'noreply@sentinal.in',
        billing_phone: shipment.billing_phone,
        shipping_is_billing: true,
        order_items: shipment.items.map((item: {
          name: string; sku: string; units: number;
          selling_price: number; weight?: number
        }) => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: item.selling_price,
          discount: 0,
          tax: 0,
          hsn: '',
        })),
        payment_method: shipment.payment_method,
        sub_total: shipment.order_total,
        length: shipment.length_cm ?? 10,
        breadth: shipment.breadth_cm ?? 10,
        height: shipment.height_cm ?? 10,
        weight: shipment.weight_kg,
      }),
    })

    const createData = await createRes.json() as {
      order_id?: number; shipment_id?: number; status?: string; message?: string
    }
    if (!createRes.ok || !createData.shipment_id) {
      return json({ ok: false, error: createData.message ?? 'Order creation failed' })
    }

    // Step 2: Generate AWB
    const awbRes = await fetch(`${SR_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipment_id: [createData.shipment_id] }),
    })
    const awbData = await awbRes.json() as {
      response?: { data?: { awb_assign_status?: number; awb_code?: string; courier_name?: string } }
    }
    const awbCode = awbData.response?.data?.awb_code
    const courierName = awbData.response?.data?.courier_name ?? 'Shiprocket'

    // Step 3: Generate label
    let labelUrl: string | undefined
    if (awbCode) {
      const labelRes = await fetch(`${SR_BASE}/orders/print/label`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: [createData.shipment_id] }),
      })
      const labelData = await labelRes.json() as { label_url?: string }
      labelUrl = labelData.label_url
    }

    return json({
      ok: true,
      shipment_id: createData.shipment_id,
      awb_code: awbCode,
      courier_name: courierName,
      label_url: labelUrl,
    })
  }

  // ── cancel_shipment ───────────────────────────────────────────────────────
  if (action === 'cancel_shipment') {
    const { awbs } = body
    if (!awbs?.length) return json({ error: 'awbs array required' }, 400)

    const token = await getShiprocketToken(email, password, cacheKey)
    if (!token) return json({ ok: false, error: 'Auth failed' })

    const res = await fetch(`${SR_BASE}/orders/cancel/shipment/awbs`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ awbs }),
    })
    if (!res.ok) return json({ ok: false, error: `HTTP ${res.status}` })
    return json({ ok: true })
  }

  // ── generate_labels ───────────────────────────────────────────────────────
  if (action === 'generate_labels') {
    const { awbs } = body
    if (!awbs?.length) return json({ error: 'awbs required' }, 400)

    const token = await getShiprocketToken(email, password, cacheKey)
    if (!token) return json({ ok: false, error: 'Auth failed' })

    // Get shipment IDs from AWBs
    const trackRes = await Promise.all(awbs.map((awb: string) =>
      fetch(`${SR_BASE}/courier/track/awb/${awb}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json())
    ))

    const shipmentIds = trackRes
      .map((d: { tracking_data?: { shipment_id?: number } }) => d?.tracking_data?.shipment_id)
      .filter(Boolean)

    if (!shipmentIds.length) return json({ ok: false, error: 'Could not resolve shipment IDs' })

    const labelRes = await fetch(`${SR_BASE}/orders/print/label`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipment_id: shipmentIds }),
    })
    const labelData = await labelRes.json() as { label_url?: string }
    return json({ ok: true, label_url: labelData.label_url })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
