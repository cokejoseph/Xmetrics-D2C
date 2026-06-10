/**
 * whatsapp.ts — WhatsApp Business API helpers for Sentinal.
 *
 * Used for:
 *   1. Sending reorder nudges to at-risk / churning customers
 *   2. Sending order confirmation & delivery status messages
 *   3. Sending the Daily Brief to the brand owner's WhatsApp
 *   4. Testing connection from Settings → Integrations
 *
 * Uses WhatsApp Cloud API (Meta) with a template message approach.
 * API base: https://graph.facebook.com/v19.0/<phone_number_id>/messages
 *
 * Pre-approved templates (must match what's approved in Meta Business Manager):
 *   sentinal_reorder_nudge       — 2 params: {{customer_name}}, {{product_name}}
 *   sentinal_order_confirmation  — 3 params: {{order_number}}, {{amount}}, {{customer_name}}
 *   sentinal_delivery_update     — 3 params: {{order_number}}, {{status}}, {{awb}}
 *   sentinal_daily_brief         — 1 param: {{brief_text}} (freeform section)
 *
 * In demo mode, all sends are simulated with a 600ms delay and return success.
 */

import { supabase, DEMO_MODE } from './supabase'
import type { ReorderNudge } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WhatsAppCredentials {
  phone_number_id: string   // Meta phone number ID (numeric string)
  api_token: string         // Meta System User permanent token
  business_account_id?: string
}

export interface WhatsAppTestResult {
  ok: boolean
  display_phone_number?: string
  verified_name?: string
  error?: string
}

export interface WhatsAppSendResult {
  ok: boolean
  message_id?: string
  error?: string
}

// ─── Credential validation ──────────────────────────────────────────────────

export async function testWhatsAppConnection(
  credentials: WhatsAppCredentials
): Promise<WhatsAppTestResult> {
  if (DEMO_MODE) {
    await delay(700)
    return {
      ok: true,
      display_phone_number: '+91 98765 43210',
      verified_name: 'Zestify Foods',
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('whatsapp-send', {
      body: { action: 'test_connection', ...credentials },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Connection failed')
    return {
      ok: true,
      display_phone_number: data.display_phone_number,
      verified_name: data.verified_name,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Test failed' }
  }
}

// ─── Reorder nudge ─────────────────────────────────────────────────────────

/**
 * Send a reorder nudge WhatsApp message to a customer.
 * Uses the pre-approved `sentinal_reorder_nudge` template.
 */
export async function sendReorderNudge(
  credentials: WhatsAppCredentials,
  nudge: ReorderNudge
): Promise<WhatsAppSendResult> {
  if (DEMO_MODE) {
    await delay(600)
    console.log('[WhatsApp Demo] Reorder nudge sent to:', nudge.customer_phone, '—', nudge.suggested_message)
    return { ok: true, message_id: `demo_${Date.now()}` }
  }

  return sendTemplateMessage(credentials, {
    to: nudge.customer_phone,
    template: 'sentinal_reorder_nudge',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: nudge.customer_name },
          { type: 'text', text: nudge.last_product_name },
        ],
      },
    ],
  })
}

/**
 * Send reorder nudges to multiple customers.
 * Rate-limited to avoid WhatsApp API throttling (max 80 msg/s).
 */
export async function sendBulkReorderNudges(
  credentials: WhatsAppCredentials,
  nudges: ReorderNudge[],
  onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < nudges.length; i++) {
    const result = await sendReorderNudge(credentials, nudges[i])
    if (result.ok) {
      sent++
    } else {
      failed++
      errors.push(`${nudges[i].customer_name}: ${result.error}`)
    }
    onProgress?.(sent, nudges.length)
    // Rate limit: 20 msg/s to stay well within WhatsApp limits
    if (i < nudges.length - 1) await delay(50)
  }

  return { sent, failed, errors }
}

// ─── Order notifications ────────────────────────────────────────────────────

/** Send order confirmation WhatsApp message to customer */
export async function sendOrderConfirmation(
  credentials: WhatsAppCredentials,
  phone: string,
  orderNumber: string,
  amount: number,
  customerName: string
): Promise<WhatsAppSendResult> {
  if (DEMO_MODE) {
    await delay(400)
    return { ok: true, message_id: `demo_${Date.now()}` }
  }

  return sendTemplateMessage(credentials, {
    to: phone,
    template: 'sentinal_order_confirmation',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: orderNumber },
          { type: 'text', text: `₹${amount.toLocaleString('en-IN')}` },
        ],
      },
    ],
  })
}

/** Send delivery status update to customer */
export async function sendDeliveryUpdate(
  credentials: WhatsAppCredentials,
  phone: string,
  orderNumber: string,
  status: string,
  awb: string
): Promise<WhatsAppSendResult> {
  if (DEMO_MODE) {
    await delay(400)
    return { ok: true, message_id: `demo_${Date.now()}` }
  }

  const statusLabel: Record<string, string> = {
    SHIPPED: 'has been shipped',
    IN_TRANSIT: 'is in transit',
    OUT_FOR_DELIVERY: 'is out for delivery',
    DELIVERED: 'has been delivered',
    RTO_INITIATED: 'could not be delivered and is being returned',
  }

  return sendTemplateMessage(credentials, {
    to: phone,
    template: 'sentinal_delivery_update',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: orderNumber },
          { type: 'text', text: statusLabel[status] ?? status },
          { type: 'text', text: awb },
        ],
      },
    ],
  })
}

// ─── Daily Brief ────────────────────────────────────────────────────────────

/**
 * Send the daily brief as a WhatsApp message to the brand owner.
 * Uses a free-form text message (not a template) for flexibility.
 * Requires BUSINESS_INITIATED conversation tier.
 */
export async function sendDailyBrief(
  credentials: WhatsAppCredentials,
  ownerPhone: string,
  briefText: string
): Promise<WhatsAppSendResult> {
  if (DEMO_MODE) {
    await delay(500)
    console.log('[WhatsApp Demo] Daily brief sent to:', ownerPhone)
    console.log(briefText.slice(0, 200) + '…')
    return { ok: true, message_id: `demo_${Date.now()}` }
  }

  // WhatsApp limits messages to 4096 chars — truncate if needed
  const truncated = briefText.length > 4000
    ? briefText.slice(0, 3997) + '…'
    : briefText

  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        action: 'send_text',
        phone_number_id: credentials.phone_number_id,
        api_token: credentials.api_token,
        to: ownerPhone,
        text: truncated,
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Send failed')
    return { ok: true, message_id: data.message_id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
  }
}

// ─── Core template sender ──────────────────────────────────────────────────

interface TemplatePayload {
  to: string
  template: string
  language: string
  components: Array<{
    type: string
    parameters: Array<{ type: string; text: string }>
  }>
}

async function sendTemplateMessage(
  credentials: WhatsAppCredentials,
  payload: TemplatePayload
): Promise<WhatsAppSendResult> {
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        action: 'send_template',
        phone_number_id: credentials.phone_number_id,
        api_token: credentials.api_token,
        ...payload,
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Template send failed')
    return { ok: true, message_id: data.message_id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
  }
}

// ─── Utils ──────────────────────────────────────────────────────────────────

/** Format a phone number to WhatsApp E.164 format for Indian numbers */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
