/**
 * oms-retry-cron — Supabase Edge Function (scheduled)
 *
 * Auto-retries orders stuck in oms_push_status = 'FAILED' with backoff, so a
 * transient OMS outage self-heals instead of waiting for a founder to notice
 * and click "retry". It re-invokes oms-push using the service-role key (internal
 * mode), reusing all of its HMAC/payload/logging logic.
 *
 * Backoff:
 *   - skip orders pushed within the last COOLDOWN_MIN minutes
 *   - give up after MAX_ATTEMPTS (leave FAILED for manual handling + alerting)
 *
 * Schedule (run e.g. every 15 min) with Supabase scheduled functions or pg_cron:
 *   select cron.schedule(
 *     'oms-retry', '*\/15 * * * *',
 *     $$ select net.http_post(
 *          'https://<project>.supabase.co/functions/v1/oms-retry-cron',
 *          '{}', 'application/json',
 *          array[('Authorization','Bearer '||current_setting('app.service_key'))]::net.http_header[]
 *        ) $$);
 *
 * Deploy: supabase functions deploy oms-retry-cron
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const MAX_ATTEMPTS = 5
const COOLDOWN_MIN = 10

Deno.serve(async () => {
  const { data: failed } = await supabase
    .from('orders')
    .select('id, brand_id')
    .eq('oms_push_status', 'FAILED')
    .limit(100)

  let retried = 0
  let skipped = 0
  let gaveUp = 0

  for (const o of failed ?? []) {
    const { data: log } = await supabase
      .from('oms_push_log')
      .select('pushed_at')
      .eq('order_id', o.id)
      .order('pushed_at', { ascending: false })
      .limit(MAX_ATTEMPTS + 1)

    const attempts = log?.length ?? 0
    if (attempts >= MAX_ATTEMPTS) { gaveUp++; continue }

    const last = log?.[0]?.pushed_at as string | undefined
    if (last && (Date.now() - new Date(last).getTime()) < COOLDOWN_MIN * 60_000) {
      skipped++
      continue
    }

    await fetch(`${SUPABASE_URL}/functions/v1/oms-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ action: 'push_order', brand_id: o.brand_id, order_id: o.id, push_type: 'RETRY' }),
    }).catch(() => { /* logged by oms-push; counted as an attempt */ })
    retried++
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: failed?.length ?? 0, retried, skipped, gave_up: gaveUp }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
