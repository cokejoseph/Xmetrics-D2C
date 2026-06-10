import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { loadRazorpayScript } from '../../lib/razorpay'
import type { RazorpayCheckoutResponse } from '../../lib/razorpay'
import { Button } from '../ui'

interface RazorpayCheckoutProps {
  planName: string
  amountInRupees: number
  onSuccess?: (paymentId: string) => void
  onError?: (error: string) => void
  className?: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

async function callEdgeFunction(name: string, body: object) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase not configured')
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `Edge function ${name} failed (${res.status})`)
  return json
}

export function RazorpayCheckout({
  planName,
  amountInRupees,
  onSuccess,
  onError,
  className,
}: RazorpayCheckoutProps) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      onError?.('Payments are unavailable in demo mode. Connect Supabase to enable billing.')
      return
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
    if (!razorpayKey) {
      onError?.('Payment gateway not configured. Contact support.')
      return
    }

    setLoading(true)

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        onError?.('Failed to load payment gateway. Check your internet connection.')
        setLoading(false)
        return
      }

      // Step 1 — create Razorpay order
      const order = await callEdgeFunction('razorpay-create-order', {
        amount: amountInRupees * 100,
        currency: 'INR',
        receipt: `centinal_${planName.toLowerCase()}_${Date.now()}`,
      })

      // Step 2 — open Razorpay checkout modal
      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Centinal',
        description: `${planName} Plan — Monthly`,
        order_id: order.order_id,
        prefill: { email: user?.email ?? '' },
        theme: { color: '#4F46E5' },
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            // Step 3 — verify signature
            const result = await callEdgeFunction('razorpay-verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })

            if (!result.verified) {
              onError?.(
                `Payment verification failed. Contact support with payment ID: ${response.razorpay_payment_id}`
              )
              setLoading(false)
              return
            }

            setLoading(false)
            onSuccess?.(response.razorpay_payment_id)
          } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Verification failed')
            setLoading(false)
          }
        },
      })

      rzp.on('payment.failed', (response: unknown) => {
        const r = response as { error?: { description?: string } }
        onError?.(r.error?.description ?? 'Payment failed. Please try a different payment method.')
        setLoading(false)
      })

      rzp.open()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading} className={className}>
      {loading ? 'Opening checkout…' : `Upgrade to ${planName}`}
    </Button>
  )
}
