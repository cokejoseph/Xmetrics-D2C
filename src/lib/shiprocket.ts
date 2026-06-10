/**
 * shiprocket.ts — Client-side Shiprocket integration helpers for Sentinal.
 *
 * Covers:
 *   1. Credential validation (email + password → JWT token)
 *   2. Creating shipments (when fulfillment_status = READY_TO_SHIP)
 *   3. Tracking a shipment by AWB
 *   4. Cancelling a shipment
 *   5. Requesting pickup
 *
 * Shiprocket API base: https://apiv2.shiprocket.in/v1/external
 * Auth: email + password → Bearer JWT (valid for 10 days)
 *
 * The webhook handler lives at: supabase/functions/shiprocket-webhooks/index.ts
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

export interface ShiprocketShipmentRequest {
  order_id: string          // Sentinal order ID
  order_number: string      // e.g. "ORD-1001"
  channel_id?: number       // Shiprocket channel ID (from integration settings)
  items: Array<{
    name: string
    sku: string
    units: number
    selling_price: number
    weight?: number
  }>
  billing_customer_name: string
  billing_phone: string
  billing_address: string
  billing_city: string
  billing_state: string
  billing_pincode: string
  billing_country?: string
  payment_method: 'COD' | 'Prepaid'
  order_total: number
  weight_kg: number
  length_cm?: number
  breadth_cm?: number
  height_cm?: number
}

export interface ShiprocketShipmentResult {
  ok: boolean
  shipment_id?: number
  awb_code?: string
  courier_name?: string
  label_url?: string
  manifest_url?: string
  error?: string
}

export interface ShiprocketTrackResult {
  ok: boolean
  current_status?: string
  current_timestamp?: string
  etd?: string
  activities?: Array<{
    date: string
    activity: string
    location: string
  }>
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

// ─── Create shipment ────────────────────────────────────────────────────────

/**
 * Create a new shipment on Shiprocket for a given order.
 * Returns AWB code + label URL on success.
 */
export async function createShiprocketShipment(
  brandId: string,
  credentials: ShiprocketCredentials,
  shipmentRequest: ShiprocketShipmentRequest
): Promise<ShiprocketShipmentResult> {
  if (DEMO_MODE) {
    await delay(1000)
    const awb = `SR${Math.random().toString().slice(2, 12)}`
    return {
      ok: true,
      shipment_id: Math.floor(Math.random() * 100000),
      awb_code: awb,
      courier_name: 'BlueDart',
      label_url: `https://demo.shiprocket.in/labels/${awb}.pdf`,
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('shiprocket-proxy', {
      body: {
        action: 'create_shipment',
        brand_id: brandId,
        email: credentials.email,
        password: credentials.password,
        shipment: shipmentRequest,
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Shipment creation failed')
    return {
      ok: true,
      shipment_id: data.shipment_id,
      awb_code: data.awb_code,
      courier_name: data.courier_name,
      label_url: data.label_url,
      manifest_url: data.manifest_url,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Shipment creation failed' }
  }
}

// ─── Track shipment ─────────────────────────────────────────────────────────

export async function trackShiprocketShipment(awb: string): Promise<ShiprocketTrackResult> {
  if (DEMO_MODE) {
    await delay(500)
    return {
      ok: true,
      current_status: 'In Transit',
      current_timestamp: new Date().toISOString(),
      etd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      activities: [
        { date: new Date().toISOString(), activity: 'Shipment in transit', location: 'Delhi Hub' },
        { date: new Date(Date.now() - 3600000).toISOString(), activity: 'Picked up', location: 'Warehouse' },
      ],
    }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('shiprocket-proxy', {
      body: { action: 'track', awb },
    })
    if (error) throw new Error(error.message)
    return {
      ok: true,
      current_status: data.current_status,
      current_timestamp: data.current_timestamp,
      etd: data.etd,
      activities: data.activities ?? [],
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Tracking failed' }
  }
}

// ─── Cancel shipment ────────────────────────────────────────────────────────

export async function cancelShiprocketShipment(
  awb: string,
  credentials: ShiprocketCredentials
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) {
    await delay(600)
    return { ok: true }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('shiprocket-proxy', {
      body: {
        action: 'cancel_shipment',
        email: credentials.email,
        password: credentials.password,
        awbs: [awb],
      },
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error ?? 'Cancel failed')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Cancel failed' }
  }
}

// ─── Generate labels bulk ──────────────────────────────────────────────────

/**
 * Generate a merged PDF label for multiple AWBs.
 * Shiprocket supports bulk label generation in one API call.
 */
export async function generateShiprocketLabels(
  awbs: string[],
  credentials: ShiprocketCredentials
): Promise<{ ok: boolean; label_url?: string; error?: string }> {
  if (DEMO_MODE) {
    await delay(800)
    return { ok: true, label_url: `https://demo.shiprocket.in/bulk-labels/${Date.now()}.pdf` }
  }

  try {
    const { data, error } = await supabase!.functions.invoke('shiprocket-proxy', {
      body: {
        action: 'generate_labels',
        email: credentials.email,
        password: credentials.password,
        awbs,
      },
    })
    if (error) throw new Error(error.message)
    return { ok: true, label_url: data.label_url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Label generation failed' }
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

// ─── Utils ──────────────────────────────────────────────────────────────────

/** Map Sentinal PaymentMethod to Shiprocket payment_method */
export function toShiprocketPaymentMethod(method: string): 'COD' | 'Prepaid' {
  return method === 'COD' ? 'COD' : 'Prepaid'
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
