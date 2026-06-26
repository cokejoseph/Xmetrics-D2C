import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  try {
    const signature = req.headers.get('x-razorpay-signature')
    const body = await req.text()

    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not set')
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Verify HMAC-SHA256 signature — MANDATORY. Razorpay always sends
    // x-razorpay-signature on webhooks; a request without one is forged. Never
    // process an unsigned webhook — it could otherwise mark a checkout_payments
    // row PAID or flip a D2C order's payment_status with no real payment.
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const expectedSignature = await hmacSha256Hex(secret, body)
    if (signature !== expectedSignature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(body)
    console.log('Webhook event:', event.event)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const entity = event.payload?.payment?.entity ?? event.payload?.order?.entity

    switch (event.event) {
      case 'payment.captured': {
        const razorpayOrderId = entity?.order_id
        const razorpayPaymentId = entity?.id
        const amount = entity?.amount
        const email = entity?.email ?? entity?.notes?.email

        console.log('payment.captured — order_id:', razorpayOrderId, 'payment_id:', razorpayPaymentId, 'email:', email)

        // ── 1. Update subscription row (plan checkout payments) ────────────
        if (razorpayOrderId) {
          const { data: sub } = await supabase
            .from('checkout_payments')
            .select('id')
            .eq('razorpay_order_id', razorpayOrderId)
            .single()

          if (sub) {
            await supabase
              .from('checkout_payments')
              .update({
                status: 'PAID',
                razorpay_payment_id: razorpayPaymentId,
                paid_at: new Date().toISOString(),
              })
              .eq('id', sub.id)
            console.log('Checkout payment marked PAID:', sub.id)
          } else {
            // ── 2. Fallback: D2C order payment ─────────────────────────────
            const { data: payment } = await supabase
              .from('payments')
              .select('id, order_id')
              .eq('gateway_ref', razorpayOrderId)
              .single()

            if (payment) {
              await supabase
                .from('payments')
                .update({ status: 'PAID', gateway_ref: razorpayPaymentId, settled_at: new Date().toISOString() })
                .eq('id', payment.id)

              if (payment.order_id) {
                await supabase
                  .from('orders')
                  .update({ payment_status: 'PAID', razorpay_payment_id: razorpayPaymentId })
                  .eq('id', payment.order_id)

                await supabase.from('order_timeline').insert({
                  order_id: payment.order_id,
                  event: 'PAYMENT_CAPTURED',
                  actor: 'razorpay',
                  metadata: { razorpay_payment_id: razorpayPaymentId, amount: amount ? amount / 100 : null },
                })
              }
            } else {
              // Neither subscription nor order found — log it
              console.warn('payment.captured: no matching subscription or order for razorpay_order_id:', razorpayOrderId, 'email:', email)
            }
          }
        }
        break
      }

      case 'payment.failed': {
        const razorpayOrderId = entity?.order_id
        const errorDesc = entity?.error_description ?? entity?.error?.description

        // Mark subscription as FAILED
        if (razorpayOrderId) {
          const { data: sub } = await supabase
            .from('checkout_payments')
            .select('id')
            .eq('razorpay_order_id', razorpayOrderId)
            .single()

          if (sub) {
            await supabase.from('checkout_payments').update({ status: 'FAILED' }).eq('id', sub.id)
          } else {
            // D2C order payment failed
            const { data: payment } = await supabase
              .from('payments')
              .select('id, order_id, brand_id')
              .eq('gateway_ref', razorpayOrderId)
              .single()

            if (payment?.order_id) {
              await supabase.from('payments').update({ status: 'FAILED' }).eq('id', payment.id)
              await supabase.from('orders').update({ payment_status: 'FAILED' }).eq('id', payment.order_id)

              const { data: order } = await supabase.from('orders').select('order_number').eq('id', payment.order_id).single()
              await supabase.from('exceptions').insert({
                brand_id: payment.brand_id,
                order_id: payment.order_id,
                type: 'FAILED_PAYMENT',
                severity: 'HIGH',
                status: 'UNRESOLVED',
                title: `Payment failed for order ${order?.order_number ?? payment.order_id}`,
                description: errorDesc ?? 'Razorpay payment failure',
              })
            }
          }
        }
        break
      }

      case 'refund.processed': {
        const paymentId = entity?.payment_id
        const amount = entity?.amount

        // Check checkout payment refund first
        const { data: sub } = await supabase
          .from('checkout_payments')
          .select('id')
          .eq('razorpay_payment_id', paymentId)
          .single()

        if (sub) {
          await supabase.from('checkout_payments').update({ status: 'REFUNDED' }).eq('id', sub.id)
        } else {
          // D2C order refund
          const { data: payment } = await supabase
            .from('payments')
            .select('id, order_id')
            .eq('gateway_ref', paymentId)
            .single()

          if (payment) {
            await supabase.from('payments').update({ status: 'REFUNDED' }).eq('id', payment.id)
            if (payment.order_id) {
              await supabase.from('order_timeline').insert({
                order_id: payment.order_id,
                event: 'REFUND_PROCESSED',
                actor: 'razorpay',
                metadata: { amount: amount ? amount / 100 : null },
              })
            }
          }
        }
        break
      }

      default:
        console.log('Unhandled event type:', event.event)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
