import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button } from '../../components/ui'
import { RazorpayCheckout } from '../../components/shared/RazorpayCheckout'
import type { PlanType } from '../../types'
import { useSearchParams } from 'react-router-dom'

const PLANS: {
  key: PlanType
  name: string
  price: number
  period: string
  orders: number
  features: string[]
  highlight?: boolean
}[] = [
  {
    key: 'STARTER',
    name: 'Starter',
    price: 2499,
    period: '/mo',
    orders: 1000,
    features: [
      'Up to 1,000 orders/month',
      '1 warehouse',
      '3 team members',
      'All integrations',
      'RTO scoring',
      'Daily briefs',
    ],
  },
  {
    key: 'GROWTH',
    name: 'Growth',
    price: 4999,
    period: '/mo',
    orders: 3000,
    highlight: true,
    features: [
      'Up to 3,000 orders/month',
      '3 warehouses',
      '5 team members',
      'All integrations',
      'Demand forecast',
      'Daily briefs',
      'Priority support',
    ],
  },
  {
    key: 'SCALE',
    name: 'Scale',
    price: 9999,
    period: '/mo',
    orders: 10000,
    features: [
      'Up to 10,000 orders/month',
      'Unlimited warehouses',
      '15 team members',
      'Custom RTO rules',
      'API access',
      'Dedicated CSM',
      'SLA support',
    ],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: 0,
    period: 'custom',
    orders: 999999,
    features: [
      'Unlimited orders',
      'Unlimited warehouses',
      'Unlimited team members',
      'Custom integrations',
      'On-prem deployment option',
      'White-label available',
      'Enterprise SLA',
    ],
  },
]

export default function Billing() {
  const { currentPlan } = useAppStore()
  const [searchParams] = useSearchParams()
  const planFromUrl = searchParams.get('plan')?.toUpperCase() as PlanType | null
  const defaultSelected = (planFromUrl && PLANS.find(p => p.key === planFromUrl) ? planFromUrl : null) ?? currentPlan ?? 'GROWTH'
  const [selected, setSelected] = useState<PlanType>(defaultSelected)
  const [payStatus, setPayStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const usageOrders = 287
  const planLimit = PLANS.find(p => p.key === currentPlan)?.orders ?? 500
  const usagePct = Math.min(100, (usageOrders / planLimit) * 100)

  const selectedPlan = PLANS.find(p => p.key === selected)!

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Billing & Plans</h1>

      {/* Current usage */}
      <Card className="p-5 max-w-md">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Current Usage</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Orders this month</span>
            <span className="font-semibold text-gray-900">{usageOrders} / {planLimit.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{Math.round(usagePct)}% of plan limit used</p>
        </div>
      </Card>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan
          const isSelected = plan.key === selected

          return (
            <div
              key={plan.key}
              onClick={() => !isCurrent && setSelected(plan.key)}
              className={`relative rounded-2xl border p-5 cursor-pointer transition-all ${
                plan.highlight
                  ? 'border-brand-600 bg-brand-50'
                  : isSelected
                    ? 'border-brand-400 bg-white'
                    : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-brand-600 text-white text-[10px] font-semibold rounded-full">
                  MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-2.5 right-3 px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-semibold rounded-full">
                  CURRENT
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-900 mb-1">{plan.name}</h3>
              <div className="mb-4">
                {plan.price === 0 ? (
                  <span className="text-xl font-bold text-gray-900">Custom</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">₹{plan.price.toLocaleString('en-IN')}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </>
                )}
              </div>

              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle size={12} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-brand-600' : 'text-green-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && (
                <div className={`w-3.5 h-3.5 rounded-full border-2 mt-auto ${
                  isSelected ? 'border-brand-600 bg-brand-600' : 'border-gray-300'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {selected !== currentPlan && (
        <div className="space-y-2">
          {payStatus && (
            <p className={`text-sm font-medium ${payStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {payStatus.message}
            </p>
          )}

          {selectedPlan.key === 'ENTERPRISE' ? (
            <Button variant="secondary" onClick={() => window.open('mailto:hello@xmetrics.app?subject=Enterprise Plan Enquiry', '_blank')}>
              Contact us for Enterprise
            </Button>
          ) : (
            <RazorpayCheckout
              planName={selectedPlan.name}
              amountInRupees={selectedPlan.price}
              onSuccess={(paymentId) =>
                setPayStatus({ ok: true, message: `Payment successful! ID: ${paymentId}` })
              }
              onError={(err) =>
                setPayStatus({ ok: false, message: err })
              }
            />
          )}
        </div>
      )}

      {/* Invoice history placeholder */}
      <Card className="p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Invoice History</h2>
        <div className="text-sm text-gray-400 text-center py-6">
          No invoices yet — billing starts when you upgrade to a paid plan.
        </div>
      </Card>
    </div>
  )
}
