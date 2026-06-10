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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

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
    case 'fulfilled': return 'DELIVERED'
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
    case 'success': return 'DELIVERED'
    case 'pending': return 'LABEL_CREATED'
    case 'open': return 'IN_TRANSIT'
    case 'cancelled': return 'RTO_INITIATED'
    default: return 'IN_TRANSIT'
  }
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
    // Verify HMAC
    const shopifyHmac = req.headers.get('x-shopify-hmac-sha256')
    if (!shopifyHmac) {
      return new Response(JSON.stringify({ error: 'Missing HMAC header' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    const computed = await hmac('sha256', webhookSecret, bodyText, 'utf8', 'base64')
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

// ─── Order handler ─────────────────────────────────────────────────────────

async function handleOrder(brandId: string, shopifyOrder: ShopifyOrder, topic: string) {
  const shopifyRef = `shopify_${shopifyOrder.id}`

  // Upsert customer if present
  let customerId: string | null = null
  if (shopifyOrder.customer) {
    const sc = shopifyOrder.customer
    const name = [sc.first_name, sc.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
    const phone = sc.phone ?? `shopify_${sc.id}`
    const addr = shopifyOrder.shipping_address ?? shopifyOrder.billing_address

    const { data: customer } = await supabase
      .from('customers')
      .upsert({
        brand_id: brandId,
        name,
        phone,
        email: sc.email,
        city: addr?.city ?? '',
        state: addr?.province ?? '',
        pincode: addr?.zip ?? '',
        address: addr ? `${addr.address1}, ${addr.city}` : null,
        total_orders: 1,
        total_spent: parseFloat(shopifyOrder.total_price),
        tags: [],
      }, { onConflict: 'brand_id,phone' })
      .select('id')
      .single()

    if (customer) {
      customerId = customer.id as string
      // Increment totals
      await supabase.rpc('increment_customer_stats', {
        p_customer_id: customerId,
        p_spend: parseFloat(shopifyOrder.total_price),
      }).catch(() => null) // RPC might not exist yet — ignore gracefully
    }
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

  // Upsert the order
  const orderPayload = {
    brand_id: brandId,
    customer_id: customerId,
    order_number: shopifyOrder.name,
    channel: 'SHOPIFY',
    gross_amount: parseFloat(shopifyOrder.total_price),
    discount_amount: parseFloat(shopifyOrder.total_discounts || '0'),
    payment_status: mapPaymentStatus(shopifyOrder.financial_status),
    payment_method: mapPaymentMethod(shopifyOrder.gateway),
    fulfillment_status: mapFulfillmentStatus(shopifyOrder.fulfillment_status),
    rto_risk_score: 0,
    rto_review_status: 'PENDING',
    shipping_address: shippingAddressObj,
    warehouse_id: null,
    notes: `Shopify Order ID: ${shopifyOrder.id}`,
    external_ref: shopifyRef,
    created_at: shopifyOrder.created_at,
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
      product_id: li.product_id ? String(li.product_id) : null,
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
          delivered_at: f.status === 'success' ? f.updated_at : null,
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

  // Find the order by Shopify order ID in notes
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('brand_id', brandId)
    .ilike('notes', `%Shopify Order ID: ${payload.order_id}%`)
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
      delivered_at: payload.status === 'success' ? payload.updated_at : null,
      created_at: payload.created_at,
    }, { onConflict: 'order_id,awb_number' })

  // Update parent order status
  const orderStatus = payload.status === 'success' ? 'DELIVERED' : 'IN_TRANSIT'
  await supabase
    .from('orders')
    .update({ fulfillment_status: orderStatus })
    .eq('id', order.id)
}
