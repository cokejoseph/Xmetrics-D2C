import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Download, CreditCard } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Pagination } from '../../components/ui'
import { KPICard } from '../../components/shared/KPICard'
import { PaymentMethodBadge } from '../../components/shared/StatusBadge'
import { FilterPill } from '../../components/shared/FilterPill'
import { exportCSV } from '../../lib/exportCSV'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Payments() {
  useEffect(() => { document.title = 'Payments · Xmetrics' }, [])
  const { payments, orders } = useAppStore()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const totalCollected = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
  const codPending = orders.filter(o => o.payment_method === 'COD' && o.payment_status !== 'PAID').length
  const failedCount = payments.filter(p => p.status === 'FAILED').length

  const filtered = useMemo(() => payments.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterMethod && p.method !== filterMethod) return false
    return true
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  [payments, filterStatus, filterMethod])

  const pagedPayments = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  useEffect(() => { setPage(1) }, [filterStatus, filterMethod])

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

  const handleExport = () => {
    exportCSV(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order #', 'Customer', 'Method', 'Amount', 'Status', 'Gateway Ref', 'Date'],
      filtered.map(p => {
        const order = orders.find(o => o.id === p.order_id)
        return [
          order?.order_number ?? '',
          order?.customer?.name ?? '',
          p.method,
          p.amount,
          p.status,
          p.gateway_ref ?? '',
          new Date(p.created_at).toLocaleDateString('en-IN'),
        ]
      })
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Payments</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">₹{Math.round(totalCollected).toLocaleString('en-IN')} collected · {codPending} COD pending</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Export
          </button>
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
        <KPICard
          label="Total Collected"
          value={`₹${Math.round(totalCollected).toLocaleString('en-IN')}`}
          sub={`${payments.filter(p => p.status === 'PAID').length} payments`}
          subColor="green"
        />
        <KPICard
          label="COD Pending"
          value={codPending}
          sub="orders awaiting payment"
          subColor="amber"
          className="border-l-2 border-amber-400 dark:border-amber-500"
        />
        <KPICard
          label="Failed Payments"
          value={failedCount}
          sub="require attention"
          valueColor="red"
          pulse={failedCount > 0}
        />
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
              {pagedPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <CreditCard size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No payments found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {filterStatus || filterMethod ? 'Try clearing your filters' : 'Payments will appear here as orders are processed'}
                    </p>
                  </td>
                </tr>
              )}
              {pagedPayments.map(payment => {
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
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>
    </div>
  )
}
