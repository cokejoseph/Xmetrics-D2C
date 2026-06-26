/**
 * whatsapp.ts — WhatsApp Business API helpers for Xmetrics.
 *
 * Currently covers credential validation from Settings → Integrations.
 * Message sending (reorder nudges, order notifications, daily brief) will be
 * added alongside the `whatsapp-send` edge function when that ships.
 *
 * Uses WhatsApp Cloud API (Meta).
 * API base: https://graph.facebook.com/v19.0/<phone_number_id>/messages
 *
 * In demo mode, the test is simulated with a short delay and returns success.
 */

import { supabase, DEMO_MODE } from './supabase'

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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
