import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import {
  TrendingDown, Package, Zap, BarChart3, Bell, MessageSquare,
  Check, ChevronDown, ChevronUp, ArrowRight, Shield, Clock,
  Truck, ShoppingCart, AlertTriangle, BarChart2, Users,
} from 'lucide-react'

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How does the RTO scoring actually work?',
    a: 'Centinal analyses pincode delivery history, address quality, phone signal strength, COD patterns, and customer history. Each order gets a risk score (0–100) that maps to Ship (green), Verify (yellow), or Hold (red). This happens instantly on order creation.',
  },
  {
    q: 'When do I get access?',
    a: "Founding customers get access within 48 hours. You'll get a dedicated onboarding call to sync your Shopify store and Shiprocket account. Full training included.",
  },
  {
    q: 'Which platforms do you integrate with?',
    a: 'Centinal connects with Shopify (orders + products), Shiprocket (fulfillment + tracking), Razorpay (payments + settlements), and WhatsApp Business (alerts + daily brief). More integrations are on the roadmap.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest. We are hosted on Supabase (AWS), with row-level security ensuring each brand can only access its own data. We never share or sell your data.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. No lock-ins, no cancellation fees. You can cancel your subscription at any time from the Billing settings page. Your data remains accessible for 30 days after cancellation.',
  },
  {
    q: 'Do you offer a free trial?',
    a: "Yes — use the live demo to explore the full app with real-looking seed data before signing up. When you're ready, the Starter plan gives you 14 days free to try with your own store data.",
  },
]

// ─── Pricing plans ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Growth',
    price: '₹4,999',
    period: '/mo',
    orders: '3,000 orders/mo',
    highlight: true,
    features: [
      'Up to 3,000 orders / month',
      '3 warehouses',
      '5 team members',
      'All integrations',
      'Reorder engine',
      'Demand forecast',
      'Daily briefs',
      'Priority support',
    ],
  },
  {
    name: 'Scale',
    price: '₹9,999',
    period: '/mo',
    orders: '10,000 orders/mo',
    highlight: false,
    features: [
      'Up to 10,000 orders / month',
      'Unlimited warehouses',
      '15 team members',
      'Custom RTO rules',
      'API access',
      'Dedicated CSM',
      'SLA support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    orders: 'Unlimited',
    highlight: false,
    features: [
      'Unlimited orders',
      'Unlimited warehouses & team',
      'Custom integrations',
      'On-prem deployment option',
      'White-label available',
      'Enterprise SLA',
    ],
  },
]

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border border-gray-100 rounded-2xl overflow-hidden cursor-pointer"
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        {open
          ? <ChevronUp size={16} className="shrink-0 text-brand-600" />
          : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
      </div>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
          <div className="pt-3">{a}</div>
        </div>
      )}
    </div>
  )
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { loginAsDemo } = useAuthStore()
  const { bootstrap } = useAppStore()

  const handleDemo = () => {
    loginAsDemo()
    bootstrap('user-demo-001')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">Centinal</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-500 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 bg-brand-gradient text-white relative overflow-hidden">
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium mb-8">
            <Zap size={12} className="text-brand-300" />
            Built for Indian D2C brands
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            The Operations Command&nbsp;Centre
            <br />
            <span className="text-brand-300">for D2C Brands</span>
          </h1>

          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop losing 30% of revenue to RTO. Centinal gives you real-time order intelligence,
            automated exception alerts, and AI-powered RTO prevention — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors shadow-lg text-sm"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <button
              onClick={handleDemo}
              className="flex items-center gap-2 bg-white/10 border border-white/25 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              View Live Demo →
            </button>
          </div>

          <p className="mt-5 text-white/40 text-xs">No credit card required · 14-day free trial · Cancel anytime</p>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────────────── */}
      <section className="bg-gray-950 text-white py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '35%', label: 'Avg RTO reduction' },
            { value: '₹2.4L', label: 'Saved per 1,000 orders' },
            { value: '8 min', label: 'Daily ops review' },
            { value: '99.9%', label: 'Platform uptime' },
          ].map(s => (
            <div key={s.value}>
              <p className="text-3xl font-bold text-brand-400 mb-1">{s.value}</p>
              <p className="text-sm text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Running a D2C brand on 6 different tabs?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Most brands cobble together Shopify, Shiprocket, Razorpay, WhatsApp, and Excel.
              It works — until it doesn't.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: <ShoppingCart size={20} className="text-red-500" />,
                title: 'No unified order view',
                desc: 'Order status lives in Shopify, tracking in Shiprocket, payment in Razorpay. You switch tabs 40 times a day.',
              },
              {
                icon: <TrendingDown size={20} className="text-orange-500" />,
                title: 'RTO decisions are guesswork',
                desc: 'You accept every COD order and absorb 25–35% returns. No data, no scoring, no way to stop it.',
              },
              {
                icon: <AlertTriangle size={20} className="text-amber-500" />,
                title: 'Exceptions arrive too late',
                desc: 'Stuck shipments, failed payments, NDR escalations — you find out after the customer complains.',
              },
              {
                icon: <Clock size={20} className="text-blue-500" />,
                title: 'Daily ops take 2+ hours',
                desc: 'Stitching together reports, chasing teams on WhatsApp, manually reconciling returns and COD.',
              },
            ].map(item => (
              <div key={item.title} className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything your ops team needs</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              One platform that connects all your tools and surfaces the right information at the right time.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Shield size={22} className="text-brand-600" />,
                title: 'RTO Intelligence Engine',
                desc: 'Every order scored 0–100 in real time. Ship, Verify, or Hold — before you dispatch.',
              },
              {
                icon: <Package size={22} className="text-brand-600" />,
                title: 'Order Command Centre',
                desc: 'Unified order view across all channels with bulk actions, review queues, and label generation.',
              },
              {
                icon: <MessageSquare size={22} className="text-brand-600" />,
                title: 'Daily Ops Brief',
                desc: 'An 8-minute WhatsApp-ready summary of every important number — revenue, exceptions, fulfillment status.',
              },
              {
                icon: <Bell size={22} className="text-brand-600" />,
                title: 'Exception Management',
                desc: 'Stuck shipments, payment failures, NDR escalations — detected, categorised, and resolved fast.',
              },
              {
                icon: <BarChart3 size={22} className="text-brand-600" />,
                title: 'Reorder & Forecast Engine',
                desc: 'Know which SKUs to reorder before you stock out. Predict demand with 90-day order history.',
              },
              {
                icon: <Truck size={22} className="text-brand-600" />,
                title: 'Fulfillment Workflow',
                desc: '7-stage workflow from Packed → Delivered. Bulk AWB generation, pickup scheduling, and tracking.',
              },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Up and running in 10 minutes</h2>
            <p className="text-gray-500">No dev work, no data migration. Just connect and go.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: '01',
                title: 'Connect your store',
                desc: 'Link Shopify, Shiprocket, and Razorpay using OAuth. No API keys to manage.',
                icon: <ShoppingCart size={20} className="text-brand-600" />,
              },
              {
                step: '02',
                title: 'Every order gets scored',
                desc: 'Centinal immediately scores each order for RTO risk and flags exceptions in real time.',
                icon: <BarChart2 size={20} className="text-brand-600" />,
              },
              {
                step: '03',
                title: 'Run ops in 8 minutes',
                desc: "Open your daily brief, resolve exceptions, approve fulfillment — and you're done.",
                icon: <Zap size={20} className="text-brand-600" />,
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-gray-200" />
                )}
                <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-brand-600 mb-1">{step.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Pay based on order volume. Upgrade or downgrade anytime.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-brand-600 bg-brand-600 text-white shadow-lg'
                    : 'border-gray-100 bg-white'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-400 text-gray-900 text-[10px] font-bold rounded-full tracking-wide">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-5">
                  <h3 className={`font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-end gap-1">
                    <span className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={`text-sm mb-1 ${plan.highlight ? 'text-white/70' : 'text-gray-400'}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>
                    {plan.orders}
                  </p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check
                        size={13}
                        className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-white' : 'text-green-500'}`}
                      />
                      <span className={plan.highlight ? 'text-white/80' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    plan.highlight
                      ? 'bg-white text-brand-600 hover:bg-brand-50'
                      : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Us' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
            <p className="text-gray-500">Still have questions? <a href="mailto:hello@centinal.app" className="text-brand-600 hover:underline">Email us</a></p>
          </div>
          <div className="space-y-3">
            {FAQS.map(faq => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-brand-gradient text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Your ops team deserves better tools.
          </h2>
          <p className="text-white/70 mb-10 text-lg">
            Join 200+ D2C brands already running smarter operations with Centinal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors shadow-lg text-sm"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <button
              onClick={handleDemo}
              className="flex items-center gap-2 bg-white/10 border border-white/25 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              View Live Demo →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">C</span>
                </div>
                <span className="font-semibold text-white">Centinal</span>
              </div>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                Operations command centre for Indian D2C brands. RTO intelligence, order management, and daily ops briefs.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm text-gray-400">
              <div className="space-y-2">
                <a href="#features" className="block hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
              </div>
              <div className="space-y-2">
                <Link to="/signup" className="block hover:text-white transition-colors">Sign Up</Link>
                <Link to="/login" className="block hover:text-white transition-colors">Sign In</Link>
                <a href="mailto:hello@centinal.app" className="block hover:text-white transition-colors">Contact</a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Centinal. All rights reserved.</p>
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>Built for Indian D2C brands</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
