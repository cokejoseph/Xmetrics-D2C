/**
 * shopify.ts — Client-side Shopify integration helpers for Centinal.
 *
 * Used by Settings → Integrations page and the initial sync flow.
 * All actual data writing happens via the edge function (shopify-webhooks).
 * These helpers handle:
 *   1. Validating store credentials (test connection)
 *   2. Fetching initial batch of orders on first connect
 *   3. Registering webhooks on the merchant's Shopify store
 */

import { DEMO_MODE, SUPABASE_URL, callEdgeFunction } from './supabase'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShopifyCredentials {
  shop_domain: string   // e.g. "my-store.myshopify.com"
  api_key: string       // Admin API access token (from Shopify Partner app)
  api_secret: string    // API secret key (for HMAC verification)
  webhook_secret?: string
}

export interface ShopifyTestResult {
  ok: boolean
  shop_name?: string
  plan?: string
  error?: string
}

export interface ShopifySyncResult {
  orders_imported: number
  customers_upserted: number
  products_synced: number
  errors: string[]
}

// ─── Validate credentials ──────────────────────────────────────────────────

/**
 * Test a Shopify connection by calling the /shop.json endpoint via our
 * Supabase edge function proxy (avoids CORS).
 *
 * In demo mode, simulates a successful test after 800ms.
 */
export async function testShopifyConnection(
  credentials: ShopifyCredentials
): Promise<ShopifyTestResult> {
  if (DEMO_MODE) {
    await delay(800)
    return {
      ok: true,
      shop_name: 'Demo Store',
      plan: 'basic',
    }
  }

  try {
    const data = await callEdgeFunction('shopify-proxy', {
      action: 'test_connection',
      shop_domain: credentials.shop_domain,
      api_key: credentials.api_key,
    })

    if (!data?.ok) throw new Error(data?.error ?? 'Connection failed')

    return {
      ok: true,
      shop_name: data.shop_name,
      plan: data.plan,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Connection test failed',
    }
  }
}

// ─── Register webhooks ─────────────────────────────────────────────────────

const SHOPIFY_WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'orders/cancelled',
  'products/update',
  'fulfillments/create',
  'fulfillments/update',
] as const

/**
 * Register all required webhook topics on the merchant's Shopify store.
 * The webhook endpoint points back to our edge function with the brand_id.
 */
export async function registerShopifyWebhooks(
  brandId: string,
  credentials: ShopifyCredentials
): Promise<{ registered: string[]; errors: string[] }> {
  if (DEMO_MODE) {
    return { registered: [...SHOPIFY_WEBHOOK_TOPICS], errors: [] }
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/shopify-webhooks?brand_id=${brandId}`

  const registered: string[] = []
  const errors: string[] = []

  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    try {
      const data = await callEdgeFunction('shopify-proxy', {
        action: 'register_webhook',
        shop_domain: credentials.shop_domain,
        api_key: credentials.api_key,
        topic,
        address: webhookUrl,
      })
      if (!data?.ok) {
        errors.push(`${topic}: ${data?.error ?? 'Failed'}`)
      } else {
        registered.push(topic)
      }
    } catch (e) {
      errors.push(`${topic}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return { registered, errors }
}

// ─── Initial sync ──────────────────────────────────────────────────────────

/**
 * Fetch and import the last 90 days of Shopify orders on first connect.
 * Calls the shopify-proxy edge function which talks directly to Shopify Admin API.
 *
 * In demo mode, simulates a sync with a delay.
 */
export async function syncShopifyOrders(
  brandId: string,
  credentials: ShopifyCredentials,
  onProgress?: (message: string) => void
): Promise<ShopifySyncResult> {
  if (DEMO_MODE) {
    onProgress?.('Simulating Shopify sync…')
    await delay(1200)
    onProgress?.('Imported 47 orders from Shopify')
    return {
      orders_imported: 47,
      customers_upserted: 12,
      products_synced: 8,
      errors: [],
    }
  }

  try {
    onProgress?.('Fetching orders from Shopify…')
    const data = await callEdgeFunction('shopify-proxy', {
      action: 'sync_orders',
      brand_id: brandId,
      shop_domain: credentials.shop_domain,
      api_key: credentials.api_key,
      days: 90,
    })

    onProgress?.(`Imported ${data.orders_imported} orders`)

    return {
      orders_imported: data.orders_imported ?? 0,
      customers_upserted: data.customers_upserted ?? 0,
      products_synced: data.products_synced ?? 0,
      errors: data.errors ?? [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    return {
      orders_imported: 0,
      customers_upserted: 0,
      products_synced: 0,
      errors: [msg],
    }
  }
}

// ─── Full connect flow ─────────────────────────────────────────────────────

/**
 * One-step connect: test → register webhooks → initial sync.
 * Returns progress messages via onProgress for the UI to display.
 */
export async function connectShopify(
  brandId: string,
  credentials: ShopifyCredentials,
  onProgress: (message: string) => void
): Promise<{ ok: boolean; error?: string; syncResult?: ShopifySyncResult }> {
  // 1. Test connection
  onProgress('Testing connection…')
  const testResult = await testShopifyConnection(credentials)
  if (!testResult.ok) {
    return { ok: false, error: testResult.error ?? 'Connection test failed' }
  }
  onProgress(`✓ Connected to ${testResult.shop_name ?? credentials.shop_domain}`)

  // 2. Register webhooks
  onProgress('Registering webhooks…')
  const { registered, errors: webhookErrors } = await registerShopifyWebhooks(brandId, credentials)
  if (registered.length === 0) {
    return { ok: false, error: `Webhook registration failed: ${webhookErrors.join(', ')}` }
  }
  onProgress(`✓ ${registered.length} webhook topics registered`)

  // 3. Initial sync
  onProgress('Starting initial order sync…')
  const syncResult = await syncShopifyOrders(brandId, credentials, onProgress)
  onProgress(`✓ Sync complete — ${syncResult.orders_imported} orders imported`)

  return { ok: true, syncResult }
}

// ─── Deregister webhooks ──────────────────────────────────────────────────

/**
 * Remove all Xmetrics webhook registrations from the merchant's Shopify store.
 * Called when the merchant disconnects the Shopify integration so Shopify stops
 * sending events to our endpoint.
 */
export async function deregisterShopifyWebhooks(
  brandId: string,
  credentials: Pick<ShopifyCredentials, 'shop_domain' | 'api_key'>
): Promise<{ removed: number; errors: string[] }> {
  if (DEMO_MODE) return { removed: SHOPIFY_WEBHOOK_TOPICS.length, errors: [] }

  const errors: string[] = []
  let removed = 0

  try {
    // List all webhooks on the store
    const listData = await callEdgeFunction('shopify-proxy', {
      action: 'list_webhooks',
      shop_domain: credentials.shop_domain,
      api_key: credentials.api_key,
    }) as { ok: boolean; webhooks?: { id: number; topic: string; address: string }[] }

    if (!listData.ok || !listData.webhooks) {
      return { removed: 0, errors: ['Failed to list webhooks'] }
    }

    // Delete webhooks pointing back to this project's shopify-webhooks function
    const ours = listData.webhooks.filter(w =>
      w.address.includes('/functions/v1/shopify-webhooks') &&
      w.address.includes(`brand_id=${brandId}`)
    )

    for (const webhook of ours) {
      try {
        await callEdgeFunction('shopify-proxy', {
          action: 'delete_webhook',
          shop_domain: credentials.shop_domain,
          api_key: credentials.api_key,
          webhook_id: webhook.id,
        })
        removed++
      } catch (e) {
        errors.push(`${webhook.topic}: ${e instanceof Error ? e.message : 'Delete failed'}`)
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Deregister failed')
  }

  return { removed, errors }
}

// ─── URL helpers ───────────────────────────────────────────────────────────

/** Normalise a shop domain — strip https:// and trailing slashes */
export function normaliseShopDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
    .trim()
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
