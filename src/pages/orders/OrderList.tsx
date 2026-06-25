import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, PackageOpen, Download, Send, Loader2, Zap } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Button, Input, Card, Pagination } from '../../components/ui'
import {
  FulfillmentBadge, PaymentBadge, ChannelBadge,
  RTOScoreBar, PaymentMethodBadge,
} from '../../components/shared/StatusBadge'
import { FilterPill } from '../../components/shared/FilterPill'
import { exportCSV } from '../../lib/exportCSV'
import { showToast } from '../../lib/toast'
import type { Order, OmsPushStatus } from '../../types'

type TabType = 'all' | 'needs-decision' | 'ready-to-push' | 'ready'

export default function OrderList() {
  useEffect(() => { document.title = 'Orders · Xmetrics' }, [])
  const {
    orders, approveOrder, holdOrder, bulkApprove, bulkHold,
    startPacking, pushToOms, bulkPushToOms,
  } = useAppStore()

  const [tab, setTab] = useState<TabType>('all')
  const [search, setSearch] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterFulfillment, setFilterFulfillment] = useState('')
  const [filterRTO, setFilterRTO] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pushingOrders, setPushingOrders] = useState<Set<string>>(new Set())
  const [isBulkPushing, setIsBulkPushing] = useState(false)
  const PAGE_SIZE = 50

  const needsDecisionOrders = useMemo(() =>
    orders.filter(o => o.rto_review_status === 'PENDING' || o.rto_review_status === 'HELD'),
    [orders]
  )

  const readyToPushOrders = useMemo(() =>
    orders.filter(o =>
      (o.rto_review_status === 'APPROVED' || o.rto_review_status === 'NOT_REQUIRED') &&
      (o.oms_push_status === 'PENDING' || o.oms_push_status === 'FAILED') &&
      (o.fulfillment_status === 'CONFIRMED' || o.fulfillment_status === 'PROCESSING')
    ),
    [orders]
  )

  const readyOrders = useMemo(() =>
    orders.filter(o =>
      o.payment_status === 'PAID' &&
      (o.rto_review_status === 'APPROVED' || o.rto_review_status === 'NOT_REQUIRED') &&
      (o.fulfillment_status === 'CONFIRMED' || o.fulfillment_status === 'PROCESSING')
    ), [orders])

  const filtered = useMemo(() => {
    let list = orders

    if (tab === 'needs-decision') list = needsDecisionOrders
    if (tab === 'ready-to-push') list = readyToPushOrders
    if (tab === 'ready') list = readyOrders

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
  }, [orders, needsDecisionOrders, readyToPushOrders, readyOrders, tab, search, filterChannel, filterPayment, filterFulfillment, filterRTO])

  const pagedOrders = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  useEffect(() => { setPage(1) }, [search, filterChannel, filterPayment, filterFulfillment, filterRTO, tab])

  const highRiskPending = orders.filter(o => o.rto_risk_score >= 60 && o.rto_review_status === 'PENDING').length
  const pushedCount = orders.filter(o => o.oms_push_status === 'PUSHED').length
  const failedPushCount = orders.filter(o => o.oms_push_status === 'FAILED').length

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

  const handlePushSingle = async (orderId: string) => {
    setPushingOrders(prev => new Set(prev).add(orderId))
    const { ok, error } = await pushToOms(orderId, 'MANUAL')
    setPushingOrders(prev => { const n = new Set(prev); n.delete(orderId); return n })
    if (ok) showToast.success('Order pushed to OMS')
    else showToast.error(error ?? 'Push failed — check OMS webhook settings')
  }

  const handleBulkPush = async () => {
    setIsBulkPushing(true)
    const { succeeded, failed } = await bulkPushToOms(selected)
    setIsBulkPushing(false)
    setSelected([])
    if (failed === 0) showToast.success(`${succeeded} order${succeeded !== 1 ? 's' : ''} pushed to OMS`)
    else showToast.error(`${succeeded} pushed, ${failed} failed — check OMS webhook settings`)
  }

  const totalGMV = filtered.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)

  const handleExport = () => {
    exportCSV(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order #', 'Customer', 'Phone', 'Channel', 'Net Amount', 'Payment Status', 'Payment Method', 'Fulfillment Status', 'RTO Score', 'OMS Status', 'Date'],
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
        o.oms_push_status ?? 'PENDING',
        new Date(o.created_at).toLocaleDateString('en-IN'),
      ])
    )
  }

  const showOmsColumn = tab === 'ready-to-push'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Orders</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[13px] text-gray-400">{filtered.length} orders · GMV ₹{Math.round(totalGMV).toLocaleString('en-IN')}</p>
            {pushedCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {pushedCount} pushed to OMS
              </span>
            )}
            {failedPushCount > 0 && (
              <span
                className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 cursor-pointer hover:underline"
                onClick={() => { setTab('ready-to-push'); setSelected([]) }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {failedPushCount} push failed
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white dark:bg-white/[0.04] dark:border-white/[0.08] text-gray-600 dark:text-gray-400 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Export
          </button>
          <Link to="/orders/new">
            <Button size="sm"><Plus size={14} /> New Order</Button>
          </Link>
        </div>
      </div>

      {/* High-risk review banner */}
      {highRiskPending > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 bg-amber-500/[0.07] border border-amber-500/20 dark:border-amber-400/20 rounded-xl cursor-pointer group"
          onClick={() => { setTab('needs-decision'); setSelected([]) }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
            {highRiskPending} high-risk order{highRiskPending > 1 ? 's' : ''} need review — approve or hold before pushing to OMS
          </span>
          <span className="ml-auto text-[12px] font-semibold text-amber-600 dark:text-amber-400 group-hover:underline whitespace-nowrap">
            Review now →
          </span>
        </div>
      )}

      {/* Ready-to-push nudge banner */}
      {readyToPushOrders.length > 0 && tab !== 'ready-to-push' && (
        <div
          className="flex items-center gap-3 px-4 py-3 bg-brand-500/[0.06] border border-brand-500/20 rounded-xl cursor-pointer group"
          onClick={() => { setTab('ready-to-push'); setSelected([]) }}
        >
          <Zap size={14} className="text-brand-600 shrink-0" />
          <span className="text-[13px] font-medium text-brand-700 dark:text-brand-400">
            {readyToPushOrders.length} approved order{readyToPushOrders.length > 1 ? 's' : ''} waiting to push to OMS
          </span>
          <span className="ml-auto text-[12px] font-semibold text-brand-600 group-hover:underline whitespace-nowrap">
            Push now →
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 dark:border-white/[0.06] overflow-x-auto">
        <TabBtn active={tab === 'all'} onClick={() => { setTab('all'); setSelected([]); setPage(1) }}>
          All Orders
        </TabBtn>
        <TabBtn active={tab === 'needs-decision'} onClick={() => { setTab('needs-decision'); setSelected([]); setPage(1) }} badge={needsDecisionOrders.length} badgeDanger>
          Needs Decision
        </TabBtn>
        <TabBtn active={tab === 'ready-to-push'} onClick={() => { setTab('ready-to-push'); setSelected([]); setPage(1) }} badge={readyToPushOrders.length} badgeBrand>
          Ready to Push
        </TabBtn>
        <TabBtn active={tab === 'ready'} onClick={() => { setTab('ready'); setSelected([]); setPage(1) }} badge={readyOrders.length}>
          Ready to Pack
        </TabBtn>
      </div>

      {/* Bulk bar — All tab */}
      {tab === 'all' && selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-md">
          <span className="text-sm font-medium">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelected([])} className="ml-auto text-white/70 hover:text-white text-sm">✕ Clear selection</button>
        </div>
      )}

      {/* Bulk bar — Needs Decision tab */}
      {tab === 'needs-decision' && selected.length > 0 && (
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

      {/* Bulk bar — Ready to Push tab */}
      {tab === 'ready-to-push' && selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-600 text-white rounded-md">
          <span className="text-sm font-medium">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
          <button
            onClick={handleBulkPush}
            disabled={isBulkPushing}
            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-white text-brand-700 text-sm font-medium rounded-md hover:bg-brand-50 transition-colors disabled:opacity-60"
          >
            {isBulkPushing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {isBulkPushing ? 'Pushing…' : 'Push to OMS'}
          </button>
          <button onClick={() => setSelected([])} className="text-white/70 hover:text-white text-sm">✕ Clear</button>
        </div>
      )}

      {/* Bulk bar — Ready to Pack tab */}
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
            { value: 'NDR', label: 'NDR' },
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

      {/* Empty states */}
      {tab === 'ready-to-push' && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <Send size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">No orders waiting to push</p>
          <p className="text-gray-400 text-xs mt-1">Approved orders with oms_push_status PENDING appear here</p>
        </Card>
      )}
      {tab === 'ready' && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <PackageOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">No orders ready to pack</p>
          <p className="text-gray-400 text-xs mt-1">Orders appear here once they're paid and cleared RTO review</p>
        </Card>
      )}

      {/* Table */}
      {!((tab === 'ready' || tab === 'ready-to-push') && filtered.length === 0) && (
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
                      className="rounded accent-brand-600 w-4 h-4 cursor-pointer"
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
                  {showOmsColumn && (
                    <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">OMS Status</th>
                  )}
                  <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                  {(tab === 'needs-decision' || tab === 'ready-to-push') && (
                    <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
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
                    tab={tab}
                    onApprove={() => approveOrder(order.id)}
                    onHold={() => holdOrder(order.id)}
                    onPush={() => handlePushSingle(order.id)}
                    isPushing={pushingOrders.has(order.id)}
                    showOmsColumn={showOmsColumn}
                  />
                ))}
                {pagedOrders.length === 0 && tab !== 'ready' && tab !== 'ready-to-push' && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No orders match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length} orders · GMV ₹{Math.round(totalGMV).toLocaleString('en-IN')}</span>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={p => { setPage(p); setSelected([]) }} />
        </Card>
      )}
    </div>
  )
}

function OrderRow({
  order, selected, onSelect, tab, onApprove, onHold, onPush, isPushing, showOmsColumn,
}: {
  order: Order
  selected: boolean
  onSelect: () => void
  tab: TabType
  onApprove: () => void
  onHold: () => void
  onPush: () => void
  isPushing: boolean
  showOmsColumn: boolean
}) {
  return (
    <tr className={`border-b border-gray-50 dark:border-white/[0.04] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${selected ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}>
      <td className="px-4 py-2.5">
        <input type="checkbox" checked={selected} onChange={onSelect} className="rounded accent-brand-600 w-4 h-4 cursor-pointer" aria-label={`Select order ${order.order_number}`} />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline tabular-nums whitespace-nowrap">
          {order.order_number}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <div>
          <p className="text-[13px] font-medium text-gray-900 dark:text-white">{order.customer?.name}</p>
          <p className="text-[11px] text-gray-400">{order.customer?.phone}</p>
        </div>
      </td>
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <ChannelBadge channel={order.channel} />
      </td>
      <td className="px-4 py-2.5">
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white tabular-nums">
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
        <div className="flex flex-col gap-1">
          <RTOScoreBar score={order.rto_risk_score} />
          <RoutingBadge score={order.rto_risk_score} />
        </div>
      </td>
      {showOmsColumn && (
        <td className="px-4 py-2.5">
          <OmsPushStatusBadge status={order.oms_push_status} pushedAt={order.oms_pushed_at} />
        </td>
      )}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-500">
          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      </td>
      {tab === 'needs-decision' && (
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
      {tab === 'ready-to-push' && (
        <td className="px-4 py-3">
          {order.oms_push_status !== 'PUSHED' ? (
            <button
              onClick={onPush}
              disabled={isPushing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-md hover:bg-brand-100 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {isPushing
                ? <><Loader2 size={11} className="animate-spin" /> Pushing…</>
                : <><Send size={11} /> Push to OMS</>
              }
            </button>
          ) : (
            <span className="text-xs text-green-600 font-medium">✓ Pushed</span>
          )}
        </td>
      )}
    </tr>
  )
}

function RoutingBadge({ score }: { score: number }) {
  if (score < 50) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        GREEN
      </span>
    )
  }
  if (score < 60) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        YELLOW
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      RED
    </span>
  )
}

function OmsPushStatusBadge({ status, pushedAt }: { status?: OmsPushStatus | null; pushedAt?: string | null }) {
  if (!status || status === 'NOT_APPLICABLE') return <span className="text-[11px] text-gray-400">—</span>

  if (status === 'PUSHED') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-md whitespace-nowrap">
          ✓ Pushed to OMS
        </span>
        {pushedAt && (
          <span className="text-[10px] text-gray-400 pl-0.5">
            {new Date(pushedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-md whitespace-nowrap">
        ✗ Push failed
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400 rounded-md whitespace-nowrap">
      Queued
    </span>
  )
}

function TabBtn({
  active, onClick, children, badge, badgeDanger, badgeBrand,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: number
  badgeDanger?: boolean
  badgeBrand?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`tab-line ${active ? 'active' : ''} flex items-center gap-1.5`}
    >
      {children}
      {badge != null && badge > 0 ? (
        <span className={`text-[10px] font-medium tabular-nums ${
          badgeDanger ? 'text-amber-500' : badgeBrand ? 'text-brand-500' : 'text-gray-400'
        }`}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}
