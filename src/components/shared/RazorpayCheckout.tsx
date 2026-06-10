import { useState } from 'react'
import { supabase } from '../../lib/supabase'
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
    if (!supabase) {
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

      // Step 1 — create Razorpay order via edge function
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: {
          amount: amountInRupees * 100,
          currency: 'INR',
          receipt: `centinal_${planName.toLowerCase()}_${Date.now()}`,
        },
      })

      if (error || !data?.order_id) {
        onError?.(error?.message ?? 'Could not initiate payment. Please try again.')
        setLoading(false)
        return
      }

      // Step 2 — open Razorpay checkout modal
      const client = supabase
      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: data.amount,
        currency: data.currency,
        name: 'Centinal',
        description: `${planName} Plan — Monthly`,
        order_id: data.order_id,
        prefill: { email: user?.email ?? '' },
        theme: { color: '#4F46E5' },
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          // Step 3 — verify signature via edge function
          const { data: vData, error: vError } = await client.functions.invoke(
            'razorpay-verify-payment',
            {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            }
          )

          if (vError || !vData?.verified) {
            onError?.(
              `Payment verification failed. Contact support with payment ID: ${response.razorpay_payment_id}`
            )
            setLoading(false)
            return
          }

          setLoading(false)
          onSuccess?.(response.razorpay_payment_id)
        },
      })

      rzp.on('payment.failed', (response: unknown) => {
        const r = response as { error?: { description?: string } }
        onError?.(r.error?.description ?? 'Payment failed. Please try a different payment method.')
        setLoading(false)
      })

      rzp.open()
    } catch {
      onError?.('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading} className={className}>
      {loading ? 'Opening checkout…' : `Upgrade to ${planName}`}
    </Button>
  )
}
