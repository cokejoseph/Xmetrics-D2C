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

  const statusColors: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-red-100 text-red-700',
    REFUNDED: 'bg-blue-100 text-blue-700',
    SETTLED: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Payments</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-gray-900">₹{Math.round(totalCollected).toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-600 mt-1">{payments.filter(p => p.status === 'PAID').length} payments</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">COD Pending</p>
          <p className="text-2xl font-bold text-gray-900">{codPending}</p>
          <p className="text-xs text-amber-600 mt-1">orders awaiting payment</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Failed Payments</p>
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Gateway Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[payment.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {payment.status}
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
