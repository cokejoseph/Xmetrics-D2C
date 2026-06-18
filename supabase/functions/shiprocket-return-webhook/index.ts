/**
 * shiprocket-return-webhook — Supabase Edge Function
 *
 * Receives Shiprocket status push notifications for reverse shipments.
 * verify_jwt: false  (Shiprocket can't send a Supabase JWT)
 *
 * Configure in Shiprocket dashboard: Settings → Webhooks
 * URL: https://<project-ref>.supabase.co/functions/v1/shiprocket-return-webhook
 *
 * Supported status transitions:
 *   pickup_scheduled / return_initiated  → LABEL_GENERATED
 *   picked_up / return_in_transit        → IN_TRANSIT
 *   return_received / delivered          → RECEIVED
 *   return_lost / lost                   → LOST
 *
 * On RECEIVED: sets actual_return_received_date (ops then calls returns-approve)
 * On LOST:     creates exception for manual refund handling
 *
 * Deploy: supabase functions deploy shiprocket-return-webhook --no-verify-jwt
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shiprocket-token',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Status order for regression guard (earlier index = earlier in lifecycle)
const STATUS_ORDER = [
  'PENDING_APPROVAL', 'APPROVED', 'LABEL_GENERATED',
  'IN_TRANSIT', 'RECEIVED', 'REFUND_INITIATED', 'COMPLETED',
]

function mapSrStatus(srStatus: string): string | null {
  const s = srStatus.toLowerCase().replace(/[\s-]+/g, '_')
  const map: Record<string, string> = {
    'return_initiated':     'LABEL_GENERATED',
    'pickup_generated':     'LABEL_GENERATED',
    'pickup_scheduled':     'LABEL_GENERATED',
    'picked_up':            'IN_TRANSIT',
    'return_in_transit':    'IN_TRANSIT',
    'in_transit':           'IN_TRANSIT',
    'out_for_delivery':     'IN_TRANSIT',
    'return_received':      'RECEIVED',
    'delivered':            'RECEIVED',
    'return_lost':          'LOST',
    'lost':                 'LOST',
    'shipment_lost':        'LOST',
  }
  return map[s] ?? null
}

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // Optional webhook token guard
  const webhookToken = Deno.env.get('SHIPROCKET_WEBHOOK_TOKEN')
  if (webhookToken) {
    const incoming = req.headers.get('x-shiprocket-token') ?? ''
    if (incoming !== webhookToken) {
      console.error('shiprocket-return-webhook: invalid token')
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  // Use service-role client (no JWT from Shiprocket)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let payload: AnyRecord
  try { payload = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  // Shiprocket payload varies by webhook type; try multiple field names
  const awb       = payload.awb ?? payload.awb_code ?? payload.shipment?.awb ?? null
  const srStatus  = String(payload.current_status ?? payload.status ?? '')
  const srTs      = payload.current_timestamp ?? payload.timestamp ?? new Date().toISOString()

  console.log('shiprocket-return-webhook:', { awb, srStatus })

  if (!awb) {
    console.warn('No AWB in payload:', JSON.stringify(payload))
    return json({ received: true, warning: 'No AWB in payload — nothing updated' })
  }

  // ── Look up return by AWB ─────────────────────────────────────────────────

  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select('id, brand_id, order_id, status, refund_amount, return_reason')
    .eq('shiprocket_awb_number', String(awb))
    .single()

  if (retErr || !ret) {
    console.warn('No return found for AWB:', awb)
    return json({ received: true, warning: `No return found for AWB ${awb}` })
  }

  // ── Map + validate status transition ─────────────────────────────────────

  const newStatus = mapSrStatus(srStatus)
  if (!newStatus) {
    console.log('Unmapped SR status:', srStatus)
    return json({ received: true, note: `Status "${srStatus}" is not mapped — no update` })
  }

  // Don't regress (LOST is always allowed — it can come from any state)
  if (newStatus !== 'LOST') {
    const curIdx = STATUS_ORDER.indexOf(ret.status)
    const newIdx = STATUS_ORDER.indexOf(newStatus)
    if (newIdx <= curIdx) {
      return json({
        received: true,
        note: `Status ${ret.status} → ${newStatus} would regress — skipped`,
      })
    }
  }

  // ── Build update payload ──────────────────────────────────────────────────

  const updates: AnyRecord = { status: newStatus }

  if (newStatus === 'RECEIVED') {
    updates.actual_return_received_date = srTs
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  const { error: updateErr } = await supabase
    .from('returns')
    .update(updates)
    .eq('id', ret.id)

  if (updateErr) {
    console.error('Failed to update return:', updateErr)
    return json({ error: 'Failed to update return', detail: updateErr.message }, 500)
  }

  // ── LOST: create ops exception ────────────────────────────────────────────

  if (newStatus === 'LOST') {
    await supabase.from('exceptions').insert({
      brand_id: ret.brand_id,
      order_id: ret.order_id,
      type:     'STUCK_SHIPMENT',
      severity: 'HIGH',
      status:   'UNRESOLVED',
      title:    'Return shipment lost in transit',
      description: `Return AWB ${awb} was marked LOST by Shiprocket. Refund of ₹${ret.refund_amount ?? '?'} needs manual processing. Return ID: ${ret.id}.`,
    })
  }

  // ── Order timeline ────────────────────────────────────────────────────────

  const statusMessages: Record<string, string> = {
    LABEL_GENERATED: `Return pickup scheduled. AWB: ${awb}.`,
    IN_TRANSIT:      `Return AWB ${awb} picked up — in transit to warehouse.`,
    RECEIVED:        `Return AWB ${awb} received at warehouse. Awaiting ops inspection.`,
    LOST:            `Return AWB ${awb} lost in transit. Exception created for manual refund.`,
  }

  await supabase.from('order_timeline').insert({
    order_id: ret.order_id,
    event:    statusMessages[newStatus] ?? `Return status updated to ${newStatus}. AWB: ${awb}.`,
    actor:    'Shiprocket webhook',
    metadata: { return_id: ret.id, awb, sr_status: srStatus, sr_timestamp: srTs },
  })

  return json({
    received:   true,
    return_id:  ret.id,
    old_status: ret.status,
    new_status: newStatus,
  })
})
