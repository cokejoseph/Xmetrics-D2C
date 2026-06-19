import { useState } from 'react'
import { CheckCircle, Zap } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { DEMO_MODE } from '../../lib/supabase'
import { Card } from '../../components/ui'
import { RazorpayCheckout } from '../../components/shared/RazorpayCheckout'
import { useSearchParams } from 'react-router-dom'

const GROWTH_FEATURES = [
  'Up to 3,000 orders/month',
  '3 warehouses',
  '5 team members',
  'All integrations (Shopify, Shiprocket, WhatsApp)',
  'RTO scoring & review queue',
  'Demand forecast & pincode intelligence',
  'Daily ops briefs (WhatsApp export)',
  'Priority support',
]

const FOUNDING_PRICE_MONTHLY = 2999
const FOUNDING_PRICE_YEARLY  = 2499
const ORIGINAL_PRICE         = 4999

export default function Billing() {
  const { currentPlan } = useAppStore()
  const [searchParams] = useSearchParams()
  const isFoundingAccess = (DEMO_MODE && currentPlan === 'GROWTH') || searchParams.get('founding') === 'true'
  const [yearly, setYearly] = useState(false)
  const [payStatus, setPayStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const foundingPrice = yearly ? FOUNDING_PRICE_YEARLY : FOUNDING_PRICE_MONTHLY
  const yearlyTotal   = FOUNDING_PRICE_YEARLY * 12
  const isOnPlan      = currentPlan === 'GROWTH'

  const usageOrders = 287
  const planLimit   = 3000
  const usagePct    = Math.min(100, (usageOrders / planLimit) * 100)

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-900">Billing</h1>

      {/* Current plan card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900">Growth Plan</p>
              {isOnPlan && (
                <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded">
                  Current plan
                </span>
              )}
              {isFoundingAccess && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap size={9} /> Founding rate
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Locked in for life · Regular price ₹{ORIGINAL_PRICE.toLocaleString('en-IN')}/mo</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-xs transition-colors ${!yearly ? 'text-gray-700' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setYearly(y => !y)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${yearly ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${yearly ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs transition-colors ${yearly ? 'text-gray-700' : 'text-gray-400'}`}>
              Yearly
              {yearly && <span className="ml-1 text-green-600">· save ₹500/mo</span>}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-light text-gray-900">₹{foundingPrice.toLocaleString('en-IN')}</span>
            <span className="text-sm text-gray-400 mb-0.5">/mo</span>
            <span className="text-sm text-gray-300 line-through mb-0.5">₹{ORIGINAL_PRICE.toLocaleString('en-IN')}</span>
          </div>
          {yearly && (
            <p className="text-xs text-gray-400 mt-1">= ₹{yearlyTotal.toLocaleString('en-IN')} billed annually</p>
          )}
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          {GROWTH_FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle size={12} className="mt-0.5 text-green-400 shrink-0" />
              <span className="text-xs text-gray-500">{f}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!isOnPlan && (
          <div className="space-y-2">
            {payStatus && (
              <p className={`text-xs font-medium ${payStatus.ok ? 'text-green-600' : 'text-red-500'}`}>
                {payStatus.message}
              </p>
            )}
            <RazorpayCheckout
              planName="Growth (Founding)"
              amountInRupees={foundingPrice}
              onSuccess={id => setPayStatus({ ok: true, message: `Payment successful — ${id}` })}
              onError={err => setPayStatus({ ok: false, message: err })}
            />
          </div>
        )}
        {isOnPlan && (
          <p className="text-xs text-gray-400">You're on the Growth Founding plan. No action needed.</p>
        )}
      </Card>

      {/* Usage */}
      <Card className="p-5">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-4">Usage this month</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Orders</span>
            <span className="font-medium text-gray-700">{usageOrders.toLocaleString()} / {planLimit.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${usagePct > 80 ? 'bg-red-400' : usagePct > 60 ? 'bg-amber-400' : 'bg-brand-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{Math.round(usagePct)}% of monthly limit</p>
        </div>
      </Card>

      {/* Invoices */}
      <Card className="p-5">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-4">Invoice History</p>
        <p className="text-sm text-gray-400 text-center py-4">No invoices yet.</p>
      </Card>
    </div>
  )
}
