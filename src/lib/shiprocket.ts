/**
 * shiprocket.ts — Client-side Shiprocket integration helpers for Centinal.
 *
 * Currently covers credential validation + connect flow from
 * Settings → Integrations. Shipment creation, tracking, and label
 * generation will be added alongside the `shiprocket-proxy` edge function
 * when the full Shiprocket integration ships.
 *
 * Shiprocket API base: https://apiv2.shiprocket.in/v1/external
 * Auth: email + password → Bearer JWT (valid for 10 days)
 */

import { supabase, DEMO_MODE } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShiprocketCredentials {
  email: string
  password: string
  webhook_token?: string   // Optional: for securing incoming webhooks
}

export interface ShiprocketTestResult {
  ok: boolean
  company_name?: string
  email?: string
  error?: string
}

// ─── Credential validation ──────────────────────────────────────────────────

export async function testShiprocketConnection(
  credentials: ShiprocketCredentials
): Promise<ShiprocketTestResult> {
  if (DEMO_MODE) {
    await delay(800)
    return {
      ok: true,
      company_name: 'Zestify Foods Pvt Ltd',
      email: credentials.email,
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('shiprocket-proxy', {
      body: { action: 'test_connection', email: credentials.email, password: credentials.password },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Connection failed')
    return { ok: true, company_name: data.company_name, email: data.email }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Test failed' }
  }
}

// ─── Full connect flow ─────────────────────────────────────────────────────

export async function connectShiprocket(
  _brandId: string,
  credentials: ShiprocketCredentials,
  onProgress: (message: string) => void
): Promise<{ ok: boolean; error?: string }> {
  onProgress('Authenticating with Shiprocket…')
  const testResult = await testShiprocketConnection(credentials)
  if (!testResult.ok) {
    return { ok: false, error: testResult.error ?? 'Authentication failed' }
  }
  onProgress(`✓ Connected — ${testResult.company_name ?? 'Shiprocket account verified'}`)
  onProgress('Ready to create shipments')
  return { ok: true }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
