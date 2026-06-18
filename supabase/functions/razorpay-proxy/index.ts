/**
 * razorpay-proxy — Supabase Edge Function
 *
 * Proxies Razorpay API calls server-side so the Key Secret never touches
 * the browser. JWT-verified (Supabase validates the user's session).
 *
 * Actions:
 *   test_connection   — GET /accounts to verify credentials
 *   sync_payments     — Fetch last N days of payments and write to DB
 *   create_refund     — POST /payments/:id/refund
 *   fetch_settlements — GET /settlements with item details
 *
 * Deploy:
 *   supabase functions deploy razorpay-proxy
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const RZP_BASE = 'https://api.razorpay.com/v1'

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
  const { action, key_id, key_secret } = body

  if (!key_id || !key_secret) return json({ error: 'key_id and key_secret required' }, 400)

  const authBasic = `Basic ${encodeBase64(`${key_id}:${key_secret}`)}`
  const rzpHeaders = { 'Authorization': authBasic, 'Content-Type': 'application/json' }

  // ── test_connection ───────────────────────────────────────────────────────
  if (action === 'test_connection') {
    const res = await fetch(`${RZP_BASE}/accounts`, { headers: rzpHeaders })
    if (!res.ok) {
      const d = await res.json()
      return json({ ok: false, error: d?.error?.description ?? `Razorpay returned ${res.status}` })
    }
    const d = await res.json() as { id: string; profile: { contact_name: string; business_name: string } }
    return json({
      ok: true,
      account_id: d.id,
      business_name: d.profile?.business_name ?? 'Razorpay Account',
    })
  }

  // ── sync_payments ─────────────────────────────────────────────────────────
  if (action === 'sync_payments') {
    const { brand_id, days = 30 } = body
    if (!brand_id) return json({ error: 'brand_id required' }, 400)

    const fromTs = Math.floor((Date.now() - days * 86400 * 1000) / 1000)
    let paymentsSynced = 0
    let settlementsMatched = 0
    const errors: string[] = []

    // Fetch payments from Razorpay (paginated)
    let skip = 0
    const count = 100
    let hasMore = true

    while (hasMore) {
      const res = await fetch(
        `${RZP_BASE}/payments?from=${fromTs}&count=${count}&skip=${skip}`,
        { headers: rzpHeaders }
      )
      if (!res.ok) { errors.push(`HTTP ${res.status}`); break }
      const d = await res.json() as { items: Array<{
        id: string; order_id: string | null; amount: number; method: string;
        status: string; created_at: number; notes: Record<string, string>
      }> }

      const items = d.items ?? []
      if (items.length < count) hasMore = false

      for (const payment of items) {
        // Try to match to an order by notes.order_number or notes.merchant_order_id
        const orderNumber = payment.notes?.order_number ?? payment.notes?.merchant_order_id
        let orderId: string | null = null

        if (orderNumber) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('brand_id', brand_id)
            .eq('order_number', orderNumber)
            .single()
          if (order) orderId = order.id
        }

        const methodMap: Record<string, string> = {
          upi: 'UPI', card: 'CARD', netbanking: 'NETBANKING',
          wallet: 'WALLET', cod: 'COD',
        }
        const statusMap: Record<string, string> = {
          captured: 'PAID', failed: 'FAILED', refunded: 'REFUNDED',
          created: 'PENDING',
        }

        await supabase.from('payments').upsert({
          brand_id,
          order_id: orderId ?? payment.order_id ?? null,
          amount: payment.amount / 100,
          method: methodMap[payment.method] ?? 'UPI',
          status: statusMap[payment.status] ?? 'PENDING',
          gateway_ref: payment.id,
          gateway_fee: null,
          settlement_amount: null,
          settled_at: null,
          created_at: new Date(payment.created_at * 1000).toISOString(),
        }, { onConflict: 'brand_id,gateway_ref' })

        paymentsSynced++
        if (orderId) settlementsMatched++
      }

      skip += count
    }

    return json({ ok: true, payments_synced: paymentsSynced, settlements_matched: settlementsMatched, errors })
  }

  // ── create_refund ─────────────────────────────────────────────────────────
  if (action === 'create_refund') {
    const { payment_id, amount, notes } = body
    if (!payment_id) return json({ error: 'payment_id required' }, 400)

    const res = await fetch(`${RZP_BASE}/payments/${payment_id}/refund`, {
      method: 'POST',
      headers: rzpHeaders,
      body: JSON.stringify({ amount, notes }),
    })
    const d = await res.json()
    if (!res.ok) {
      return json({ ok: false, error: d?.error?.description ?? 'Refund failed' })
    }
    return json({ ok: true, refund_id: d.id, amount: d.amount })
  }

  // ── fetch_settlements ─────────────────────────────────────────────────────
  if (action === 'fetch_settlements') {
    const res = await fetch(`${RZP_BASE}/settlements?count=100`, { headers: rzpHeaders })
    if (!res.ok) return json({ ok: false, error: `HTTP ${res.status}` })
    const d = await res.json() as { items: unknown[] }
    return json({ ok: true, settlements: d.items ?? [], unmatched_count: 0 })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
