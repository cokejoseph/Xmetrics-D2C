import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RTOScoreRequest {
  order_id?: string
  payment_method: string
  pincode: string
  customer_id?: string
  order_value: number
  brand_id: string
}

function getPincodeTier(pincode: string): 'T1' | 'T2' | 'T3' {
  const prefix = pincode.slice(0, 2)
  const T1 = ['11', '40', '56', '60', '70', '50']
  const T2 = ['20', '21', '22', '23', '24', '25', '26', '28', '30', '31', '32', '33', '34', '38', '39', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '57', '58', '59', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83']
  if (T1.includes(prefix)) return 'T1'
  if (T2.includes(prefix)) return 'T2'
  return 'T3'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const body: RTOScoreRequest = await req.json()
    const { payment_method, pincode, customer_id, order_value, brand_id } = body

    let score = 0
    const factors: string[] = []

    // Payment method
    if (payment_method === 'COD') {
      score += 40
      factors.push('COD payment (+40)')
    }

    // Pincode tier
    const tier = getPincodeTier(pincode)
    if (tier === 'T3') {
      score += 20
      factors.push('T3 pincode (+20)')
    } else if (tier === 'T2') {
      score += 10
      factors.push('T2 pincode (+10)')
    }

    // Customer history (fetch from DB)
    if (customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('total_orders, total_spent')
        .eq('id', customer_id)
        .eq('brand_id', brand_id)
        .single()

      if (!customer || customer.total_orders === 0) {
        score += 20
        factors.push('First-time customer (+20)')
      }

      if (customer) {
        const { data: customerOrders } = await supabase
          .from('orders')
          .select('fulfillment_status')
          .eq('customer_id', customer_id)
          .eq('brand_id', brand_id)

        const rtoCount = customerOrders?.filter(o => o.fulfillment_status === 'RTO_INITIATED').length ?? 0
        const totalCount = customerOrders?.length ?? 0
        if (totalCount >= 2) {
          const rtoRate = rtoCount / totalCount
          if (rtoRate >= 0.5) {
            score += 25
            factors.push(`High historical RTO rate ${Math.round(rtoRate * 100)}% (+25)`)
          } else if (rtoRate >= 0.25) {
            score += 15
            factors.push(`Moderate historical RTO rate ${Math.round(rtoRate * 100)}% (+15)`)
          }
        }
      }
    } else {
      score += 20
      factors.push('No customer record (+20)')
    }

    // Order value vs brand AOV
    if (order_value > 0) {
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('gross_amount, discount_amount')
        .eq('brand_id', brand_id)
        .eq('payment_status', 'PAID')
        .limit(100)

      if (recentOrders && recentOrders.length > 0) {
        const avgOrderValue = recentOrders.reduce((s: number, o: any) => s + (o.gross_amount - o.discount_amount), 0) / recentOrders.length
        if (order_value < avgOrderValue * 0.5) {
          score += 10
          factors.push('Order value well below AOV (+10)')
        }
      }
    }

    // Clamp
    score = Math.min(100, Math.max(0, score))

    const level = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'

    return new Response(
      JSON.stringify({ score, level, factors }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
