import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Shield, Lock, Zap, Package } from 'lucide-react'
import { loadRazorpayScript } from '../../lib/razorpay'
import { callEdgeFunction, DEMO_MODE } from '../../lib/supabase'

const PLAN_DATA: Record<string, {
  name: string
  price: number
  priceDisplay: string
  period: string
  badge: string | null
  features: string[]
  color: string
}> = {
  STARTER: {
    name: 'Starter',
    price: 2499,
    priceDisplay: '₹2,499',
    period: '/mo',
    badge: null,
    features: [
      'Up to 1,000 orders / month',
      '1 warehouse',
      '3 team members',
      'All integrations (Shopify, Shiprocket, WhatsApp)',
      'RTO scoring & review queue',
      'Daily ops briefs',
    ],
    color: 'brand',
  },
  GROWTH: {
    name: 'Growth',
    price: 4999,
    priceDisplay: '₹4,999',
    period: '/mo',
    badge: 'MOST POPULAR',
    features: [
      'Up to 3,000 orders / month',
      '3 warehouses',
      '5 team members',
      'All integrations (Shopify, Shiprocket, WhatsApp)',
      'RTO scoring & review queue',
      'Demand forecast & pincode intelligence',
      'Daily ops briefs (WhatsApp export)',
      'Priority support',
    ],
    color: 'brand',
  },
  SCALE: {
    name: 'Scale',
    price: 9999,
    priceDisplay: '₹9,999',
    period: '/mo',
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
    color: 'brand',
  },
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const planKey = (searchParams.get('plan') ?? 'GROWTH').toUpperCase()
  const plan = PLAN_DATA[planKey] ?? PLAN_DATA.GROWTH

  const [name, setName] = useState('')
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

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
        amount: plan.price * 100,
        currency: 'INR',
        receipt: `${planKey.toLowerCase()}_${Date.now()}`,
      })

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Xmetrics',
        description: `${plan.name} Plan — Monthly`,
        order_id: order.order_id,
        prefill: { name: name.trim() || undefined, email: email.trim() },
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setLoading(false) },
        handler: async () => {
          setLoading(false)
          setDone(true)
          setTimeout(() => {
            navigate(`/signup?plan=${planKey}&email=${encodeURIComponent(email.trim())}`)
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
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5">
              <img src="/logo.svg" alt="Xmetrics" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">Xmetrics</span>
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to website</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">

          {/* Left — plan details */}
          <div>
            {plan.badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-full mb-6">
                <Zap size={11} className="text-brand-600" />
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">{plan.badge}</span>
              </div>
            )}

            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-2">
              {plan.name} Plan
            </h1>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              Get full access to Xmetrics on the {plan.name} plan. Pay now and create your account immediately after — no trial limits, no waiting.
            </p>

            {/* Price */}
            <div className="mb-8">
              <p className="text-sm text-gray-400 mb-1">Monthly price</p>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold text-gray-900">{plan.priceDisplay}</span>
                <span className="text-lg text-gray-500 mb-1">{plan.period}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Billed monthly · Cancel anytime</p>
            </div>

            {/* Features */}
            <div className="mb-8">
              <p className="text-sm font-semibold text-gray-900 mb-4">What's included:</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="mt-0.5 text-green-500 shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-5 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><Shield size={12} className="text-green-500" /> Secured by Razorpay</span>
              <span className="flex items-center gap-1.5"><Lock size={12} className="text-brand-500" /> Cancel anytime</span>
              <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-500" /> Access in under 5 minutes</span>
            </div>

            {/* Plan switcher */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">Wrong plan? Switch:</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(PLAN_DATA).map(([key, p]) => (
                  <Link
                    key={key}
                    to={`/checkout?plan=${key}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      key === planKey
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
                    }`}
                  >
                    {p.name} — {p.priceDisplay}/mo
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right — checkout form */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8">
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
                    <h2 className="text-xl font-bold text-gray-900">Get {plan.name} access</h2>
                    <p className="text-sm text-gray-500 mt-1">Pay now, create your account immediately after.</p>
                  </div>

                  {/* Price pill */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{plan.name} Plan · Monthly</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">
                        {plan.priceDisplay}<span className="text-sm font-normal text-gray-500">/mo</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Cancel anytime</p>
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
                          <Package size={15} />
                          Pay {plan.priceDisplay} &amp; get access
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                    <Shield size={11} />
                    <span>Secured by Razorpay · UPI, Cards, Netbanking accepted</span>
                  </div>

                  {/* Alternative: try demo first */}
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
