import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { Card } from '../../components/ui'
import { PaymentMethodBadge } from '../../components/shared/StatusBadge'

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
      <h1 className="text-lg font-semibold text-gray-900">Payments</h1>

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

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input-field w-36"
          >
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="SETTLED">Settled</option>
          </select>
          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            className="input-field w-36"
          >
            <option value="">All Methods</option>
            <option value="COD">COD</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="NETBANKING">Netbanking</option>
            <option value="WALLET">Wallet</option>
            <option value="PREPAID">Prepaid</option>
          </select>
        </div>
      </Card>

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
