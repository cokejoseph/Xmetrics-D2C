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
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Verify HMAC-SHA256 signature
    if (signature) {
      const expectedSignature = await hmacSha256Hex(secret, body)
      if (signature !== expectedSignature) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
    }

    const event = JSON.parse(body)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const entity = event.payload?.payment?.entity ?? event.payload?.order?.entity

    switch (event.event) {
      case 'payment.captured': {
        const { razorpay_order_id, id: gateway_txn_id, amount } = entity
        // Resolve our order by razorpay order ID stored in payment gateway_txn_id
        const { data: payment } = await supabase
          .from('payments')
          .select('id, order_id')
          .eq('gateway_txn_id', razorpay_order_id)
          .single()

        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'PAID', gateway_txn_id, settled_at: new Date().toISOString() })
            .eq('id', payment.id)

          if (payment.order_id) {
            await supabase
              .from('orders')
              .update({ payment_status: 'PAID' })
              .eq('id', payment.order_id)

            await supabase.from('order_timeline').insert({
              order_id: payment.order_id,
              event: 'PAYMENT_CAPTURED',
              actor: 'razorpay',
              metadata: { gateway_txn_id, amount: amount / 100 },
            })
          }
        }
        break
      }

      case 'payment.failed': {
        const { razorpay_order_id, error_description } = entity
        const { data: payment } = await supabase
          .from('payments')
          .select('id, order_id, brand_id')
          .eq('gateway_txn_id', razorpay_order_id)
          .single()

        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'FAILED' })
            .eq('id', payment.id)

          if (payment.order_id) {
            await supabase
              .from('orders')
              .update({ payment_status: 'FAILED' })
              .eq('id', payment.order_id)

            const { data: order } = await supabase
              .from('orders')
              .select('order_number')
              .eq('id', payment.order_id)
              .single()

            await supabase.from('exceptions').insert({
              brand_id: payment.brand_id,
              order_id: payment.order_id,
              type: 'FAILED_PAYMENT',
              severity: 'HIGH',
              status: 'UNRESOLVED',
              title: `Payment failed for order ${order?.order_number ?? payment.order_id}`,
              description: error_description ?? 'Razorpay payment failure',
            })
          }
        }
        break
      }

      case 'refund.processed': {
        const { payment_id, amount } = entity
        const { data: payment } = await supabase
          .from('payments')
          .select('id, order_id')
          .eq('gateway_txn_id', payment_id)
          .single()

        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'REFUNDED' })
            .eq('id', payment.id)

          if (payment.order_id) {
            await supabase.from('order_timeline').insert({
              order_id: payment.order_id,
              event: 'REFUND_PROCESSED',
              actor: 'razorpay',
              metadata: { amount: amount / 100 },
            })
          }
        }
        break
      }
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
