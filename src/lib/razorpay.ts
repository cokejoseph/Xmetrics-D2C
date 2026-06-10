/**
 * razorpay.ts — Client-side Razorpay integration helpers for Sentinal.
 *
 * Razorpay integration covers:
 *   1. Validating API credentials (test connection)
 *   2. Fetching & syncing historical payments
 *   3. Initiating refunds for RTO orders
 *   4. Settlement reconciliation (match Razorpay settlements to orders)
 *
 * The actual webhook handler (payment.captured / payment.failed / refund.processed)
 * lives at: supabase/functions/webhooks-razorpay/index.ts
 *
 * Razorpay Dashboard → Settings → Webhooks → add the edge function URL
 */

import { supabase, DEMO_MODE } from './supabase'
import type { Payment } from '../types'

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

export interface RazorpayRefundResult {
  ok: boolean
  refund_id?: string
  amount?: number
  error?: string
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

// ─── Refunds ───────────────────────────────────────────────────────────────

/**
 * Initiate a Razorpay refund for a payment.
 * Used from the Payments page and Order Detail for RTO cases.
 */
export async function initiateRazorpayRefund(
  gatewayRef: string,       // Razorpay payment_id (pay_XXXXX)
  amountPaise: number,      // Amount in paise (₹1 = 100 paise)
  reason: 'rto_return' | 'customer_request' | 'merchant_initiated' = 'merchant_initiated'
): Promise<RazorpayRefundResult> {
  if (DEMO_MODE) {
    await delay(600)
    return {
      ok: true,
      refund_id: `rfnd_demo_${Date.now()}`,
      amount: amountPaise / 100,
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('razorpay-proxy', {
      body: {
        action: 'create_refund',
        payment_id: gatewayRef,
        amount: amountPaise,
        notes: { reason },
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Refund failed')
    return { ok: true, refund_id: data.refund_id, amount: data.amount / 100 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Refund failed' }
  }
}

// ─── Settlement reconciliation ─────────────────────────────────────────────

/**
 * Fetch Razorpay settlements and match them to Sentinal payment records.
 * Returns a list of matched payments with settlement details populated.
 */
export async function fetchRazorpaySettlements(
  credentials: RazorpayCredentials,
  brandId: string
): Promise<{ settlements: Payment[]; unmatched_count: number; error?: string }> {
  if (DEMO_MODE) {
    return { settlements: [], unmatched_count: 0 }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('razorpay-proxy', {
      body: {
        action: 'fetch_settlements',
        brand_id: brandId,
        key_id: credentials.key_id,
        key_secret: credentials.key_secret,
      },
    })
    if (error) throw new Error(error.message)
    return {
      settlements: data.settlements ?? [],
      unmatched_count: data.unmatched_count ?? 0,
    }
  } catch (e) {
    return {
      settlements: [],
      unmatched_count: 0,
      error: e instanceof Error ? e.message : 'Failed to fetch settlements',
    }
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

// ─── Utility helpers ───────────────────────────────────────────────────────

/** Convert ₹ to paise for Razorpay API calls */
export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100)

/** Convert paise to ₹ for display */
export const paiseToRupees = (paise: number) => paise / 100

/** Format a Razorpay payment ID for display */
export const formatPaymentId = (id: string) =>
  id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
