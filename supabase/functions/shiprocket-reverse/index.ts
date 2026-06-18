/**
 * shiprocket-reverse — Supabase Edge Function
 *
 * Generates a Shiprocket reverse pickup for an approved return.
 * Transitions: PENDING_APPROVAL → APPROVED → LABEL_GENERATED
 *
 * Flow:
 *   1. Validate return (must exist and belong to brand)
 *   2. Look up Shiprocket credentials from brand's integration
 *   3. POST to Shiprocket /orders/create/adhoc with is_return=1
 *   4. Auto-assign courier → get AWB
 *   5. Generate label PDF → get label URL
 *   6. Update returns row + order_timeline
 *
 * On Shiprocket failure: stores error, creates ops exception, returns 207
 * so the UI can show "generate manually in Shiprocket dashboard".
 *
 * Deploy: supabase functions deploy shiprocket-reverse
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

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external'

// Per-brand token cache: brand_id → { token, expires_at }
const tokenCache = new Map<string, { token: string; expires_at: number }>()

async function getShiprocketToken(email: string, password: string, cacheKey: string): Promise<string> {
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expires_at > Date.now()) return cached.token

  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw new Error(`Shiprocket auth failed: ${res.status}`)
  const data = await res.json() as { token?: string }
  if (!data.token) throw new Error('No token in Shiprocket auth response')

  tokenCache.set(cacheKey, { token: data.token, expires_at: Date.now() + 9 * 24 * 60 * 60 * 1000 })
  return data.token
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

  let body: { return_id?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const { return_id } = body
  if (!return_id) return json({ error: 'return_id is required' }, 400)

  // ── Fetch return + order + customer ───────────────────────────────────────

  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select(`
      *,
      orders (
        id, order_number, channel, gross_amount, discount_amount,
        payment_method, shipping_address,
        order_items ( product_name, sku, quantity, unit_price )
      ),
      customers ( name, phone, email )
    `)
    .eq('id', return_id)
    .single()

  if (retErr || !ret) return json({ error: 'Return not found' }, 404)

  if (!['PENDING_APPROVAL', 'APPROVED'].includes(ret.status)) {
    return json({ error: `Cannot generate label for return in status: ${ret.status}` }, 400)
  }

  // ── Get brand's Shiprocket credentials ────────────────────────────────────

  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('brand_id', ret.brand_id)
    .eq('platform', 'SHIPROCKET')
    .eq('status', 'CONNECTED')
    .single()

  if (!integration?.credentials?.email || !integration?.credentials?.password) {
    return json({
      error: 'Shiprocket integration not connected for this brand. Connect it in Settings → Integrations.',
    }, 400)
  }

  // ── Get brand warehouse (return-to address) ───────────────────────────────

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('*')
    .eq('brand_id', ret.brand_id)
    .eq('is_primary', true)
    .single()

  if (!warehouse) return json({ error: 'No primary warehouse configured for this brand.' }, 400)

  // ── Build Shiprocket reverse pickup payload ────────────────────────────────

  const order = ret.orders as AnyRecord
  const customer = ret.customers as AnyRecord
  const addr = (order.shipping_address ?? {}) as AnyRecord
  const items = (order.order_items ?? []) as AnyRecord[]
  const orderValue = Number(order.gross_amount) - Number(order.discount_amount)

  const srPayload = {
    order_id:   `RET-${return_id.slice(0, 8).toUpperCase()}`,
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),

    // Pickup from — customer's address
    pickup_customer_name:  addr.name     ?? customer?.name  ?? 'Customer',
    pickup_phone:          addr.phone    ?? customer?.phone ?? '',
    pickup_address:        addr.address  ?? '',
    pickup_address_2:      '',
    pickup_city:           addr.city     ?? '',
    pickup_state:          addr.state    ?? '',
    pickup_country:        'India',
    pickup_pincode:        addr.pincode  ?? '',
    pickup_email:          customer?.email ?? '',

    // Ship to — brand's warehouse
    shipping_customer_name: warehouse.contact_name,
    shipping_phone:         warehouse.contact_phone,
    shipping_address:       warehouse.address,
    shipping_address_2:     '',
    shipping_city:          warehouse.city,
    shipping_state:         warehouse.state,
    shipping_country:       'India',
    shipping_pincode:       warehouse.pincode,
    shipping_email:         '',

    order_items: items.map(i => ({
      name:          i.product_name ?? i.sku,
      sku:           i.sku,
      units:         i.quantity,
      selling_price: String(i.unit_price),
    })),

    payment_method: 'Prepaid',  // reverse logistics is always prepaid
    sub_total:      orderValue,
    total_discount: '0',
    length: 15,
    breadth: 10,
    height:  5,
    weight:  0.5,

    is_return: 1,
    comment: `Return reason: ${ret.return_reason}${ret.customer_comment ? ` — ${ret.customer_comment}` : ''}`,
  }

  // ── Call Shiprocket ───────────────────────────────────────────────────────

  let awbNumber: string | null = null
  let labelUrl:  string | null = null
  let srOrderId: string | null = null

  try {
    const token = await getShiprocketToken(
      integration.credentials.email,
      integration.credentials.password,
      ret.brand_id
    )
    const srHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

    // 1. Create reverse order
    const createRes  = await fetch(`${SR_BASE}/orders/create/adhoc`, {
      method: 'POST', headers: srHeaders, body: JSON.stringify(srPayload),
    })
    const createData = await createRes.json() as AnyRecord

    if (!createRes.ok || createData.status_code === 422) {
      throw new Error(createData.message ?? `Shiprocket order create error: ${createRes.status}`)
    }

    srOrderId = String(createData.order_id ?? '')
    const shipmentId = createData.shipment_id ? String(createData.shipment_id) : null

    // 2. Auto-assign courier → AWB
    if (shipmentId) {
      const awbRes  = await fetch(`${SR_BASE}/courier/assign/awb`, {
        method: 'POST', headers: srHeaders,
        body: JSON.stringify({ shipment_id: shipmentId }),
      })
      const awbData = await awbRes.json() as AnyRecord
      awbNumber = awbData?.response?.data?.awb_code ?? null
    }

    // 3. Generate label PDF
    if (shipmentId) {
      const labelRes  = await fetch(`${SR_BASE}/courier/generate/label`, {
        method: 'POST', headers: srHeaders,
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      })
      const labelData = await labelRes.json() as AnyRecord
      labelUrl = labelData?.label_url ?? null
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown Shiprocket error'

    await supabase.from('returns').update({
      status: 'APPROVED',
      shiprocket_error: errMsg,
    }).eq('id', return_id)

    await supabase.from('exceptions').insert({
      brand_id: ret.brand_id,
      order_id: ret.order_id,
      type: 'FAILED_WEBHOOK',
      severity: 'HIGH',
      status: 'UNRESOLVED',
      title: 'Shiprocket reverse label failed',
      description: `Return ${return_id} (order #${order.order_number}): Shiprocket label generation failed — ${errMsg}. Generate manually at app.shiprocket.in and paste AWB into the return record.`,
    })

    return json({
      ok: false,
      error: errMsg,
      manual_required: true,
      message: 'Shiprocket API failed. An exception has been created for the ops team. Generate the label manually in the Shiprocket dashboard.',
    }, 207)
  }

  // ── Persist result ────────────────────────────────────────────────────────

  const expectedDelivery = new Date()
  expectedDelivery.setDate(expectedDelivery.getDate() + 5)

  await supabase.from('returns').update({
    status:                   'LABEL_GENERATED',
    shiprocket_awb_number:    awbNumber,
    shiprocket_order_id:      srOrderId,
    shiprocket_label_url:     labelUrl,
    shiprocket_error:         null,
    expected_return_delivery: expectedDelivery.toISOString(),
  }).eq('id', return_id)

  await supabase.from('order_timeline').insert({
    order_id: ret.order_id,
    event: `Return label generated. AWB: ${awbNumber ?? 'pending assignment'}. Customer drop-off at nearest Shiprocket pickup point.`,
    actor: 'system',
    metadata: { return_id, awb: awbNumber, label_url: labelUrl },
  })

  return json({
    ok: true,
    return_id,
    awb_number:        awbNumber,
    label_url:         labelUrl,
    expected_delivery: expectedDelivery.toISOString(),
    message: awbNumber
      ? `Reverse pickup created. AWB: ${awbNumber}`
      : 'Reverse order created — AWB assignment is pending (Shiprocket assigns within minutes).',
  })
})
