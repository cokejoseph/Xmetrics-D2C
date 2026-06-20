/**
 * shopify-webhooks — Supabase Edge Function
 *
 * Receives Shopify webhook POSTs, verifies HMAC-SHA256, then upserts
 * orders / customers / products into the Sentinal database.
 *
 * Supported topics:
 *   orders/create  · orders/updated  · orders/paid  · orders/cancelled
 *   products/update · fulfillments/create · fulfillments/update
 *
 * Shopify sends the header: X-Shopify-Hmac-Sha256 (base64 of HMAC-SHA256)
 * Secret is stored per-brand in integrations.credentials.webhook_secret
 *
 * Deploy:
 *   supabase functions deploy shopify-webhooks --no-verify-jwt
 *
 * Shopify webhook URL to register:
 *   https://<project>.supabase.co/functions/v1/shopify-webhooks
 *   (append ?brand_id=<uuid> so we can look up the right integration)
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types (mirror of DB columns; keep minimal) ────────────────────────────

interface ShopifyAddress {
  address1: string
  city: string
  province: string
  zip: string
  country: string
}

interface ShopifyLineItem {
  product_id: number
  variant_id: number
  title: string
  quantity: number
  price: string
  sku: string
}

interface ShopifyFulfillment {
  id: number
  status: string
  tracking_number: string | null
  tracking_company: string | null
  created_at: string
  updated_at: string
}

interface ShopifyCustomer {
  id: number
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

interface ShopifyOrder {
  id: number
  name: string           // e.g. "#1001"
  financial_status: string
  fulfillment_status: string | null
  gateway: string
  total_price: string
  total_discounts: string
  created_at: string
  line_items: ShopifyLineItem[]
  shipping_address: ShopifyAddress | null
  billing_address: ShopifyAddress | null
  customer: ShopifyCustomer | null
  fulfillments: ShopifyFulfillment[]
}

interface ShopifyProduct {
  id: number
  title: string
  vendor: string
  product_type: string
  variants: Array<{
    id: number
    title: string
    sku: string
    price: string
    inventory_quantity: number
    weight: number
  }>
}

// ─── Field mappers ─────────────────────────────────────────────────────────

function mapPaymentStatus(financialStatus: string): string {
  switch (financialStatus) {
    case 'paid': return 'PAID'
    case 'pending': return 'AWAITING_PAYMENT'
    case 'refunded':
    case 'voided': return 'FAILED'
    default: return 'PENDING'
  }
}

function mapFulfillmentStatus(fulfillmentStatus: string | null): string {
  if (!fulfillmentStatus) return 'CONFIRMED'
  switch (fulfillmentStatus) {
    // FIX 1.18: Shopify "fulfilled" means handed to courier, NOT delivered to customer.
    case 'fulfilled': return 'SHIPPED'
    case 'partial': return 'PROCESSING'
    case 'restocked': return 'CANCELLED'
    default: return 'CONFIRMED'
  }
}

function mapPaymentMethod(gateway: string): string {
  const g = gateway.toLowerCase()
  if (g.includes('cod') || g.includes('cash')) return 'COD'
  if (g.includes('upi') || g.includes('razorpay') || g.includes('paytm')) return 'UPI'
  if (g.includes('card')) return 'CARD'
  if (g.includes('netbanking') || g.includes('bank')) return 'NETBANKING'
  return 'UPI'
}

function mapShipmentStatus(fulfillmentStatus: string): string {
  switch (fulfillmentStatus) {
    // FIX 1.18: Shopify "success" means merchant fulfilled, not delivered.
    case 'success': return 'IN_TRANSIT'
    case 'pending': return 'LABEL_CREATED'
    case 'open': return 'IN_TRANSIT'
    case 'cancelled': return 'RTO_INITIATED'
    default: return 'IN_TRANSIT'
  }
}

// ─── Pincode tier helper (mirrors rto-score edge function) ─────────────────

const T1_PREFIXES = new Set(['11', '40', '56', '60', '70', '50'])
const T2_PREFIXES = new Set([
  '20', '21', '22', '23', '24', '25', '26', '28',
  '30', '31', '32', '33', '34', '38', '39',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '57', '58', '59',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '72', '73', '74', '75', '76', '77', '78', '79',
  '80', '81', '82', '83',
])

function getPincodeTier(pincode: string): 'T1' | 'T2' | 'T3' {
  const prefix = pincode.slice(0, 2)
  if (T1_PREFIXES.has(prefix)) return 'T1'
  if (T2_PREFIXES.has(prefix)) return 'T2'
  return 'T3'
}

// ─── Core handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // brand_id must be passed as a query param
  const url = new URL(req.url)
  const brandId = url.searchParams.get('brand_id')
  if (!brandId) {
    return new Response(JSON.stringify({ error: 'Missing brand_id query param' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Read raw body for HMAC verification
  const rawBody = await req.arrayBuffer()
  const bodyText = new TextDecoder().decode(rawBody)

  // ── Fetch the integration record to get webhook_secret ─────────────────
  const { data: integration, error: intErr } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('brand_id', brandId)
    .eq('platform', 'SHOPIFY')
    .single()

  if (intErr || !integration) {
    return new Response(JSON.stringify({ error: 'Shopify integration not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  const webhookSecret = integration.credentials?.webhook_secret as string | undefined
  if (webhookSecret) {
    const shopifyHmac = req.headers.get('x-shopify-hmac-sha256')
    if (!shopifyHmac) {
      return new Response(JSON.stringify({ error: 'Missing HMAC header' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    if (computed !== shopifyHmac) {
      return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const topic = req.headers.get('x-shopify-topic') ?? ''
  const payload = JSON.parse(bodyText)

  try {
    if (topic === 'orders/create' || topic === 'orders/updated' || topic === 'orders/paid') {
      await handleOrder(brandId, payload as ShopifyOrder, topic)
    } else if (topic === 'orders/cancelled') {
      await handleOrderCancelled(brandId, payload as ShopifyOrder)
    } else if (topic === 'products/update') {
      await handleProductUpdate(brandId, payload as ShopifyProduct)
    } else if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
      await handleFulfillment(brandId, payload)
    }
    // Acknowledge all other topics silently (Shopify requires 200 fast)
  } catch (e) {
    console.error(`[shopify-webhooks] Error processing ${topic}:`, e)
    // Still return 200 so Shopify doesn't retry — log the error instead
  }

  // Update last_sync_at
  await supabase
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('platform', 'SHOPIFY')

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})

// ─── Customer upsert — FIX 1.17 ───────────────────────────────────────────
// Original code set total_orders=1 on upsert then called a non-existent RPC
// to increment, resulting in total_orders=2 for every first order.
// Fix: select first, then insert (new) or update (existing) atomically.

async function upsertCustomer(
  brandId: string,
  sc: ShopifyCustomer,
  addr: ShopifyAddress | null,
  orderAmount: number
): Promise<string | null> {
  const name = [sc.first_name, sc.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
  const phone = sc.phone ?? `shopify_${sc.id}`

  const { data: existing } = await supabase
    .from('customers')
    .select('id, total_orders, total_spent')
    .eq('brand_id', brandId)
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('customers')
      .update({
        name,
        email: sc.email,
        total_orders: existing.total_orders + 1,
        total_spent: existing.total_spent + orderAmount,
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data: newCustomer } = await supabase
    .from('customers')
    .insert({
      brand_id: brandId,
      name,
      phone,
      email: sc.email,
      city: addr?.city ?? '',
      state: addr?.province ?? '',
      pincode: addr?.zip ?? '',
      address: addr ? `${addr.address1}, ${addr.city}` : null,
      total_orders: 1,
      total_spent: orderAmount,
      tags: [],
    })
    .select('id')
    .single()

  return (newCustomer?.id as string) ?? null
}

// ─── RTO scoring — FIX 1.1 ────────────────────────────────────────────────
// rto-score edge function requires user auth and can't be called from a
// service-role webhook. Inline the same algorithm here using the service client.

async function computeAndWriteRTOScore(
  brandId: string,
  orderId: string,
  paymentMethod: string,
  pincode: string,
  customerId: string | null,
  orderValue: number
): Promise<void> {
  let score = 0
  const factors: string[] = []

  if (paymentMethod === 'COD') {
    score += 40
    factors.push('COD payment (+40)')
  }

  const tier = getPincodeTier(pincode)
  if (tier === 'T3') {
    score += 20
    factors.push('T3 pincode (+20)')
  } else if (tier === 'T2') {
    score += 10
    factors.push('T2 pincode (+10)')
  }

  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_orders')
      .eq('id', customerId)
      .single()

    if (!customer || customer.total_orders <= 1) {
      score += 20
      factors.push('First-time customer (+20)')
    }

    if (customer && customer.total_orders >= 2) {
      const { data: pastOrders } = await supabase
        .from('orders')
        .select('fulfillment_status')
        .eq('customer_id', customerId)
        .eq('brand_id', brandId)

      const rtoCount = pastOrders?.filter((o: { fulfillment_status: string }) =>
        o.fulfillment_status === 'RTO_INITIATED'
      ).length ?? 0
      const totalCount = pastOrders?.length ?? 0
      if (totalCount >= 2) {
        const rtoRate = rtoCount / totalCount
        if (rtoRate >= 0.5) {
          score += 25
          factors.push(`High historical RTO rate ${Math.round(rtoRate * 100)}% (+25)`)
        } else if (rtoRate >= 0.25) {
          score += 15
          factors.push(`Moderate historical RTO rate ${Math.round(rtoRate * 100)}% (+15)`)
        }
      }
    }
  } else {
    score += 20
    factors.push('No customer record (+20)')
  }

  // Compare order value to brand AOV
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('gross_amount, discount_amount')
    .eq('brand_id', brandId)
    .eq('payment_status', 'PAID')
    .limit(100)

  if (recentOrders && recentOrders.length > 0) {
    const aov = recentOrders.reduce(
      (s: number, o: { gross_amount: number; discount_amount: number }) =>
        s + (o.gross_amount - o.discount_amount),
      0
    ) / recentOrders.length
    if (orderValue < aov * 0.5) {
      score += 10
      factors.push('Order value well below AOV (+10)')
    }
  }

  score = Math.min(100, Math.max(0, score))
  const reviewStatus = score >= 60 ? 'PENDING' : 'NOT_REQUIRED'

  await supabase
    .from('orders')
    .update({ rto_risk_score: score, rto_review_status: reviewStatus })
    .eq('id', orderId)

  // Create exception for high-risk orders
  if (score >= 60) {
    await supabase.from('exceptions').insert({
      brand_id: brandId,
      order_id: orderId,
      type: 'HIGH_RTO_RISK',
      severity: 'HIGH',
      status: 'UNRESOLVED',
      title: `High RTO Risk — Score ${score}/100`,
      description: factors.join(', '),
    })
  }
}

// ─── Order handler ─────────────────────────────────────────────────────────

async function handleOrder(brandId: string, shopifyOrder: ShopifyOrder, topic: string) {
  const shopifyRef = `shopify_${shopifyOrder.id}`
  const isCreate = topic === 'orders/create'
  const orderAmount = parseFloat(shopifyOrder.total_price)

  // Upsert customer — FIX 1.17: atomic select-then-insert/update
  let customerId: string | null = null
  if (shopifyOrder.customer) {
    const addr = shopifyOrder.shipping_address ?? shopifyOrder.billing_address
    customerId = await upsertCustomer(brandId, shopifyOrder.customer, addr, orderAmount)
  }

  const shippingAddr = shopifyOrder.shipping_address
  const shippingAddressObj = shippingAddr
    ? {
        address: shippingAddr.address1,
        city: shippingAddr.city,
        state: shippingAddr.province,
        pincode: shippingAddr.zip,
      }
    : { address: '', city: '', state: '', pincode: '' }

  // Build order payload.
  // FIX 1.16: Only set rto_risk_score/rto_review_status on create.
  // On updates, exclude these fields so existing scores are never overwritten.
  const orderPayload: Record<string, unknown> = {
    brand_id: brandId,
    customer_id: customerId,
    order_number: shopifyOrder.name,
    channel: 'SHOPIFY',
    gross_amount: orderAmount,
    discount_amount: parseFloat(shopifyOrder.total_discounts || '0'),
    payment_status: mapPaymentStatus(shopifyOrder.financial_status),
    payment_method: mapPaymentMethod(shopifyOrder.gateway),
    fulfillment_status: mapFulfillmentStatus(shopifyOrder.fulfillment_status),
    shipping_address: shippingAddressObj,
    warehouse_id: null,
    notes: `Shopify Order ID: ${shopifyOrder.id}`,
    external_ref: shopifyRef,
    created_at: shopifyOrder.created_at,
  }

  if (isCreate) {
    // Set placeholder score on create; computeAndWriteRTOScore will overwrite it below
    orderPayload.rto_risk_score = 0
    orderPayload.rto_review_status = 'PENDING'
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .upsert(orderPayload, { onConflict: 'brand_id,order_number' })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('[shopify-webhooks] order upsert failed:', orderErr)
    return
  }

  const orderId = order.id as string

  // Upsert order items
  if (shopifyOrder.line_items?.length) {
    const items = shopifyOrder.line_items.map(li => ({
      order_id: orderId,
      product_id: null,
      sku: li.sku || `shopify_${li.variant_id}`,
      quantity: li.quantity,
      unit_price: parseFloat(li.price),
    }))
    await supabase
      .from('order_items')
      .upsert(items, { onConflict: 'order_id,sku' })
  }

  // Upsert fulfillments as shipments
  if (shopifyOrder.fulfillments?.length) {
    for (const f of shopifyOrder.fulfillments) {
      if (!f.tracking_number) continue
      await supabase
        .from('shipments')
        .upsert({
          brand_id: brandId,
          order_id: orderId,
          courier: f.tracking_company ?? 'Unknown',
          awb_number: f.tracking_number,
          tracking_number: f.tracking_number,
          status: mapShipmentStatus(f.status),
          pickup_scheduled_at: null,
          delivered_at: null,
          created_at: f.created_at,
        }, { onConflict: 'order_id,awb_number' })
    }
  }

  // Timeline event
  const eventLabel = topic === 'orders/create' ? 'Order received from Shopify'
    : topic === 'orders/paid' ? 'Payment confirmed via Shopify'
    : 'Order updated from Shopify'
  await supabase.from('order_timeline').insert({
    order_id: orderId,
    event: eventLabel,
    actor: 'shopify',
    metadata: { shopify_id: shopifyOrder.id, topic },
  })

  // FIX 1.21: Create a payment ledger row for new paid orders
  if (isCreate) {
    await supabase.from('payments').insert({
      brand_id: brandId,
      order_id: orderId,
      amount: orderAmount,
      method: mapPaymentMethod(shopifyOrder.gateway),
      status: shopifyOrder.financial_status === 'paid' ? 'PAID' : 'PENDING',
      gateway_ref: `shopify_${shopifyOrder.id}`,
      gateway_fee: null,
      settlement_amount: null,
      settled_at: null,
    })

    // FIX 1.1: Compute and write real RTO score for new orders
    await computeAndWriteRTOScore(
      brandId,
      orderId,
      mapPaymentMethod(shopifyOrder.gateway),
      shippingAddressObj.pincode,
      customerId,
      orderAmount
    )
  }
}

async function handleOrderCancelled(brandId: string, shopifyOrder: ShopifyOrder) {
  await supabase
    .from('orders')
    .update({ fulfillment_status: 'CANCELLED', payment_status: 'FAILED' })
    .eq('brand_id', brandId)
    .eq('order_number', shopifyOrder.name)
}

// ─── Product handler ───────────────────────────────────────────────────────

async function handleProductUpdate(brandId: string, shopifyProduct: ShopifyProduct) {
  for (const variant of shopifyProduct.variants) {
    const sku = variant.sku || `shopify_${variant.id}`
    await supabase
      .from('products')
      .upsert({
        brand_id: brandId,
        name: shopifyProduct.variants.length === 1
          ? shopifyProduct.title
          : `${shopifyProduct.title} — ${variant.title}`,
        sku,
        category: mapProductCategory(shopifyProduct.product_type),
        selling_price: parseFloat(variant.price),
        cost_price: 0,  // Shopify doesn't expose cost price via webhooks
        inventory_count: variant.inventory_quantity,
        reorder_threshold: 5,
        weight_grams: Math.round(variant.weight * 1000),
        is_active: true,
      }, { onConflict: 'brand_id,sku' })
  }
}

function mapProductCategory(productType: string): string {
  const t = productType.toLowerCase()
  if (t.includes('skin') || t.includes('beauty') || t.includes('care')) return 'Skincare'
  if (t.includes('supplement') || t.includes('health') || t.includes('vitamin')) return 'Supplements'
  if (t.includes('food') || t.includes('beverage') || t.includes('drink') || t.includes('snack')) return 'Food & Beverage'
  if (t.includes('fashion') || t.includes('cloth') || t.includes('apparel')) return 'Fashion'
  if (t.includes('electronic') || t.includes('gadget') || t.includes('tech')) return 'Electronics'
  if (t.includes('home') || t.includes('kitchen') || t.includes('décor')) return 'Home & Kitchen'
  return 'Other'
}

// ─── Fulfillment handler ───────────────────────────────────────────────────

async function handleFulfillment(brandId: string, payload: {
  order_id: number
  id: number
  tracking_number: string | null
  tracking_company: string | null
  status: string
  created_at: string
  updated_at: string
}) {
  if (!payload.tracking_number) return

  // Find the order by external_ref (set during order upsert)
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('brand_id', brandId)
    .eq('external_ref', `shopify_${payload.order_id}`)
    .single()

  if (!order) return

  await supabase
    .from('shipments')
    .upsert({
      brand_id: brandId,
      order_id: order.id,
      courier: payload.tracking_company ?? 'Unknown',
      awb_number: payload.tracking_number,
      tracking_number: payload.tracking_number,
      status: mapShipmentStatus(payload.status),
      pickup_scheduled_at: null,
      delivered_at: null,
      created_at: payload.created_at,
    }, { onConflict: 'order_id,awb_number' })

  // FIX 1.18: Shopify "success" = merchant fulfilled = SHIPPED, not DELIVERED
  const orderStatus = payload.status === 'success' ? 'SHIPPED' : 'IN_TRANSIT'
  await supabase
    .from('orders')
    .update({ fulfillment_status: orderStatus })
    .eq('id', order.id)
}
