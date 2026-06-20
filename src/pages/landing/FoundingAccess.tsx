import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Shield, Zap, Users, Package, Lock } from 'lucide-react'
import { loadRazorpayScript } from '../../lib/razorpay'
import { callEdgeFunction } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/supabase'

const FOUNDING_PRICE = 2999
const REGULAR_PRICE = 4999
const TOTAL_SPOTS = 45

const FEATURES = [
  'Up to 3,000 orders / month',
  '3 warehouses',
  '5 team members',
  'All integrations (Shopify, Shiprocket, WhatsApp)',
  'RTO scoring & review queue',
  'Demand forecast & pincode intelligence',
  'Daily ops briefs (WhatsApp export)',
  'Priority support',
  'Direct access to the founder for feedback',
]

export default function FoundingAccess() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
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
      setError('Live payments require the Supabase backend to be connected. On the deployed site, this opens Razorpay checkout.')
      return
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
    if (!razorpayKey) { setError('Payment gateway not ready. Please try again shortly.'); setLoading(false); return }

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { setError('Could not load payment gateway. Check your internet connection.'); setLoading(false); return }

      const order = await callEdgeFunction('razorpay-create-order', {
        amount: FOUNDING_PRICE * 100,
        currency: 'INR',
        receipt: `founding_${Date.now()}`,
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        email: email.trim(),
      })

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Xmetrics — Founding Access',
        description: `Growth Plan (Founder) — ₹${FOUNDING_PRICE}/mo for life`,
        order_id: order.order_id,
        prefill: { name: name.trim() || undefined, email: email.trim() },
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // Save payment details to sessionStorage so Onboarding can activate the subscription
          // once the brand is created and we have a brand_id
          sessionStorage.setItem('xmetrics-pending-payment', JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }))
          sessionStorage.setItem('xmetrics-pending-plan', 'GROWTH')
          sessionStorage.setItem('xmetrics-founding', 'true')
          setLoading(false)
          setDone(true)
          setTimeout(() => {
            navigate(`/signup?plan=GROWTH&founding=true&email=${encodeURIComponent(email.trim())}`)
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

          {/* Left — offer details */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Founding Access · Only {TOTAL_SPOTS} spots</span>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              Run your D2C ops like a<br />
              <span className="text-brand-600">well-oiled machine</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              Xmetrics gives D2C brands a single command centre for orders, RTO, fulfillment, and daily ops intelligence. As a founding member, you lock in Growth plan pricing forever, at 40% off the regular price.
            </p>

            {/* Price comparison */}
            <div className="flex items-end gap-4 mb-8">
              <div>
                <p className="text-sm text-gray-400 mb-1">Founding price</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-gray-900">₹{FOUNDING_PRICE.toLocaleString('en-IN')}</span>
                  <span className="text-lg text-gray-500 mb-1">/mo</span>
                </div>
                <p className="text-sm text-green-600 font-medium mt-1">Locked in for life</p>
              </div>
              <div className="mb-3 pb-1 border-l border-gray-200 pl-4">
                <p className="text-sm text-gray-400 mb-1">Regular price</p>
                <p className="text-2xl font-semibold text-gray-300 line-through">₹{REGULAR_PRICE.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* What's included */}
            <div className="mb-8">
              <p className="text-sm font-semibold text-gray-900 mb-4">Everything in the Growth plan:</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {FEATURES.map((f, i) => (
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
              <span className="flex items-center gap-1.5"><Lock size={12} className="text-brand-500" /> Price locked forever</span>
              <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-500" /> Setup in under 5 minutes</span>
              <span className="flex items-center gap-1.5"><Users size={12} className="text-purple-500" /> Join {TOTAL_SPOTS} founders</span>
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
                    <div className="h-full bg-brand-600 rounded-full animate-[progress_2s_linear_forwards]" style={{ width: '100%' }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Reserve your founding spot</h2>
                    <p className="text-sm text-gray-500 mt-1">Pay once, get access immediately. Cancel anytime.</p>
                  </div>

                  {/* Pricing pill */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700 font-medium">Growth Plan · Founding price</p>
                      <p className="text-2xl font-bold text-amber-900 mt-0.5">₹{FOUNDING_PRICE.toLocaleString('en-IN')}<span className="text-sm font-normal text-amber-700">/mo</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 line-through">₹{REGULAR_PRICE.toLocaleString('en-IN')}/mo</p>
                      <p className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-1">40% OFF</p>
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
                          Pay ₹{FOUNDING_PRICE.toLocaleString('en-IN')} &amp; claim spot
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                    <Shield size={11} />
                    <span>Secured by Razorpay · UPI, Cards, Netbanking accepted</span>
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
