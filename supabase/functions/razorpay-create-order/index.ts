import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency = 'INR', receipt, email, plan } = await req.json()

    if (!amount || amount < 100) {
      return new Response(
        JSON.stringify({ error: 'Amount must be at least 100 paise (₹1)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const auth = btoa(`${keyId}:${keySecret}`)

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: receipt ?? `xm_${Date.now()}`,
        // Attach email + plan in notes so webhook can identify subscription payments
        notes: {
          ...(email ? { email } : {}),
          ...(plan  ? { plan  } : {}),
        },
      }),
    })

    if (!rzpResponse.ok) {
      const err = await rzpResponse.json()
      return new Response(
        JSON.stringify({ error: err.error?.description ?? 'Razorpay order creation failed' }),
        { status: rzpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const order = await rzpResponse.json()

    // If this is a plan checkout (email + plan provided), pre-create a PENDING subscription row
    if (email && plan) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await supabase.from('subscriptions').upsert({
        email: email.toLowerCase().trim(),
        plan,
        razorpay_order_id: order.id,
        amount: amount / 100,
        status: 'PENDING',
      }, { onConflict: 'razorpay_order_id' })
    }

    return new Response(
      JSON.stringify({ order_id: order.id, amount: order.amount, currency: order.currency }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
