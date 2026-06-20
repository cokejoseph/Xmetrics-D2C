import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Scheduled daily via Supabase cron or pg_cron.
// Finds subscriptions due for renewal today and:
//   - Creates a new Razorpay order for the renewal amount
//   - On first failure: marks PAYMENT_FAILED, raises exception, increments attempt count
//   - After 3 failures: marks EXPIRED

const MAX_RETRY_ATTEMPTS = 3

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Accept both scheduled invocations (no body) and manual POST triggers
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Verify internal cron secret to prevent unauthorized triggering
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const keyId       = Deno.env.get('RAZORPAY_KEY_ID')!
  const keySecret   = Deno.env.get('RAZORPAY_KEY_SECRET')!

  const svc   = createClient(supabaseUrl, serviceKey)
  const today = new Date().toISOString().slice(0, 10)

  // ── Find subscriptions due for renewal ──────────────────────────────────────
  const { data: due, error: fetchErr } = await svc
    .from('subscriptions')
    .select('id, brand_id, plan_type, plan_amount_paise, email, renewal_attempt_count, razorpay_subscription_id')
    .eq('next_renewal_date', today)
    .in('status', ['ACTIVE', 'PAYMENT_FAILED'])

  if (fetchErr) {
    console.error('renewal-check fetch error:', fetchErr)
    return json({ error: 'Failed to query subscriptions' }, 500)
  }

  if (!due || due.length === 0) {
    return json({ processed: 0, message: 'No renewals due today' })
  }

  console.log(`renewal-check: ${due.length} subscription(s) due for renewal on ${today}`)

  const results: Array<{ id: string; outcome: string }> = []

  for (const sub of due) {
    try {
      // ── If past max retries → expire ──────────────────────────────────────
      if (sub.renewal_attempt_count >= MAX_RETRY_ATTEMPTS) {
        await svc.from('subscriptions').update({
          status:            'EXPIRED',
          status_updated_at: new Date().toISOString(),
          next_renewal_date: null,
        }).eq('id', sub.id)

        await svc.from('subscription_history').insert({
          subscription_id: sub.id,
          event:           'EXPIRED',
          old_status:      'PAYMENT_FAILED',
          new_status:      'EXPIRED',
          metadata:        { attempts: sub.renewal_attempt_count, reason: 'Max retry attempts exceeded' },
        })

        // ── Create EXPIRED exception for brand ─────────────────────────────
        await svc.from('exceptions').insert({
          brand_id:    sub.brand_id,
          order_id:    null,
          type:        'SUBSCRIPTION_EXPIRED',
          severity:    'CRITICAL',
          status:      'UNRESOLVED',
          title:       'Subscription expired',
          description: `Your ${sub.plan_type} subscription has expired after ${sub.renewal_attempt_count} failed renewal attempts. Resubscribe to restore access.`,
        })

        results.push({ id: sub.id, outcome: 'expired' })
        continue
      }

      // ── Create Razorpay renewal order ─────────────────────────────────────
      const receipt   = `renew_${sub.id.slice(0, 8)}_${Date.now()}`
      const rzpRes    = await fetch('https://api.razorpay.com/v1/orders', {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          amount:   sub.plan_amount_paise,
          currency: 'INR',
          receipt,
          notes:    { brand_id: sub.brand_id, plan_type: sub.plan_type, is_renewal: true },
        }),
      })

      if (!rzpRes.ok) {
        throw new Error(`Razorpay order creation failed: ${rzpRes.status}`)
      }

      const order       = await rzpRes.json()
      const nextRenewal = new Date()
      nextRenewal.setDate(nextRenewal.getDate() + 30)

      // ── On success: reset counters, advance renewal date ──────────────────
      await svc.from('subscriptions').update({
        status:                'ACTIVE',
        status_updated_at:     new Date().toISOString(),
        razorpay_order_id:     order.id,
        next_renewal_date:     nextRenewal.toISOString().slice(0, 10),
        renewal_attempt_count: 0,
        orders_this_month:     0,
        paid_amount_paise:     sub.plan_amount_paise,
      }).eq('id', sub.id)

      await svc.from('subscription_history').insert({
        subscription_id: sub.id,
        event:           'RENEWED',
        old_status:      'ACTIVE',
        new_status:      'ACTIVE',
        metadata:        { razorpay_order_id: order.id, next_renewal_date: nextRenewal.toISOString().slice(0, 10) },
      })

      results.push({ id: sub.id, outcome: 'renewed' })
    } catch (err) {
      console.error(`renewal failed for subscription ${sub.id}:`, err)

      const newAttemptCount = (sub.renewal_attempt_count ?? 0) + 1
      await svc.from('subscriptions').update({
        status:                'PAYMENT_FAILED',
        status_updated_at:     new Date().toISOString(),
        renewal_attempt_count: newAttemptCount,
      }).eq('id', sub.id)

      await svc.from('subscription_history').insert({
        subscription_id: sub.id,
        event:           'PAYMENT_FAILED',
        old_status:      'ACTIVE',
        new_status:      'PAYMENT_FAILED',
        metadata:        { attempt: newAttemptCount, error: String(err) },
      })

      // ── Create PAYMENT_FAILED exception ────────────────────────────────────
      await svc.from('exceptions').insert({
        brand_id:    sub.brand_id,
        order_id:    null,
        type:        'SUBSCRIPTION_PAYMENT_FAILED',
        severity:    'HIGH',
        status:      'UNRESOLVED',
        title:       'Subscription renewal failed',
        description: `Attempt ${newAttemptCount}/${MAX_RETRY_ATTEMPTS}. Please update your payment method to avoid service interruption.`,
      })

      results.push({ id: sub.id, outcome: 'payment_failed' })
    }
  }

  const renewed      = results.filter(r => r.outcome === 'renewed').length
  const failed       = results.filter(r => r.outcome === 'payment_failed').length
  const expired      = results.filter(r => r.outcome === 'expired').length

  console.log(`renewal-check done: ${renewed} renewed, ${failed} failed, ${expired} expired`)

  return json({ processed: due.length, renewed, failed, expired, results })
})
