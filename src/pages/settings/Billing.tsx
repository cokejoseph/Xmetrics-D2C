import { useState } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { DEMO_MODE, callAuthEdgeFunction } from '../../lib/supabase'
import { loadRazorpayScript } from '../../lib/razorpay'
import type { RazorpayCheckoutResponse } from '../../lib/razorpay'
import { Card, Button } from '../../components/ui'
import type { PlanType, SubscriptionData } from '../../types'

// ─── Plan definitions ───────────────────────────────────────────────────────

interface PlanDef {
  type: PlanType
  name: string
  price: number | null
  paise: number
  orders: number | null
  team: number | null
  integrations: number | null
  features: string[]
  popular?: boolean
}

const PLANS: PlanDef[] = [
  {
    type: 'STARTER',
    name: 'Starter',
    price: 999,
    paise: 99900,
    orders: 500,
    team: 1,
    integrations: 2,
    features: ['500 orders/month', '1 team member', '2 integrations', 'Core ops dashboard', 'RTO scoring', 'Basic analytics'],
  },
  {
    type: 'GROWTH',
    name: 'Growth',
    price: 2999,
    paise: 299900,
    orders: 3000,
    team: 5,
    integrations: 6,
    features: ['3,000 orders/month', '5 team members', 'All integrations', 'Daily ops briefs', 'Demand forecast', 'Priority support'],
    popular: true,
  },
  {
    type: 'SCALE',
    name: 'Scale',
    price: 7999,
    paise: 799900,
    orders: 15000,
    team: 20,
    integrations: 10,
    features: ['15,000 orders/month', '20 team members', 'All integrations', 'Advanced analytics', 'White-glove onboarding', 'Dedicated support'],
  },
  {
    type: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    paise: 0,
    orders: null,
    team: null,
    integrations: null,
    features: ['Unlimited orders', 'Unlimited team', 'Custom integrations', 'SLA guarantees', 'Custom reporting', 'Dedicated account manager'],
  },
]

const PLAN_RANK: Record<PlanType, number> = { STARTER: 1, GROWTH: 2, SCALE: 3, ENTERPRISE: 4 }

// While the product is in founding/early access we offer a single public plan.
// The full PLANS array stays intact (current-plan lookups, retry-payment, etc.),
// but only these plan types are shown in the upgrade grid.
const VISIBLE_PLAN_TYPES: PlanType[] = ['GROWTH']

// ─── Cancel modal ───────────────────────────────────────────────────────────

const CANCEL_REASONS = [
  'Switching to another tool',
  'Too expensive',
  'Missing features I need',
  'Business closed or paused',
  'Other',
]

// ─── Usage bar ──────────────────────────────────────────────────────────────

function UsageBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  if (limit === null) {
    return (
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">{label}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{used.toLocaleString()} / Unlimited</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-brand-500" style={{ width: '15%' }} />
        </div>
      </div>
    )
  }
  const pct = Math.min(100, Math.round(used / limit * 100))
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-brand-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`font-medium ${pct >= 90 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function Billing() {
  const { subscription, setSubscription, currentBrand } = useAppStore()
  const { user } = useAuthStore()

  const [upgradeLoading, setUpgradeLoading] = useState<PlanType | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])
  const [cancelOther, setCancelOther] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const currentPlanType = subscription?.plan_type ?? null
  const currentRank = currentPlanType ? (PLAN_RANK[currentPlanType] ?? 0) : 0

  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined

  // ── New subscription via Razorpay ─────────────────────────────────────────
  async function handleNewSubscription(plan: PlanDef) {
    if (DEMO_MODE) {
      setStatusMsg({ ok: false, text: 'Payments unavailable in demo mode. Connect Supabase + Razorpay to enable billing.' })
      return
    }
    if (!razorpayKey) {
      setStatusMsg({ ok: false, text: 'Payment gateway not configured. Contact support.' })
      return
    }
    if (!currentBrand) return

    setUpgradeLoading(plan.type)
    setStatusMsg(null)

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setStatusMsg({ ok: false, text: 'Failed to load payment gateway. Check your internet connection.' })
        setUpgradeLoading(null)
        return
      }

      const order = await callAuthEdgeFunction('subscription-create-order', {
        brand_id: currentBrand.id,
        plan_type: plan.type,
      }) as { order_id: string; amount: number; currency: string; key_id: string; plan_name: string; user_email: string; brand_name: string }

      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Xmetrics',
        description: `${order.plan_name} Plan — Monthly`,
        order_id: order.order_id,
        prefill: { email: user?.email ?? order.user_email ?? '' },
        theme: { color: '#1658E3' },
        modal: { ondismiss: () => setUpgradeLoading(null) },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const result = await callAuthEdgeFunction('subscription-verify-payment', {
              razorpay_order_id:  response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              brand_id:           currentBrand.id,
            }) as { success: boolean; plan_type: PlanType; next_renewal_date: string }

            if (result.success) {
              // Refresh usage from server then update store
              try {
                const usage = await callAuthEdgeFunction('subscription-check-usage', { brand_id: currentBrand.id }) as SubscriptionData
                setSubscription(usage)
              } catch {
                // Fall back to a minimal local update
                setSubscription({
                  ...(subscription ?? {} as SubscriptionData),
                  plan_type: plan.type,
                  status: 'ACTIVE',
                  next_renewal_date: result.next_renewal_date,
                  plan_amount_paise: plan.paise,
                  orders_limit: plan.orders,
                  team_limit: plan.team,
                  integrations_limit: plan.integrations,
                  at_order_limit: false,
                  at_capacity: false,
                })
              }
              setStatusMsg({ ok: true, text: `Subscribed to ${plan.name}! Next renewal: ${result.next_renewal_date}.` })
            } else {
              setStatusMsg({ ok: false, text: `Payment verification failed. Contact support with ID: ${response.razorpay_payment_id}` })
            }
          } catch (err) {
            setStatusMsg({ ok: false, text: err instanceof Error ? err.message : 'Verification failed' })
          }
          setUpgradeLoading(null)
        },
      })

      rzp.on('payment.failed', (response: unknown) => {
        const r = response as { error?: { description?: string } }
        setStatusMsg({ ok: false, text: r.error?.description ?? 'Payment failed. Please try a different method.' })
        setUpgradeLoading(null)
      })

      rzp.open()
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
      setUpgradeLoading(null)
    }
  }

  // ── Mid-cycle upgrade (subscription-upgrade) ──────────────────────────────
  async function handleUpgrade(plan: PlanDef) {
    if (DEMO_MODE) {
      setStatusMsg({ ok: false, text: 'Plan changes unavailable in demo mode.' })
      return
    }
    if (!currentBrand) return

    setUpgradeLoading(plan.type)
    setStatusMsg(null)

    try {
      const result = await callAuthEdgeFunction('subscription-upgrade', {
        brand_id:     currentBrand.id,
        new_plan_type: plan.type,
      }) as { success: boolean; new_plan_type: PlanType; pro_rata_paise: number; days_left: number; message: string }

      if (result.success) {
        // Refresh from server
        try {
          const usage = await callAuthEdgeFunction('subscription-check-usage', { brand_id: currentBrand.id }) as SubscriptionData
          setSubscription(usage)
        } catch {
          setSubscription({
            ...(subscription ?? {} as SubscriptionData),
            plan_type: plan.type,
            plan_amount_paise: plan.paise,
            orders_limit: plan.orders,
            team_limit: plan.team,
            integrations_limit: plan.integrations,
            at_order_limit: false,
            at_capacity: false,
          })
        }
        const proRataRs = Math.round(result.pro_rata_paise / 100)
        setStatusMsg({
          ok: true,
          text: proRataRs > 0
            ? `Upgraded to ${plan.name}. Pro-rata charge ₹${proRataRs.toLocaleString('en-IN')} for ${result.days_left} remaining days.`
            : `Upgraded to ${plan.name}.`,
        })
      }
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : 'Upgrade failed. Please try again.' })
    }

    setUpgradeLoading(null)
  }

  // ── Cancel subscription ───────────────────────────────────────────────────
  async function handleCancel() {
    if (DEMO_MODE) {
      setStatusMsg({ ok: false, text: 'Cancellation unavailable in demo mode.' })
      setCancelOpen(false)
      return
    }
    if (!currentBrand) return

    setCancelLoading(true)
    const reason = cancelReason === 'Other' ? (cancelOther.trim() || 'Other') : cancelReason

    try {
      const result = await callAuthEdgeFunction('subscription-cancel', {
        brand_id:            currentBrand.id,
        cancellation_reason: reason,
      }) as { success: boolean; effective_date: string; message: string }

      if (result.success) {
        setSubscription(subscription ? { ...subscription, status: 'CANCELLED', next_renewal_date: null } : null)
        setStatusMsg({ ok: true, text: result.message })
        setCancelOpen(false)
      }
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : 'Cancellation failed. Please try again.' })
    }

    setCancelLoading(false)
  }

  const isActive = subscription?.status === 'ACTIVE' || subscription?.status === 'PAYMENT_FAILED'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Billing</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Manage your subscription and usage</p>
      </div>

      {subscription?.status === 'PAYMENT_FAILED' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Payment failed — your subscription is at risk</p>
            <p className="text-xs mt-0.5 opacity-80">
              We couldn't charge your last payment. Click below to retry with the same or a new payment method.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const plan = PLANS.find(p => p.type === currentPlanType)
              if (plan) handleNewSubscription(plan)
            }}
            className="shrink-0"
          >
            Retry Payment
          </Button>
        </div>
      )}

      {statusMsg && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded border text-sm ${
          statusMsg.ok
            ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400'
        }`}>
          {statusMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="ml-auto opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Current plan + usage ── */}
      {subscription && (
        <Card className="p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {PLANS.find(p => p.type === subscription.plan_type)?.name ?? subscription.plan_type} Plan
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                  subscription.status === 'ACTIVE'         ? 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-400'
                  : subscription.status === 'PAYMENT_FAILED' ? 'text-red-500 bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/30'
                  : subscription.status === 'CANCELLED'    ? 'text-gray-400 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  : 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30'
                }`}>
                  {subscription.status.replace('_', ' ')}
                </span>
              </div>
              {subscription.next_renewal_date && subscription.status !== 'CANCELLED' && (
                <p className="text-xs text-gray-400">
                  Next payment on {new Date(subscription.next_renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {subscription.status === 'CANCELLED' && (
                <p className="text-xs text-gray-400">Subscription cancelled. Data retained for 30 days.</p>
              )}
            </div>
            {subscription.plan_amount_paise > 0 && (
              <div className="text-right">
                <span className="text-lg font-light text-gray-900 dark:text-gray-100">
                  ₹{Math.round(subscription.plan_amount_paise / 100).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-gray-400">/mo</span>
              </div>
            )}
          </div>

          {/* Usage meters */}
          <div className="space-y-3.5">
            <UsageBar
              used={subscription.orders_used}
              limit={subscription.orders_limit}
              label="Orders this month"
            />
            <UsageBar
              used={subscription.team_used}
              limit={subscription.team_limit}
              label="Team members"
            />
            <UsageBar
              used={subscription.integrations_used}
              limit={subscription.integrations_limit}
              label="Integrations"
            />
          </div>

          {/* At-capacity warning */}
          {subscription.at_order_limit && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} />
              <span>Order limit reached. Upgrade your plan to continue accepting orders.</span>
            </div>
          )}

          {/* Cancel link */}
          {isActive && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setCancelOpen(true)}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Cancel subscription
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Plan grid ── */}
      <div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
          {subscription ? 'Available plans' : 'Choose a plan'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.filter(plan => VISIBLE_PLAN_TYPES.includes(plan.type)).map(plan => {
            const isCurrent = plan.type === currentPlanType
            const rank = PLAN_RANK[plan.type]
            const isUpgrade = rank > currentRank
            const isDowngrade = currentPlanType !== null && rank < currentRank
            const isLoading = upgradeLoading === plan.type

            return (
              <Card
                key={plan.type}
                className={`p-4 transition-none ${isCurrent ? 'ring-2 ring-brand-600 ring-offset-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isCurrent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/30 px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                    {plan.popular && !isCurrent && (
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {plan.price !== null ? (
                      <>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">₹{plan.price.toLocaleString('en-IN')}</span>
                        <span className="text-[11px] text-gray-400">/mo</span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Custom</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle size={11} className="mt-0.5 text-green-400 shrink-0" />
                      <span className="text-[12px] text-gray-500 dark:text-gray-400">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="text-[12px] text-gray-400">Your current plan</div>
                ) : plan.type === 'ENTERPRISE' ? (
                  <a
                    href="mailto:sales@xmetrics.in"
                    className="block text-center text-[12px] font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 rounded px-3 py-1.5 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  >
                    Contact Sales
                  </a>
                ) : isDowngrade ? (
                  <div className="text-[11px] text-gray-400 italic">Downgrades require cancelling and resubscribing</div>
                ) : isUpgrade && isActive ? (
                  <Button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isLoading}
                    className="w-full text-[12px] py-1.5"
                  >
                    {isLoading ? 'Upgrading…' : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleNewSubscription(plan)}
                    disabled={isLoading}
                    className="w-full text-[12px] py-1.5"
                  >
                    {isLoading ? 'Opening checkout…' : `Get ${plan.name}`}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Invoice history ── */}
      <Card className="p-5">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Invoice History</p>
        <div className="text-center py-8">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No invoices yet</p>
          <p className="text-[12px] text-gray-400 dark:text-gray-600 mt-1">Invoices will appear here after your first payment is processed.</p>
        </div>
      </Card>

      {/* ── Cancel modal ── */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#1E2840] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cancel Subscription</h2>
                <p className="text-xs text-gray-400 mt-0.5">Your access continues until the current period ends.</p>
              </div>
              <button
                onClick={() => setCancelOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-4"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Reason for cancelling
                </label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-[#141C28] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CANCEL_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              {cancelReason === 'Other' && (
                <textarea
                  value={cancelOther}
                  onChange={e => setCancelOther(e.target.value)}
                  placeholder="Please tell us more…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-[#141C28] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCancelOpen(false)}
                className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
              >
                {cancelLoading ? 'Cancelling…' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
