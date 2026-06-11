/**
 * shopify-proxy — Supabase Edge Function
 *
 * Proxies requests to the Shopify Admin API so the browser doesn't hit
 * CORS issues. Also used for webhook registration and bulk order sync.
 *
 * Actions:
 *   test_connection   — GET /shop.json
 *   register_webhook  — POST /webhooks.json
 *   sync_orders       — GET /orders.json (paginated, last N days)
 *   sync_products     — GET /products.json
 *
 * JWT is required (Supabase will verify the user's session automatically).
 *
 * Deploy:
 *   supabase functions deploy shopify-proxy
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

interface RequestBody {
  action: string
  shop_domain: string
  api_key: string
  brand_id?: string
  topic?: string
  address?: string
  days?: number
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

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  const body = await req.json() as RequestBody
  const { action, shop_domain, api_key } = body

  if (!shop_domain || !api_key) {
    return json({ error: 'shop_domain and api_key are required' }, 400)
  }

  const shopifyBase = `https://${shop_domain}/admin/api/2024-01`
  const headers = {
    'X-Shopify-Access-Token': api_key,
    'Content-Type': 'application/json',
  }

  // ── test_connection ───────────────────────────────────────────────────────
  if (action === 'test_connection') {
    const res = await fetch(`${shopifyBase}/shop.json`, { headers })
    if (!res.ok) {
      const text = await res.text()
      return json({ ok: false, error: `Shopify returned ${res.status}: ${text}` })
    }
    const { shop } = await res.json() as { shop: { name: string; plan_name: string } }
    return json({ ok: true, shop_name: shop.name, plan: shop.plan_name })
  }

  // ── register_webhook ──────────────────────────────────────────────────────
  if (action === 'register_webhook') {
    const { topic, address } = body
    if (!topic || !address) {
      return json({ error: 'topic and address required for register_webhook' }, 400)
    }
    const res = await fetch(`${shopifyBase}/webhooks.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        webhook: { topic, address, format: 'json' },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return json({ ok: false, error: text })
    }
    return json({ ok: true })
  }

  // ── sync_orders ───────────────────────────────────────────────────────────
  if (action === 'sync_orders') {
    const { brand_id, days = 90 } = body
    if (!brand_id) return json({ error: 'brand_id required for sync_orders' }, 400)

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)
    const since = sinceDate.toISOString()

    let ordersImported = 0
    let customersUpserted = 0
    const errors: string[] = []
    let pageInfo: string | null = null

    do {
      const url = pageInfo
        ? `${shopifyBase}/orders.json?limit=250&page_info=${pageInfo}`
        : `${shopifyBase}/orders.json?limit=250&created_at_min=${since}&status=any`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        errors.push(`HTTP ${res.status} fetching orders page`)
        break
      }

      const data = await res.json() as { orders: unknown[] }
      const batch = data.orders ?? []

      for (const order of batch) {
        try {
          // Route each order through the same handler logic used in the webhook
          // We POST them as fake webhook payloads to reuse the handler
          const wRes = await fetch(`${SUPABASE_URL}/functions/v1/shopify-webhooks?brand_id=${brand_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Topic': 'orders/create',
              // No HMAC header — webhook_secret check is skipped when it's absent from DB
            },
            body: JSON.stringify(order),
          })
          if (wRes.ok) ordersImported++
          else errors.push(`Order import failed: ${await wRes.text()}`)
        } catch (e) {
          errors.push(String(e))
        }
      }

      // Handle Shopify's cursor-based pagination via Link header
      const linkHeader = res.headers.get('link') ?? ''
      const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]*).*?>; rel="next"/)
      pageInfo = nextMatch ? nextMatch[1] : null
    } while (pageInfo)

    return json({ ok: true, orders_imported: ordersImported, customers_upserted: customersUpserted, errors })
  }

  // ── sync_products ─────────────────────────────────────────────────────────
  if (action === 'sync_products') {
    const { brand_id } = body
    if (!brand_id) return json({ error: 'brand_id required for sync_products' }, 400)

    const res = await fetch(`${shopifyBase}/products.json?limit=250`, { headers })
    if (!res.ok) {
      return json({ ok: false, error: `HTTP ${res.status}` })
    }
    const { products } = await res.json() as { products: unknown[] }
    let productsSynced = 0

    for (const product of products) {
      const wRes = await fetch(`${SUPABASE_URL}/functions/v1/shopify-webhooks?brand_id=${brand_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Topic': 'products/update' },
        body: JSON.stringify(product),
      })
      if (wRes.ok) productsSynced++
    }

    return json({ ok: true, products_synced: productsSynced })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
