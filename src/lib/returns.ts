/**
 * returns.ts — Frontend helpers for the Return Management Engine.
 *
 * All three edge functions require a valid Supabase session JWT.
 * Demo mode returns plausible fake data so the flow is testable without
 * deploying the edge functions.
 */

import { supabase, DEMO_MODE } from './supabase'
import type { Return, ReturnReason, ReturnCondition, ReturnStatus } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InitiateReturnResult {
  eligible: boolean
  return_id?: string
  fraud_flagged?: boolean
  refund_method?: string
  refund_amount?: number
  message?: string
  denial_reason?: string
  error?: string
}

export interface ReversePickupResult {
  ok: boolean
  return_id?: string
  awb_number?: string | null
  label_url?: string | null
  expected_delivery?: string
  message?: string
  error?: string
  manual_required?: boolean
}

export interface ApproveRefundResult {
  ok: boolean
  return_id?: string
  refund_amount?: number
  refund_method?: string
  razorpay_refund_id?: string | null
  cod_refund_status?: string | null
  inventory_restocked?: boolean
  message?: string
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase client not initialised')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(error.message ?? `Edge function ${name} failed`)
  return data as T
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Initiate a return request. Creates PENDING_APPROVAL row.
 * Call from OrderDetail "Initiate Return" action.
 */
export async function initiateReturn(
  orderId: string,
  reason: ReturnReason,
  customerComment?: string
): Promise<InitiateReturnResult> {
  if (DEMO_MODE) {
    await delay(700)
    return {
      eligible:      true,
      return_id:     `ret-demo-${Date.now()}`,
      fraud_flagged: false,
      refund_method: 'RAZORPAY',
      refund_amount: 1499,
      message:       'Return request created. Awaiting ops approval. (demo)',
    }
  }

  return invokeFunction<InitiateReturnResult>('returns-initiate', {
    order_id:         orderId,
    reason,
    customer_comment: customerComment ?? null,
  })
}

/**
 * Generate Shiprocket reverse pickup label. Transitions:
 *   PENDING_APPROVAL / APPROVED → LABEL_GENERATED
 * Call after ops reviews and approves the return.
 */
export async function generateReturnLabel(returnId: string): Promise<ReversePickupResult> {
  if (DEMO_MODE) {
    await delay(1200)
    return {
      ok:                true,
      return_id:         returnId,
      awb_number:        `SR${Date.now()}`.slice(0, 14),
      label_url:         '#',
      expected_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      message:           'Reverse pickup created. (demo)',
    }
  }

  return invokeFunction<ReversePickupResult>('shiprocket-reverse', { return_id: returnId })
}

/**
 * Approve refund after physical item inspection.
 * Requires return.status = RECEIVED.
 * Call from OrderDetail / Returns page "Approve Refund" action.
 */
export async function approveReturnRefund(
  returnId: string,
  condition: ReturnCondition,
  notes?: string
): Promise<ApproveRefundResult> {
  if (DEMO_MODE) {
    await delay(900)
    const isGood = condition === 'GOOD'
    const amount = isGood ? 1499 : 749.5
    return {
      ok:                  true,
      return_id:           returnId,
      refund_amount:       amount,
      refund_method:       'RAZORPAY',
      razorpay_refund_id:  `rfnd_demo_${Date.now()}`,
      inventory_restocked: isGood,
      message:             `₹${amount} refund initiated. (demo)`,
    }
  }

  return invokeFunction<ApproveRefundResult>('returns-approve', {
    return_id:        returnId,
    return_condition: condition,
    notes:            notes ?? null,
  })
}

/**
 * Fetch all returns for a brand (used in Returns list page / OrderDetail).
 */
export async function fetchReturns(brandId: string): Promise<Return[]> {
  if (DEMO_MODE) return []
  if (!supabase) return []

  const { data, error } = await supabase
    .from('returns')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) { if (import.meta.env.DEV) console.error('fetchReturns:', error); return [] }
  return (data ?? []) as Return[]
}

/**
 * Fetch a single return with order + customer relations.
 */
export async function fetchReturn(returnId: string): Promise<Return | null> {
  if (DEMO_MODE) return null
  if (!supabase) return null

  const { data, error } = await supabase
    .from('returns')
    .select('*, orders(*), customers(*)')
    .eq('id', returnId)
    .single()

  if (error) return null
  return data as Return
}

// ─── Display maps ─────────────────────────────────────────────────────────────

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  damaged:      'Item arrived damaged',
  wrong_item:   'Wrong item received',
  changed_mind: 'Changed mind',
  defective:    'Item is defective',
  size_issue:   'Wrong size / fit issue',
}

export const RETURN_STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  AUTO_DENIED:      { label: 'Denied',           color: 'text-red-700 bg-red-50 border-red-200' },
  APPROVED:         { label: 'Approved',          color: 'text-blue-700 bg-blue-50 border-blue-200' },
  LABEL_GENERATED:  { label: 'Label Ready',       color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  IN_TRANSIT:       { label: 'In Transit',        color: 'text-purple-700 bg-purple-50 border-purple-200' },
  RECEIVED:         { label: 'Received',          color: 'text-teal-700 bg-teal-50 border-teal-200' },
  REFUND_INITIATED: { label: 'Refund Sent',       color: 'text-green-700 bg-green-50 border-green-200' },
  COMPLETED:        { label: 'Completed',         color: 'text-gray-600 bg-gray-50 border-gray-200' },
  LOST:             { label: 'Lost',              color: 'text-red-900 bg-red-100 border-red-300' },
}

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  GOOD:      'Good / Resellable',
  DAMAGED:   'Damaged',
  DEFECTIVE: 'Defective',
  LOST:      'Lost in transit',
}
