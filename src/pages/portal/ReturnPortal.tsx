import { useState, useEffect } from 'react'
import { CheckCircle2, Package, ArrowRight, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import type { ReturnReason } from '../../types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalOrderItem {
  id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
}

interface PortalOrder {
  order_number: string
  customer_name: string
  delivered_at: string
  payment_method: 'COD' | 'UPI' | 'CARD' | 'PREPAID'
  items: PortalOrderItem[]
  amount: number
}

// ─── Demo lookup ──────────────────────────────────────────────────────────────

const DEMO_ITEMS: PortalOrderItem[] = [
  { id: 'i1', name: 'Whey Protein — Chocolate (1 kg)',     sku: 'WPC-CHOC-1KG', quantity: 1, unit_price: 1499 },
  { id: 'i2', name: 'Premium Black Pepper (100 g)',         sku: 'BPP-100G',     quantity: 2, unit_price: 179  },
  { id: 'i3', name: 'Marine Collagen Peptides (250 g)',     sku: 'MCP-250G',     quantity: 1, unit_price: 799  },
]

async function lookupOrder(
  orderNumber: string,
  email: string
): Promise<{ order: PortalOrder | null; error: string | null }> {
  await new Promise(r => setTimeout(r, 900))

  if (!orderNumber.trim() || !email.includes('@')) {
    return { order: null, error: 'Please enter a valid order number and email address.' }
  }

  if (!orderNumber.trim().toUpperCase().startsWith('ZF-')) {
    return { order: null, error: 'Order not found. Check your order number and email, then try again.' }
  }

  // Demo: accept any ZF-XXXX order + valid email
  const itemCount = (orderNumber.charCodeAt(orderNumber.length - 1) % 3) + 1
  const demoItems = DEMO_ITEMS.slice(0, itemCount)
  const amount = demoItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const daysAgo = 3 + (orderNumber.charCodeAt(3) % 10)
  const methods: PortalOrder['payment_method'][] = ['COD', 'UPI', 'CARD', 'PREPAID']

  return {
    order: {
      order_number: orderNumber.toUpperCase(),
      customer_name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      delivered_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      payment_method: methods[orderNumber.charCodeAt(orderNumber.length - 2) % 4],
      items: demoItems,
      amount,
    },
    error: null,
  }
}

async function submitReturn(
  order: PortalOrder,
  selectedItems: string[],
  reason: ReturnReason,
  comment: string
): Promise<{ returnId: string; error: string | null }> {
  await new Promise(r => setTimeout(r, 1100))
  void order; void selectedItems; void reason; void comment
  return {
    returnId: `RET-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    error: null,
  }
}

// ─── Reason config ────────────────────────────────────────────────────────────

const REASONS: { value: ReturnReason; label: string; sub: string }[] = [
  { value: 'damaged',      label: 'Damaged on arrival',        sub: 'Product arrived broken or damaged' },
  { value: 'wrong_item',   label: 'Wrong item received',        sub: "I received something I didn't order" },
  { value: 'defective',    label: 'Defective / doesn\'t work', sub: 'Product stopped working or has a defect' },
  { value: 'changed_mind', label: 'Changed my mind',           sub: 'I no longer need this item' },
  { value: 'size_issue',   label: 'Size / fit issue',           sub: 'Does not fit as expected' },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Verify order', 'Select items', 'Confirmed']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                done
                  ? 'bg-brand-600 text-white'
                  : active
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? <CheckCircle2 size={16} /> : num}
              </div>
              <span className={`text-[11px] mt-1.5 whitespace-nowrap ${active ? 'text-brand-700 font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${done ? 'bg-brand-600' : 'bg-gray-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main portal ──────────────────────────────────────────────────────────────

export default function ReturnPortal() {
  useEffect(() => { document.title = 'Return Request · Xmetrics' }, [])

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [order, setOrder] = useState<PortalOrder | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [reason, setReason] = useState<ReturnReason>('damaged')
  const [comment, setComment] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [returnId, setReturnId] = useState<string | null>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLookupLoading(true)
    setLookupError(null)
    const { order: found, error } = await lookupOrder(orderNumber, email)
    setLookupLoading(false)
    if (error || !found) { setLookupError(error ?? 'Order not found'); return }
    const daysDelivered = (Date.now() - new Date(found.delivered_at).getTime()) / 86400000
    if (daysDelivered > 30) {
      setLookupError('This order is outside the 30-day return window.')
      return
    }
    setOrder(found)
    setSelectedItems(found.items.map(i => i.id))
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) return
    setSubmitLoading(true)
    const { returnId: id, error } = await submitReturn(order!, selectedItems, reason, comment)
    setSubmitLoading(false)
    if (error) return
    setReturnId(id)
    setStep(3)
  }

  const handleReset = () => {
    setStep(1); setOrder(null); setOrderNumber(''); setEmail('')
    setSelectedItems([]); setReason('damaged'); setComment('')
    setReturnId(null); setLookupError(null)
  }

  const toggleItem = (id: string) =>
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const deliveryDaysAgo = order
    ? Math.round((Date.now() - new Date(order.delivered_at).getTime()) / 86400000)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <RotateCcw size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">Returns Portal</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Powered by Xmetrics</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <Steps current={step} />

        {/* ── Step 1: Order lookup ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-gray-900">Return an item</h1>
              <p className="text-sm text-gray-500 mt-1">Enter your order number and email to get started.</p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Order number</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  placeholder="e.g. ZF-2026-068"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                />
                <p className="text-[11px] text-gray-400 mt-1">Found in your order confirmation email</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                />
              </div>

              {lookupError && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading || !orderNumber || !email}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lookupLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Looking up your order…</>
                  : <><ArrowRight size={15} /> Find my order</>
                }
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-50 text-center">
              <p className="text-xs text-gray-400">
                Returns are accepted within <span className="font-medium text-gray-600">30 days</span> of delivery.
                Questions? Email <span className="font-medium text-gray-600">support@zestifyfoods.com</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Select items + reason ─────────────────────────────────── */}
        {step === 2 && order && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Order</p>
                  <p className="text-base font-semibold text-gray-900 mt-0.5">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Delivered {deliveryDaysAgo} day{deliveryDaysAgo !== 1 ? 's' : ''} ago</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">₹{order.amount.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Hi <span className="font-medium text-gray-900">{order.customer_name}</span> — select the items you'd like to return.
              </p>
            </div>

            {/* Item selection */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Which items are you returning?</h2>
              <div className="space-y-2.5">
                {order.items.map(item => {
                  const checked = selectedItems.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-0.5 accent-brand-600 w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-gray-900">₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</p>
                        {item.quantity > 1 && <p className="text-[11px] text-gray-400">× {item.quantity}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
              {selectedItems.length === 0 && (
                <p className="text-xs text-red-600 mt-2">Please select at least one item to return.</p>
              )}
            </div>

            {/* Reason */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Why are you returning?</h2>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      reason === r.value
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="mt-0.5 accent-brand-600 w-4 h-4 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{r.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Additional comments <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  placeholder="Describe the issue in more detail…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Refund info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
              <p className="font-medium text-blue-800">
                {order.payment_method === 'COD'
                  ? 'COD order — refund will be via bank transfer or UPI within 5–7 business days'
                  : 'Refund will be credited to your original payment method within 5–7 business days'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitLoading || selectedItems.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                  : <><CheckCircle2 size={15} /> Submit Return Request</>
                }
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Confirmation ───────────────────────────────────────────── */}
        {step === 3 && returnId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-5">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Return request submitted!</h1>
            <p className="text-sm text-gray-500 mb-6">
              We'll review your request and send you next steps within 24 hours.
            </p>

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
              <p className="text-xs text-gray-400 mb-1">Your return ID</p>
              <p className="text-base font-bold font-mono text-gray-900">{returnId}</p>
              <p className="text-[11px] text-gray-400 mt-1">Save this for tracking your return</p>
            </div>

            <div className="text-left space-y-3 mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">What happens next</p>
              {[
                { step: '1', text: 'We review your request', sub: 'Within 24 hours' },
                { step: '2', text: 'Return label sent to your email', sub: 'Once approved' },
                { step: '3', text: 'Drop off or schedule pickup', sub: 'Instructions in the email' },
                { step: '4', text: 'Refund processed', sub: '5–7 business days after we receive the item' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[11px] font-bold text-brand-700 shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.text}</p>
                    <p className="text-[11px] text-gray-400">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Package size={14} /> Return another item
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
