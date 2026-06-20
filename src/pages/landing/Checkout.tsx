import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BeamsBackground } from '@/components/ui/beams-background'
import { Check, Shield, Zap, Lock } from 'lucide-react'
import { loadRazorpayScript } from '../../lib/razorpay'
import { callEdgeFunction, DEMO_MODE } from '../../lib/supabase'

type BillingCycle = 'MONTHLY' | 'YEARLY'

const PLAN_DATA: Record<string, {
  name: string
  monthlyPrice: number
  originalMonthlyPrice?: number
  badge: string | null
  features: string[]
}> = {
  STARTER: {
    name: 'Starter',
    monthlyPrice: 999,
    badge: null,
    features: [
      'Up to 1,000 orders / month',
      '1 warehouse',
      '3 team members',
      'All integrations (Shopify, Shiprocket, WhatsApp)',
      'RTO scoring & review queue',
      'Daily ops briefs',
    ],
  },
  GROWTH: {
    name: 'Growth',
    monthlyPrice: 2999,
    originalMonthlyPrice: 4999,
    badge: 'FOUNDING ACCESS',
    features: [
      'Up to 3,000 orders / month',
      '1 warehouse',
      '5 team members',
      'All integrations (Shopify, Shiprocket, WhatsApp)',
      'RTO scoring & review queue',
      'Demand forecast & pincode intelligence',
      'Daily ops briefs (WhatsApp export)',
      'Priority support',
    ],
  },
  SCALE: {
    name: 'Scale',
    monthlyPrice: 7999,
    badge: null,
    features: [
      'Up to 10,000 orders / month',
      'Unlimited warehouses',
      '15 team members',
      'All integrations + API access',
      'Custom RTO rules',
      'Demand forecast & pincode intelligence',
      'Daily ops briefs (WhatsApp export)',
      'Dedicated Customer Success Manager',
      'SLA support',
    ],
  },
}

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const planKey = (searchParams.get('plan') ?? 'GROWTH').toUpperCase()
  const plan = PLAN_DATA[planKey] ?? PLAN_DATA.GROWTH

  const [billing, setBilling] = useState<BillingCycle>('MONTHLY')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const monthlyPrice  = plan.monthlyPrice          // ₹2,999/mo
  const yearlyMonthly = monthlyPrice - 500          // ₹2,499/mo when annual
  const yearlyPrice   = yearlyMonthly * 12          // ₹29,988/yr (actual charge)
  const yearlySaving  = monthlyPrice * 12 - yearlyPrice  // ₹6,000 saved vs monthly

  const activePrice   = billing === 'MONTHLY' ? monthlyPrice : yearlyPrice  // for payment
  const displayPrice  = billing === 'MONTHLY' ? monthlyPrice : yearlyMonthly // always show /mo

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)

    if (DEMO_MODE) {
      setLoading(false)
      setError('Live payments require the Supabase backend to be connected. Add your Razorpay keys in Vercel to enable billing.')
      return
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
    if (!razorpayKey) {
      setLoading(false)
      setError('Payment gateway not yet configured. Please check back shortly or contact us at hello@xmetrics.app')
      return
    }

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { setError('Could not load payment gateway. Check your internet connection.'); setLoading(false); return }

      const order = await callEdgeFunction('razorpay-create-order', {
        amount: activePrice * 100,
        currency: 'INR',
        receipt: `${planKey.toLowerCase()}_${billing.toLowerCase()}_${Date.now()}`,
        email: email.trim(),
        plan: planKey,
        billing_cycle: billing,
      })

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Xmetrics',
        description: `${plan.name} Plan — ${billing === 'MONTHLY' ? 'Monthly' : 'Yearly (2 months free)'}`,
        order_id: order.order_id,
        prefill: { name: name.trim() || undefined, email: email.trim() },
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // Verify HMAC signature server-side before granting access
          try {
            const verified = await callEdgeFunction('razorpay-verify-payment', {
              razorpay_order_id:  response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }) as { verified?: boolean } | null
            if (!verified?.verified) throw new Error('Signature mismatch')
          } catch {
            setError('Payment signature verification failed. Your payment was captured. Please contact hello@xmetrics.app with your email and we will activate your account.')
            setLoading(false)
            return
          }
          setLoading(false)
          setDone(true)
          setTimeout(() => {
            navigate(`/signup?plan=${planKey}&billing=${billing}&email=${encodeURIComponent(email.trim())}`)
          }, 2000)
        },
      })

      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again or use UPI.')
        setLoading(false)
      })

      rzp.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1230] relative overflow-hidden">
      <BeamsBackground intensity="subtle" />
      {/* Top bar */}
      <div className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5">
              <img src="/logo.svg" alt="Xmetrics" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-white text-lg">Xmetrics</span>
          </Link>
          <Link to="/" className="text-sm text-white/60 hover:text-white transition-colors">← Back to website</Link>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">

          {/* Left — plan details */}
          <div>
            {plan.badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full mb-6">
                <Zap size={11} className="text-white/80" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">{plan.badge}</span>
              </div>
            )}

            <h1 className="text-4xl font-bold text-white leading-tight mb-2">
              {plan.name} Plan
            </h1>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              Get full access to Xmetrics on the {plan.name} plan. Pay now and create your account immediately after. No trial limits, no waiting.
            </p>

            {/* Billing toggle */}
            <div className="mb-8">
              <div className="inline-flex items-center bg-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setBilling('MONTHLY')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    billing === 'MONTHLY'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('YEARLY')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    billing === 'YEARLY'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  Yearly
                  <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
                    SAVE ₹500/MO
                  </span>
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="mb-8">
              {plan.originalMonthlyPrice && (
                <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-full px-3 py-1 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">Founding rate: locked at this price for life</span>
                </div>
              )}
              {/* Big monthly-equivalent price */}
              <div className="flex items-end gap-3">
                <span className="text-6xl font-bold text-white">{formatINR(displayPrice)}</span>
                <div className="mb-1.5 flex flex-col items-start gap-0.5">
                  {plan.originalMonthlyPrice && (
                    <span className="text-sm text-white/30 line-through">{formatINR(plan.originalMonthlyPrice)}</span>
                  )}
                  <span className="text-lg text-white/60">/mo</span>
                </div>
              </div>

              {/* Yearly total below */}
              {billing === 'YEARLY' ? (
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm font-semibold text-white/80">= {formatINR(yearlyPrice)} billed annually</p>
                  <p className="text-sm text-green-400 font-medium">Save {formatINR(yearlySaving)}/yr vs monthly</p>
                </div>
              ) : (
                <p className="text-sm text-white/40 mt-2">
                  Switch to yearly — save {formatINR(yearlySaving)}/yr (₹500/mo off)
                </p>
              )}
            </div>

            {/* Features */}
            <div className="mb-8">
              <p className="text-sm font-semibold text-white mb-4">What's included:</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 text-green-400 shrink-0" />
                    <span className="text-sm text-white/70">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-5 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><Shield size={12} className="text-green-400" /> Secured by Razorpay</span>
              <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Access in under 5 minutes</span>
            </div>

          </div>

          {/* Right — checkout form */}
          <div className="lg:sticky lg:top-8">
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* Brand accent stripe */}
              <div className="h-[3px] bg-gradient-to-r from-brand-500 via-sky-400 to-brand-400" />
              <div className="p-8">
              {done ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment confirmed!</h3>
                  <p className="text-sm text-gray-500 mb-4">Setting up your account now…</p>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: '100%', transition: 'width 2s linear' }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-1.5 bg-brand-50 border border-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      {plan.name} Plan
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Get {plan.name} access</h2>
                    <p className="text-sm text-gray-500 mt-1">Pay now, create your account immediately after.</p>
                  </div>

                  {/* Founding access banner */}
                  {plan.originalMonthlyPrice && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-xs text-amber-700 font-medium flex-1">Founding rate: locked at ₹2,999/mo for life</p>
                      <span className="text-xs font-bold text-amber-600 shrink-0">8 spots left</span>
                    </div>
                  )}

                  {/* Price pill */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">
                        {plan.name} Plan · {billing === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                        {billing === 'YEARLY' && (
                          <span className="ml-2 text-green-600 font-semibold">Save ₹500/mo</span>
                        )}
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatINR(displayPrice)}<span className="text-sm font-normal text-gray-500">/mo</span>
                        </p>
                        {plan.originalMonthlyPrice && (
                          <span className="text-sm text-gray-300 line-through">
                            {formatINR(plan.originalMonthlyPrice)}/mo
                          </span>
                        )}
                      </div>
                      {billing === 'YEARLY' && (
                        <p className="text-xs text-gray-500 mt-0.5">= {formatINR(yearlyPrice)}/yr billed annually</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Razorpay secured</p>
                    </div>
                  </div>

                  <form onSubmit={handlePay} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@yourstore.com"
                        required
                        autoFocus
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Opening payment…
                        </>
                      ) : (
                        <>
                          <Lock size={14} />
                          Pay {formatINR(activePrice)} &amp; get access
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Shield size={10} className="text-green-500" /> Razorpay secured</span>
                    <span className="text-gray-200">|</span>
                    <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Cancel anytime</span>
                    <span className="text-gray-200">|</span>
                    <span className="flex items-center gap-1"><Zap size={10} className="text-amber-400" /> 5-min setup</span>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 mb-2">Not ready to pay yet?</p>
                    <Link
                      to="/login"
                      className="text-xs text-brand-600 hover:underline font-medium"
                    >
                      Try the demo first →
                    </Link>
                  </div>
                </>
              )}
              </div>
            </div>

            <p className="text-xs text-center text-gray-400 mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
