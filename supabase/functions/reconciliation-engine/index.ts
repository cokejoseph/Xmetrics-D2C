/**
 * reconciliation-engine — Supabase Edge Function
 *
 * Backend persistence layer for the COD & Payment Reconciliation module.
 * All reconciliation logic runs client-side; this function handles DB writes
 * and reads that require service-role access.
 *
 * Actions:
 *   upload_cod_csv  — Store parsed Shiprocket COD remittance rows + upload record
 *   save_report     — Persist a completed reconciliation report summary
 *   get_reports     — Return past reconciliation reports for a brand
 *
 * Deploy:
 *   supabase functions deploy reconciliation-engine
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const authHeader = req.headers.get('authorization') ?? ''
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json()
  const { action, brand_id } = body
  if (!brand_id) return json({ error: 'brand_id required' }, 400)

  // Verify brand membership
  const { data: membership } = await supabase
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return json({ error: 'Not a member of this brand' }, 403)

  // ── upload_cod_csv ───────────────────────────────────────────────────────
  if (action === 'upload_cod_csv') {
    const { filename, period_start, period_end, rows } = body
    if (!filename || !period_start || !period_end || !Array.isArray(rows)) {
      return json({ error: 'filename, period_start, period_end, rows required' }, 400)
    }

    // Insert upload record
    const { data: upload, error: uploadErr } = await supabase
      .from('cod_remittance_uploads')
      .insert({
        brand_id,
        filename,
        period_start,
        period_end,
        uploaded_by: user.id,
        row_count: rows.length,
        status: 'DONE',
      })
      .select('id')
      .single()

    if (uploadErr || !upload) {
      return json({ error: uploadErr?.message ?? 'Failed to create upload record' }, 500)
    }

    // Bulk-insert rows in batches of 500
    const BATCH = 500
    const rowsWithIds = rows.map((r: {
      order_number: string
      awb_number?: string | null
      delivery_date?: string | null
      collected_amount: number
      remitted_amount: number
      remittance_date?: string | null
      deductions: number
      status: string
      shiprocket_ref?: string | null
    }) => ({
      upload_id:        upload.id,
      brand_id,
      order_number:     r.order_number,
      awb_number:       r.awb_number ?? null,
      delivery_date:    r.delivery_date ?? null,
      collected_amount: r.collected_amount,
      remitted_amount:  r.remitted_amount,
      remittance_date:  r.remittance_date ?? null,
      deductions:       r.deductions,
      status:           r.status,
      shiprocket_ref:   r.shiprocket_ref ?? null,
    }))

    for (let i = 0; i < rowsWithIds.length; i += BATCH) {
      const { error: insertErr } = await supabase
        .from('cod_remittance_rows')
        .insert(rowsWithIds.slice(i, i + BATCH))
      if (insertErr) {
        // Mark upload as errored
        await supabase
          .from('cod_remittance_uploads')
          .update({ status: 'ERROR', error_message: insertErr.message })
          .eq('id', upload.id)
        return json({ error: `Row insert failed: ${insertErr.message}` }, 500)
      }
    }

    return json({ ok: true, upload_id: upload.id, row_count: rows.length })
  }

  // ── save_report ──────────────────────────────────────────────────────────
  if (action === 'save_report') {
    const {
      period_start, period_end, report_type,
      cod_orders, cod_order_value, cod_collected, cod_remitted,
      cod_pending_count, cod_short_paid_count, cod_unremitted_count, cod_discrepancy,
      prepaid_orders, prepaid_collected, prepaid_fees, prepaid_settled,
      cod_upload_id,
    } = body

    if (!period_start || !period_end || !report_type) {
      return json({ error: 'period_start, period_end, report_type required' }, 400)
    }

    const { data: report, error: reportErr } = await supabase
      .from('reconciliation_reports')
      .insert({
        brand_id,
        period_start,
        period_end,
        report_type,
        cod_orders:           cod_orders ?? 0,
        cod_order_value:      cod_order_value ?? 0,
        cod_collected:        cod_collected ?? 0,
        cod_remitted:         cod_remitted ?? 0,
        cod_pending_count:    cod_pending_count ?? 0,
        cod_short_paid_count: cod_short_paid_count ?? 0,
        cod_unremitted_count: cod_unremitted_count ?? 0,
        cod_discrepancy:      cod_discrepancy ?? 0,
        prepaid_orders:       prepaid_orders ?? 0,
        prepaid_collected:    prepaid_collected ?? 0,
        prepaid_fees:         prepaid_fees ?? 0,
        prepaid_settled:      prepaid_settled ?? 0,
        cod_upload_id:        cod_upload_id ?? null,
        generated_by:         user.id,
      })
      .select('id')
      .single()

    if (reportErr || !report) {
      return json({ error: reportErr?.message ?? 'Failed to save report' }, 500)
    }

    return json({ ok: true, report_id: report.id })
  }

  // ── get_reports ──────────────────────────────────────────────────────────
  if (action === 'get_reports') {
    const { data: reports, error: reportsErr } = await supabase
      .from('reconciliation_reports')
      .select('*')
      .eq('brand_id', brand_id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (reportsErr) return json({ error: reportsErr.message }, 500)

    return json({ ok: true, reports: reports ?? [] })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  })
}
