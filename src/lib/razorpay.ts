/**
 * razorpay.ts — Client-side Razorpay integration helpers for Centinal.
 *
 * Razorpay integration covers:
 *   1. Validating API credentials (test connection)
 *   2. Fetching & syncing historical payments
 *   3. Standard Checkout for subscription billing (RazorpayCheckout component)
 *
 * The actual webhook handler (payment.captured / payment.failed / refund.processed)
 * lives at: supabase/functions/webhooks-razorpay/index.ts
 *
 * Razorpay Dashboard → Settings → Webhooks → add the edge function URL
 */

import { supabase, DEMO_MODE } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RazorpayCredentials {
  key_id: string       // rzp_live_XXXX or rzp_test_XXXX
  key_secret: string   // Razorpay API secret
  webhook_secret?: string
}

export interface RazorpayTestResult {
  ok: boolean
  account_id?: string
  business_name?: string
  error?: string
}

export interface RazorpaySyncResult {
  payments_synced: number
  settlements_matched: number
  errors: string[]
}

// ─── Credential validation ──────────────────────────────────────────────────

/**
 * Test Razorpay credentials by hitting /v1/accounts endpoint.
 * Called from Settings → Integrations "Test Connection" button.
 */
export async function testRazorpayConnection(
  credentials: RazorpayCredentials
): Promise<RazorpayTestResult> {
  if (DEMO_MODE) {
    await delay(800)
    return {
      ok: true,
      account_id: 'acc_demo_zestify',
      business_name: 'Zestify Foods Pvt Ltd',
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('razorpay-proxy', {
      body: {
        action: 'test_connection',
        key_id: credentials.key_id,
        key_secret: credentials.key_secret,
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Connection failed')
    return { ok: true, account_id: data.account_id, business_name: data.business_name }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Test failed' }
  }
}

// ─── Payment sync ──────────────────────────────────────────────────────────

/**
 * Sync the last N days of Razorpay payments into the DB.
 * Matches payments to existing orders by order number (notes field).
 */
export async function syncRazorpayPayments(
  brandId: string,
  credentials: RazorpayCredentials,
  days = 30,
  onProgress?: (message: string) => void
): Promise<RazorpaySyncResult> {
  if (DEMO_MODE) {
    onProgress?.('Simulating Razorpay payment sync…')
    await delay(1000)
    onProgress?.('Matched 38 payments to orders')
    return { payments_synced: 38, settlements_matched: 28, errors: [] }
  }

  try {
    onProgress?.('Fetching payments from Razorpay…')
    const { data, error } = await supabase!.functions.invoke('razorpay-proxy', {
      body: {
        action: 'sync_payments',
        brand_id: brandId,
        key_id: credentials.key_id,
        key_secret: credentials.key_secret,
        days,
      },
    })
    if (error) throw new Error(error.message)
    onProgress?.(`Synced ${data.payments_synced} payments`)
    return {
      payments_synced: data.payments_synced ?? 0,
      settlements_matched: data.settlements_matched ?? 0,
      errors: data.errors ?? [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    return { payments_synced: 0, settlements_matched: 0, errors: [msg] }
  }
}

// ─── Full connect flow ─────────────────────────────────────────────────────

export async function connectRazorpay(
  brandId: string,
  credentials: RazorpayCredentials,
  onProgress: (message: string) => void
): Promise<{ ok: boolean; error?: string; syncResult?: RazorpaySyncResult }> {
  onProgress('Testing Razorpay credentials…')
  const testResult = await testRazorpayConnection(credentials)
  if (!testResult.ok) {
    return { ok: false, error: testResult.error ?? 'Credential test failed' }
  }
  onProgress(`✓ Connected — ${testResult.business_name ?? 'Razorpay account verified'}`)

  onProgress('Syncing payment history…')
  const syncResult = await syncRazorpayPayments(brandId, credentials, 90, onProgress)
  onProgress(`✓ Sync complete — ${syncResult.payments_synced} payments imported`)

  return { ok: true, syncResult }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Standard Checkout (subscription billing) ──────────────────────────────
// Used by RazorpayCheckout component to collect plan payments.

export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  handler: (response: RazorpayCheckoutResponse) => void
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayCheckoutInstance {
  open(): void
  on(event: string, handler: (response: unknown) => void): void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}
