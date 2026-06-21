import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, PackageOpen, Download } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Button, Input, Card, Pagination } from '../../components/ui'
import {
  FulfillmentBadge, PaymentBadge, ChannelBadge,
  RTOScoreBar, PaymentMethodBadge,
} from '../../components/shared/StatusBadge'
import { FilterPill } from '../../components/shared/FilterPill'
import { exportCSV } from '../../lib/exportCSV'
import type { Order } from '../../types'

type TabType = 'all' | 'ready' | 'review'

export default function OrderList() {
  useEffect(() => { document.title = 'Orders · Xmetrics' }, [])
  const { orders, approveOrder, holdOrder, bulkApprove, bulkHold, startPacking } = useAppStore()
  const [tab, setTab] = useState<TabType>('all')
  const [search, setSearch] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterFulfillment, setFilterFulfillment] = useState('')
  const [filterRTO, setFilterRTO] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const pendingReviewCount = orders.filter(o => o.rto_review_status === 'PENDING').length

  // "Ready" = paid, not flagged, not yet in packing pipeline
  const readyOrders = useMemo(() =>
    orders.filter(o =>
      o.payment_status === 'PAID' &&
      (o.rto_review_status === 'APPROVED' || o.rto_review_status === 'NOT_REQUIRED') &&
      (o.fulfillment_status === 'CONFIRMED' || o.fulfillment_status === 'PROCESSING')
    ), [orders])

  const filtered = useMemo(() => {
    let list = orders

    if (tab === 'ready') list = readyOrders
    if (tab === 'review') list = orders.filter(o =>
      o.rto_review_status === 'PENDING' || o.rto_review_status === 'HELD'
    )

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer?.name.toLowerCase().includes(q) ||
        o.customer?.phone.includes(q)
      )
    }
    if (filterChannel) list = list.filter(o => o.channel === filterChannel)
    if (filterPayment) list = list.filter(o => o.payment_status === filterPayment)
    if (filterFulfillment) list = list.filter(o => o.fulfillment_status === filterFulfillment)
    if (filterRTO) {
      list = list.filter(o => {
        if (filterRTO === 'high') return o.rto_risk_score >= 60
        if (filterRTO === 'medium') return o.rto_risk_score >= 30 && o.rto_risk_score < 60
        if (filterRTO === 'low') return o.rto_risk_score < 30
        return true
      })
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [orders, readyOrders, tab, search, filterChannel, filterPayment, filterFulfillment, filterRTO])

  const pagedOrders = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  useEffect(() => { setPage(1) }, [search, filterChannel, filterPayment, filterFulfillment, filterRTO])

  const highRiskPending = orders.filter(o => o.rto_risk_score >= 60 && o.rto_review_status === 'PENDING').length

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleSelectAll = () =>
    setSelected(prev =>
      prev.length === pagedOrders.length && pagedOrders.length > 0 ? [] : pagedOrders.map(o => o.id)
    )

  const handleStartPacking = () => {
    startPacking(selected)
    setSelected([])
  }

  const totalGMV = filtered.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)

  const handleExport = () => {
    exportCSV(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order #', 'Customer', 'Phone', 'Channel', 'Net Amount', 'Payment Status', 'Payment Method', 'Fulfillment Status', 'RTO Score', 'Date'],
      filtered.map(o => [
        o.order_number,
        o.customer?.name ?? '',
        o.customer?.phone ?? '',
        o.channel,
        Math.round(o.gross_amount - o.discount_amount),
        o.payment_status,
        o.payment_method,
        o.fulfillment_status,
        o.rto_risk_score,
        new Date(o.created_at).toLocaleDateString('en-IN'),
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Orders</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{filtered.length} orders · GMV ₹{Math.round(totalGMV).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Export
          </button>
          <Link to="/orders/new">
            <Button size="sm"><Plus size={14} /> New Order</Button>
          </Link>
        </div>
      </div>

      {/* Risk banner */}
      {highRiskPending > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 bg-amber-500/[0.07] border border-amber-500/20 dark:border-amber-400/20 rounded-xl cursor-pointer group"
          onClick={() => { setTab('review'); setSelected([]) }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
            {highRiskPending} order{highRiskPending > 1 ? 's' : ''} flagged for RTO review — hold before shipping
          </span>
          <span className="ml-auto text-[12px] font-semibold text-amber-600 dark:text-amber-400 group-hover:underline whitespace-nowrap">
            Review now →
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 overflow-x-auto">
        <TabBtn active={tab === 'all'} onClick={() => { setTab('all'); setSelected([]); setPage(1) }}>
          All Orders
        </TabBtn>
        <TabBtn active={tab === 'ready'} onClick={() => { setTab('ready'); setSelected([]); setPage(1) }} badge={readyOrders.length}>
          Ready to Pack
        </TabBtn>
        <TabBtn active={tab === 'review'} onClick={() => { setTab('review'); setSelected([]); setPage(1) }} badge={pendingReviewCount} badgeDanger>
          Review Queue
        </TabBtn>
      </div>

      {/* Bulk action bar — All tab */}
      {tab === 'all' && selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-md">
          <span className="text-sm font-medium">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelected([])} className="ml-auto text-white/70 hover:text-white text-sm">✕ Clear selection</button>
        </div>
      )}

      {/* Bulk action bar — Start Packing (ready tab only) */}
      {tab === 'ready' && selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-600 text-white rounded-md">
          <span className="text-sm font-medium">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
          <button
            onClick={handleStartPacking}
            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-white text-brand-700 text-sm font-medium rounded-md hover:bg-brand-50 transition-colors"
          >
            <PackageOpen size={14} /> Start Packing
          </button>
          <button onClick={() => setSelected([])} className="text-white/70 hover:text-white text-sm">✕ Clear</button>
        </div>
      )}

      {/* Review Queue bulk actions */}
      {tab === 'review' && selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-md">
          <span className="text-sm font-medium">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => { bulkApprove(selected); setSelected([]) }}
              className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-400 transition-colors"
            >
              Approve All
            </button>
            <button
              onClick={() => { bulkHold(selected); setSelected([]) }}
              className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-md hover:bg-amber-400 transition-colors"
            >
              Hold All
            </button>
          </div>
          <button onClick={() => setSelected([])} className="text-white/70 hover:text-white text-sm">✕ Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders, customers…" className="pl-8 h-8 text-sm" aria-label="Search orders and customers" />
        </div>
        <FilterPill
          value={filterChannel}
          onChange={setFilterChannel}
          placeholder="Channel"
          options={[
            { value: 'SHOPIFY', label: 'Shopify' },
            { value: 'WHATSAPP', label: 'WhatsApp' },
            { value: 'MANUAL', label: 'Manual' },
            { value: 'AMAZON', label: 'Amazon' },
            { value: 'FLIPKART', label: 'Flipkart' },
          ]}
        />
        <FilterPill
          value={filterPayment}
          onChange={setFilterPayment}
          placeholder="Payment"
          options={[
            { value: 'PAID', label: 'Paid' },
            { value: 'AWAITING_PAYMENT', label: 'Awaiting' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'FAILED', label: 'Failed' },
          ]}
        />
        <FilterPill
          value={filterFulfillment}
          onChange={setFilterFulfillment}
          placeholder="Fulfillment"
          options={[
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'PACKING', label: 'Packing' },
            { value: 'READY_TO_SHIP', label: 'Ready to Ship' },
            { value: 'SHIPPED', label: 'Shipped' },
            { value: 'IN_TRANSIT', label: 'In Transit' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'RTO_INITIATED', label: 'RTO' },
            { value: 'NDR',           label: 'NDR' },
          ]}
        />
        <FilterPill
          value={filterRTO}
          onChange={setFilterRTO}
          placeholder="RTO Risk"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>

      {/* Empty state for ready tab */}
      {tab === 'ready' && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <PackageOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">No orders ready to pack</p>
          <p className="text-gray-400 text-xs mt-1">Orders appear here once they're paid and cleared RTO review</p>
        </Card>
      )}

      {/* Table */}
      {(tab !== 'ready' || filtered.length > 0) && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full" aria-label={`${filtered.length} orders`} role="table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                  <th scope="col" className="px-4 py-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={pagedOrders.length > 0 && pagedOrders.every(o => selected.includes(o.id))}
                      onChange={toggleSelectAll}
                      className="rounded"
                      aria-label="Select all orders on this page"
                    />
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Channel</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Payment</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider" title="RTO Risk Score (0–100). Higher scores indicate greater return-to-origin risk.">RTO Risk</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                  {tab === 'review' && (
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {pagedOrders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={selected.includes(order.id)}
                    onSelect={() => toggleSelect(order.id)}
                    showActions={tab === 'review'}
                    onApprove={() => approveOrder(order.id)}
                    onHold={() => holdOrder(order.id)}
                  />
                ))}
                {pagedOrders.length === 0 && tab !== 'ready' && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No orders match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length} orders · GMV ₹{Math.round(totalGMV).toLocaleString('en-IN')}</span>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={p => { setPage(p); setSelected([]) }} />
        </Card>
      )}
    </div>
  )
}

function OrderRow({
  order, selected, onSelect, showActions, onApprove, onHold,
}: {
  order: Order
  selected: boolean
  onSelect: () => void
  showActions: boolean
  onApprove: () => void
  onHold: () => void
}) {
  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selected ? 'bg-brand-50' : ''}`}>
      <td className="px-4 py-2.5">
        <input type="checkbox" checked={selected} onChange={onSelect} className="rounded" aria-label={`Select order ${order.order_number}`} />
      </td>
      <td className="px-4 py-2.5">
        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline tabular-nums">
          {order.order_number}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <div>
          <p className="text-[13px] font-medium text-gray-900">{order.customer?.name}</p>
          <p className="text-[11px] text-gray-400">{order.customer?.phone}</p>
        </div>
      </td>
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <ChannelBadge channel={order.channel} />
      </td>
      <td className="px-4 py-2.5">
        <span className="text-[13px] font-semibold text-gray-900 tabular-nums">
          ₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}
        </span>
      </td>
      <td className="px-4 py-2.5 hidden md:table-cell">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PaymentBadge status={order.payment_status} />
          <span className="text-gray-200 dark:text-white/10 text-[10px]">·</span>
          <PaymentMethodBadge method={order.payment_method} />
        </div>
      </td>
      <td className="px-4 py-2.5 hidden md:table-cell">
        <FulfillmentBadge status={order.fulfillment_status} />
      </td>
      <td className="px-4 py-2.5">
        <RTOScoreBar score={order.rto_risk_score} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-500">
          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      </td>
      {showActions && (
        <td className="px-4 py-3">
          {order.rto_review_status === 'PENDING' || order.rto_review_status === 'HELD' ? (
            <div className="flex gap-1">
              <button onClick={onApprove} className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                Approve
              </button>
              <button onClick={onHold} className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors">
                Hold
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">{order.rto_review_status}</span>
          )}
        </td>
      )}
    </tr>
  )
}

function TabBtn({
  active, onClick, children, badge, badgeDanger,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: number
  badgeDanger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`tab-line ${active ? 'active' : ''} flex items-center gap-1.5`}
    >
      {children}
      {badge != null && badge > 0 ? (
        <span className={`text-[10px] font-medium tabular-nums ${
          badgeDanger ? 'text-red-500' : 'text-gray-400'
        }`}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}
