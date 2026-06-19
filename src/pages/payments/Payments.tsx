import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Check } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card } from '../../components/ui'
import { PaymentMethodBadge } from '../../components/shared/StatusBadge'
import { cn } from '../../components/ui'

// ── Reusable pill dropdown ────────────────────────────────────────────────────

interface FilterOption<T extends string> {
  value: T
  label: string
}

function FilterPill<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | ''
  onChange: (v: T | '') => void
  options: FilterOption<T>[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-medium transition-all duration-150',
          value
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700/50 dark:bg-brand-900/20 dark:text-brand-400'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8'
        )}
      >
        {selected?.label ?? placeholder}
        <ChevronDown
          size={13}
          className={`text-current opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-[#1e1e24] border border-gray-100 dark:border-white/[0.08] rounded-xl shadow-lg shadow-black/8 py-1 min-w-[148px] animate-dropdown-in">
          <button
            onClick={() => { onChange('' as T | ''); setOpen(false) }}
            className={cn(
              'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors',
              !value ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {placeholder}
            {!value && <Check size={12} className="text-brand-600" />}
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors',
                value === opt.value
                  ? 'font-medium text-brand-600 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {opt.label}
              {value === opt.value && <Check size={12} className="text-brand-600 dark:text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Payments() {
  const { payments, orders } = useAppStore()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')

  const totalCollected = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
  const codPending = orders.filter(o => o.payment_method === 'COD' && o.payment_status !== 'PAID').length
  const failedCount = payments.filter(p => p.status === 'FAILED').length

  const filtered = payments.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterMethod && p.method !== filterMethod) return false
    return true
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const statusDot: Record<string, string> = {
    PAID: 'bg-green-400', PENDING: 'bg-amber-400', FAILED: 'bg-red-400',
    REFUNDED: 'bg-blue-400', SETTLED: 'bg-green-400',
  }
  const statusText: Record<string, string> = {
    PAID: 'text-green-600', PENDING: 'text-amber-600', FAILED: 'text-red-500',
    REFUNDED: 'text-blue-600', SETTLED: 'text-green-600',
  }
  const statusLabel: Record<string, string> = {
    PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed',
    REFUNDED: 'Refunded', SETTLED: 'Settled',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Payments</h1>
        <div className="flex items-center gap-2">
          <FilterPill
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="All Statuses"
            options={[
              { value: 'PAID', label: 'Paid' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REFUNDED', label: 'Refunded' },
              { value: 'SETTLED', label: 'Settled' },
            ]}
          />
          <FilterPill
            value={filterMethod}
            onChange={setFilterMethod}
            placeholder="All Methods"
            options={[
              { value: 'COD', label: 'COD' },
              { value: 'UPI', label: 'UPI' },
              { value: 'CARD', label: 'Card' },
              { value: 'NETBANKING', label: 'Netbanking' },
              { value: 'WALLET', label: 'Wallet' },
              { value: 'PREPAID', label: 'Prepaid' },
            ]}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Total Collected</p>
          <p className="text-2xl font-semibold text-gray-900">₹{Math.round(totalCollected).toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-600 mt-1">{payments.filter(p => p.status === 'PAID').length} payments</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">COD Pending</p>
          <p className="text-2xl font-semibold text-gray-900">{codPending}</p>
          <p className="text-xs text-amber-600 mt-1">orders awaiting payment</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Failed Payments</p>
          <p className="text-2xl font-semibold text-red-600">{failedCount}</p>
          <p className="text-xs text-gray-500 mt-1">require attention</p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Order</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Gateway Ref</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {filtered.map(payment => {
                const order = orders.find(o => o.id === payment.order_id)
                return (
                  <tr key={payment.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      {order && (
                        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          {order.order_number}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-gray-900">{order?.customer?.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentMethodBadge method={payment.method} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">₹{payment.amount.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[payment.status] ?? 'bg-gray-300'}`} />
                        <span className={`text-[11px] font-medium ${statusText[payment.status] ?? 'text-gray-500'}`}>{statusLabel[payment.status] ?? payment.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono text-gray-500">{payment.gateway_ref ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          {filtered.length} transactions
        </div>
      </Card>
    </div>
  )
}
