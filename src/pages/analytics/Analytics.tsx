import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, Search, Check, MessageCircle, Copy } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { buildSKUForecast } from '../../lib/forecastEngine'
import { buildReorderNudgeList } from '../../lib/reorderEngine'
import type { ChurnLevel } from '../../lib/reorderEngine'
import { Card, Input } from '../../components/ui'
import { RevenueAreaChart, OrdersBarChart, StatusDonut, ChannelBarChart } from '../../components/charts'
import type { Order, ForecastStatus } from '../../types'

// ── Period filter ─────────────────────────────────────────────────────────────

type Period = 'today' | 'this_week' | 'prev_week' | 'last_7d' | 'this_month' | 'last_30d' | 'last_3m' | 'last_6m' | 'yearly'
type Granularity = 'hour' | 'day' | 'week' | 'month'

const PERIOD_OPTIONS: { value: Period; label: string; granularity: Granularity; shortLabel: string }[] = [
  { value: 'yearly',    label: 'This Year',     shortLabel: 'this year',     granularity: 'month' },
  { value: 'last_6m',  label: 'Last 6 Months', shortLabel: 'last 6 months', granularity: 'week'  },
  { value: 'last_3m',  label: 'Last 3 Months', shortLabel: 'last 3 months', granularity: 'week'  },
  { value: 'last_30d', label: 'Previous Month',  shortLabel: 'previous month', granularity: 'day'   },
  { value: 'this_month',label: 'This Month',    shortLabel: 'this month',     granularity: 'day'   },
  { value: 'prev_week',label: 'Previous Week',  shortLabel: 'previous week',  granularity: 'day'   },
  { value: 'this_week',label: 'This Week',      shortLabel: 'this week',     granularity: 'day'   },
  { value: 'today',    label: 'Today',          shortLabel: 'today',         granularity: 'hour'  },
]

function getDateRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  switch (period) {
    case 'today':
      return { from: today, to: tomorrow }
    case 'this_week': {
      const dow = today.getDay()
      const monday = new Date(today); monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
      return { from: monday, to: tomorrow }
    }
    case 'prev_week': {
      const dow = today.getDay()
      const thisMonday = new Date(today); thisMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
      const prevMonday = new Date(thisMonday); prevMonday.setDate(thisMonday.getDate() - 7)
      return { from: prevMonday, to: thisMonday }
    }
    case 'last_7d': {
      const from = new Date(today); from.setDate(today.getDate() - 6)
      return { from, to: tomorrow }
    }
    case 'this_month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: tomorrow }
    case 'last_30d': {
      const from = new Date(today); from.setDate(today.getDate() - 29)
      return { from, to: tomorrow }
    }
    case 'last_3m': {
      const from = new Date(today); from.setMonth(today.getMonth() - 3)
      return { from, to: tomorrow }
    }
    case 'last_6m': {
      const from = new Date(today); from.setMonth(today.getMonth() - 6)
      return { from, to: tomorrow }
    }
    case 'yearly':
      return { from: new Date(today.getFullYear(), 0, 1), to: tomorrow }
  }
}

function buildChartData(
  orders: Order[],
  from: Date,
  to: Date,
  granularity: Granularity,
): { label: string; revenue: number; orders: number }[] {
  const buckets: { label: string; from: Date; to: Date }[] = []

  if (granularity === 'hour') {
    for (let h = 0; h < 24; h++) {
      const start = new Date(from); start.setHours(h, 0, 0, 0)
      const end   = new Date(from); end.setHours(h + 1, 0, 0, 0)
      buckets.push({ label: `${h}:00`, from: start, to: end })
    }
  } else if (granularity === 'day') {
    const cursor = new Date(from)
    while (cursor < to) {
      const start = new Date(cursor)
      const end   = new Date(cursor); end.setDate(cursor.getDate() + 1)
      buckets.push({ label: String(start.getDate()), from: start, to: end })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (granularity === 'week') {
    const cursor = new Date(from)
    while (cursor < to) {
      const start = new Date(cursor)
      const end   = new Date(cursor); end.setDate(cursor.getDate() + 7)
      buckets.push({ label: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), from: start, to: new Date(Math.min(end.getTime(), to.getTime())) })
      cursor.setDate(cursor.getDate() + 7)
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    while (cursor < to) {
      const start = new Date(cursor)
      const end   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      buckets.push({ label: start.toLocaleDateString('en-IN', { month: 'short' }), from: start, to: end })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  return buckets.map(b => {
    const bOrders = orders.filter(o => {
      const t = new Date(o.created_at)
      return t >= b.from && t < b.to
    })
    return {
      label: b.label,
      revenue: bOrders.filter(o => o.payment_status === 'PAID').reduce((s, o) => s + o.gross_amount - o.discount_amount, 0),
      orders: bOrders.length,
    }
  })
}

// ── Lookups ───────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  SHOPIFY: 'Shopify', WHATSAPP: 'WhatsApp', MANUAL: 'Manual',
  AMAZON: 'Amazon', FLIPKART: 'Flipkart', WOOCOMMERCE: 'WooCommerce', MEESHO: 'Meesho',
}

const METHOD_LABELS: Record<string, string> = {
  COD: 'COD', UPI: 'UPI', CARD: 'Card', NETBANKING: 'Netbanking', WALLET: 'Wallet', PREPAID: 'Prepaid',
}

const FORECAST_STATUS_STYLE: Record<ForecastStatus, { label: string; dot: string; text: string }> = {
  OUT_OF_STOCK:      { label: 'Out of Stock',      dot: 'bg-red-500',    text: 'text-red-600' },
  REORDER_NOW:       { label: 'Reorder Now',        dot: 'bg-orange-400', text: 'text-orange-600' },
  REORDER_SOON:      { label: 'Reorder Soon',       dot: 'bg-amber-400',  text: 'text-amber-600' },
  IN_STOCK:          { label: 'In Stock',            dot: 'bg-green-400',  text: 'text-green-600' },
  DEAD_STOCK:        { label: 'Dead Stock',          dot: 'bg-gray-300',   text: 'text-gray-400' },
  INSUFFICIENT_DATA: { label: 'Insufficient Data',  dot: 'bg-gray-300',   text: 'text-gray-400' },
  UNPREDICTABLE:     { label: 'Unpredictable',      dot: 'bg-gray-300',   text: 'text-gray-400' },
}

type TabType = 'overview' | 'reorder' | 'forecast' | 'pincode'
type PincodeSortKey = 'orders' | 'revenue' | 'aov' | 'rto_rate'

// ── Period picker dropdown ────────────────────────────────────────────────────

function PeriodPicker({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = PERIOD_OPTIONS.find(o => o.value === value)!

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 cursor-pointer transition-colors"
      >
        {current.label}
        <ChevronDown size={13} className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-lg border border-gray-100 bg-white p-1 shadow-lg shadow-black/5">
          <p className="px-2 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Time Period</p>
          <div className="my-1 h-px -mx-1 bg-gray-100" />
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer transition-colors text-left ${
                value === o.value ? 'text-brand-600 font-medium bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {o.label}
              {value === o.value && <Check size={13} className="ml-auto text-brand-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Analytics() {
  const [tab, setTab]                     = useState<TabType>('overview')
  const [period, setPeriod]               = useState<Period>('last_30d')
  const [pincodeSearch, setPincodeSearch] = useState('')
  const [pincodeSort, setPincodeSort]     = useState<PincodeSortKey>('orders')
  const [pincodeSortAsc, setPincodeSortAsc] = useState(false)
  const [reorderSearch, setReorderSearch] = useState('')
  const [copiedPhone, setCopiedPhone]     = useState<string | null>(null)
  const { orders, products, customers } = useAppStore()

  const { forecasts, summary } = useMemo(() => buildSKUForecast(products, orders), [products, orders])

  // ── Reorder Engine ────────────────────────────────────────────────────────────
  const allNudges = useMemo(() => buildReorderNudgeList(customers, orders), [customers, orders])
  const filteredNudges = useMemo(() => {
    if (!reorderSearch) return allNudges
    const q = reorderSearch.toLowerCase()
    return allNudges.filter(n =>
      n.customer_name.toLowerCase().includes(q) ||
      n.customer_phone.includes(q) ||
      n.top_category.toLowerCase().includes(q)
    )
  }, [allNudges, reorderSearch])
  const reorderSummary = useMemo(() => ({
    lost:     allNudges.filter(n => n.churn_level === 'LOST').length,
    churning: allNudges.filter(n => n.churn_level === 'CHURNING').length,
    at_risk:  allNudges.filter(n => n.churn_level === 'AT_RISK').length,
    active:   allNudges.filter(n => n.churn_level === 'ACTIVE').length,
  }), [allNudges])

  const periodMeta = PERIOD_OPTIONS.find(o => o.value === period)!
  const { from, to } = useMemo(() => getDateRange(period), [period])

  const filteredOrders = useMemo(
    () => orders.filter(o => { const t = new Date(o.created_at); return t >= from && t < to }),
    [orders, from, to],
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const paidOrders  = filteredOrders.filter(o => o.payment_status === 'PAID')
  const totalRevenue = paidOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
  const aov          = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0
  const rtoOrders    = filteredOrders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
  const deliveredOrders = filteredOrders.filter(o => o.fulfillment_status === 'DELIVERED')
  const rtoRate      = (deliveredOrders.length + rtoOrders.length) > 0
    ? (rtoOrders.length / (deliveredOrders.length + rtoOrders.length) * 100)
    : 0
  const rtoLoss = rtoOrders.reduce((s, o) => s + (o.gross_amount - o.discount_amount) * 0.15, 0)

  const cogs = useMemo(() =>
    filteredOrders.filter(o => o.payment_status === 'PAID').reduce((s, o) =>
      s + (o.items ?? []).reduce((is, item) =>
        is + (item.cost_price ?? item.product?.cost_price ?? 0) * item.quantity, 0), 0),
  [filteredOrders])
  const grossMarginPct = totalRevenue > 0 ? ((totalRevenue - cogs) / totalRevenue * 100) : 0

  // ── COD vs Prepaid ────────────────────────────────────────────────────────────
  const codOrders      = filteredOrders.filter(o => o.payment_method === 'COD')
  const prepaidOrders  = filteredOrders.filter(o => o.payment_method !== 'COD')
  const codPct         = filteredOrders.length > 0 ? Math.round(codOrders.length / filteredOrders.length * 100) : 0
  // Use order value (not just paid) — COD is collected at delivery, so payment_status won't be PAID yet
  const codOrderValue     = codOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
  const prepaidOrderValue = prepaidOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)

  // ── Payment method breakdown ──────────────────────────────────────────────────
  const paymentMethodData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>()
    for (const o of filteredOrders) {
      const e = map.get(o.payment_method) ?? { orders: 0, revenue: 0 }
      map.set(o.payment_method, {
        orders: e.orders + 1,
        revenue: e.revenue + (o.payment_status === 'PAID' ? o.gross_amount - o.discount_amount : 0),
      })
    }
    return Array.from(map.entries())
      .map(([method, d]) => ({ method, orders: d.orders, revenue: d.revenue, pct: filteredOrders.length > 0 ? Math.round(d.orders / filteredOrders.length * 100) : 0 }))
      .sort((a, b) => b.orders - a.orders)
  }, [filteredOrders])

  // ── Charts ────────────────────────────────────────────────────────────────────
  const chartData       = useMemo(() => buildChartData(filteredOrders, from, to, periodMeta.granularity), [filteredOrders, from, to, periodMeta.granularity])
  const ordersChartData = chartData.map(r => ({ label: r.label, orders: r.orders }))

  const channelData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; rto: number }>()
    for (const o of filteredOrders) {
      const e = map.get(o.channel) ?? { orders: 0, revenue: 0, rto: 0 }
      map.set(o.channel, {
        orders: e.orders + 1,
        revenue: e.revenue + o.gross_amount - o.discount_amount,
        rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0),
      })
    }
    return Array.from(map.entries()).map(([channel, d]) => ({
      channel,
      orders: d.orders,
      revenue: d.revenue,
      rto_rate: d.orders > 0 ? (d.rto / d.orders * 100).toFixed(1) : '0',
    }))
  }, [filteredOrders])

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filteredOrders) map.set(o.fulfillment_status, (map.get(o.fulfillment_status) ?? 0) + 1)
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredOrders])

  // ── Product performance ───────────────────────────────────────────────────────
  const productPerformance = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; units: number; revenue: number }>()
    for (const o of filteredOrders.filter(o => o.payment_status === 'PAID')) {
      for (const item of o.items ?? []) {
        const key  = item.product_id ?? item.sku
        const name = item.product?.name ?? item.product_name ?? item.sku
        const e    = map.get(key) ?? { name, sku: item.sku, units: 0, revenue: 0 }
        map.set(key, { name: e.name, sku: e.sku, units: e.units + item.quantity, revenue: e.revenue + item.unit_price * item.quantity })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredOrders])

  // ── Customer insights ─────────────────────────────────────────────────────────
  const firstOrderDateByCustomer = useMemo(() => {
    const map = new Map<string, Date>()
    for (const o of orders) {
      if (!o.customer_id) continue
      const d    = new Date(o.created_at)
      const prev = map.get(o.customer_id)
      if (!prev || d < prev) map.set(o.customer_id, d)
    }
    return map
  }, [orders])

  const customerInsights = useMemo(() => {
    const uniqueIds = new Set(
      filteredOrders.map(o => o.customer_id).filter((id): id is string => !!id)
    )
    const newIds = new Set([...uniqueIds].filter(id => {
      const first = firstOrderDateByCustomer.get(id)
      return first && first >= from
    }))
    return {
      unique:      uniqueIds.size,
      newCount:    newIds.size,
      returning:   uniqueIds.size - newIds.size,
      repeatRate:  uniqueIds.size > 0 ? Math.round((uniqueIds.size - newIds.size) / uniqueIds.size * 100) : 0,
    }
  }, [filteredOrders, firstOrderDateByCustomer, from])

  // ── Pincode intelligence ──────────────────────────────────────────────────────
  const pincodeData = useMemo(() => {
    const map = new Map<string, { city: string; state: string; orders: number; revenue: number; rto: number }>()
    for (const o of filteredOrders) {
      const pin = o.shipping_address.pincode
      if (!pin) continue
      const e = map.get(pin) ?? { city: o.shipping_address.city, state: o.shipping_address.state, orders: 0, revenue: 0, rto: 0 }
      map.set(pin, {
        city: e.city, state: e.state,
        orders: e.orders + 1,
        revenue: e.revenue + o.gross_amount - o.discount_amount,
        rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0),
      })
    }
    return Array.from(map.entries()).map(([pincode, d]) => ({
      pincode, city: d.city, state: d.state, orders: d.orders, revenue: d.revenue,
      aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      rto_count: d.rto,
      rto_rate: d.orders > 0 ? (d.rto / d.orders) * 100 : 0,
    }))
  }, [filteredOrders])

  const filteredPincodes = useMemo(() => {
    let list = pincodeData
    if (pincodeSearch) {
      const q = pincodeSearch.toLowerCase()
      list = list.filter(p => p.pincode.includes(q) || p.city.toLowerCase().includes(q) || p.state.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => (a[pincodeSort] - b[pincodeSort]) * (pincodeSortAsc ? 1 : -1))
  }, [pincodeData, pincodeSearch, pincodeSort, pincodeSortAsc])

  const pincodeSummary = useMemo(() => ({
    total:       pincodeData.length,
    high_rto:    pincodeData.filter(p => p.rto_rate >= 30).length,
    zero_rto:    pincodeData.filter(p => p.rto_rate === 0 && p.orders >= 2).length,
    top_revenue: pincodeData.reduce((max, p) => p.revenue > max.revenue ? p : max, pincodeData[0] ?? { pincode: '—', revenue: 0, city: '' }),
  }), [pincodeData])

  const granularityLabel: Record<Granularity, string> = {
    hour: 'Hourly', day: 'Daily', week: 'Weekly', month: 'Monthly',
  }

  const TABS: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reorder',  label: 'Reorder Engine' },
    { key: 'forecast', label: 'Demand Forecast' },
    { key: 'pincode',  label: 'Pincode Intelligence' },
  ]

  const onPincodeSort = (k: PincodeSortKey) => {
    if (pincodeSort === k) setPincodeSortAsc(p => !p)
    else { setPincodeSort(k); setPincodeSortAsc(false) }
  }

  const totalProductRevenue = productPerformance.reduce((s, p) => s + p.revenue, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Analytics</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{tab === 'overview' ? periodMeta.label : tab === 'reorder' ? 'Churn intelligence' : 'Demand forecast'}</p>
        </div>
        {tab !== 'forecast' && tab !== 'reorder' && (
          <PeriodPicker value={period} onChange={setPeriod} />
        )}
      </div>

      <div className="flex gap-6 border-b border-gray-100">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-line ${tab === t.key ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* KPIs — 6 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Revenue</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-none tabular-nums">₹{totalRevenue >= 1000 ? `${Math.round(totalRevenue / 1000)}k` : Math.round(totalRevenue)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Orders</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-none tabular-nums">{filteredOrders.length}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Avg Order Value</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-none tabular-nums">₹{aov.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">paid orders</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">RTO Rate</p>
              <p className="text-[26px] font-semibold text-red-600 dark:text-red-400 leading-none tabular-nums">{rtoRate.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Gross Margin</p>
              <p className="text-[26px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">{cogs > 0 ? `${grossMarginPct.toFixed(1)}%` : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">after COGS</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">RTO Loss</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-none tabular-nums">₹{Math.round(rtoLoss).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">est. 15% of value</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900">Revenue Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">{granularityLabel[periodMeta.granularity]} revenue — {periodMeta.label}</p>
              <RevenueAreaChart data={chartData} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900">{granularityLabel[periodMeta.granularity]} Orders</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">Order count — {periodMeta.label}</p>
              <OrdersBarChart data={ordersChartData} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900">Order Status Mix</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">Fulfillment distribution — {periodMeta.label}</p>
              <StatusDonut data={statusCounts} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900">Channel Performance</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">Orders by channel — {periodMeta.label}</p>
              <ChannelBarChart data={channelData.map(c => ({ ...c, channel: CHANNEL_LABELS[c.channel] ?? c.channel }))} />
            </Card>
          </div>

          {/* COD vs Prepaid */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">COD vs Prepaid</h3>
                <p className="text-xs text-gray-400 mt-0.5">Payment collection mode split — {periodMeta.shortLabel}</p>
              </div>
              {filteredOrders.length > 0 && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{filteredOrders.length} orders</p>
                </div>
              )}
            </div>
            {filteredOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No orders in this period</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium text-amber-600 w-10 text-right shrink-0">{codPct}%</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${codPct}%` }} />
                    <div className="bg-brand-600 h-full flex-1 transition-all duration-500" />
                  </div>
                  <span className="text-xs font-medium text-brand-600 w-10 shrink-0">{100 - codPct}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 font-medium uppercase tracking-wider mb-1">COD</p>
                    <p className="text-lg font-semibold text-amber-700">₹{codOrderValue >= 1000 ? `${Math.round(codOrderValue / 1000)}k` : Math.round(codOrderValue)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{codOrders.length} orders · {codPct}%</p>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Prepaid</p>
                    <p className="text-lg font-semibold text-blue-700">₹{prepaidOrderValue >= 1000 ? `${Math.round(prepaidOrderValue / 1000)}k` : Math.round(prepaidOrderValue)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{prepaidOrders.length} orders · {100 - codPct}%</p>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Channel + Payment Method breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Channel Breakdown</h3>
              </div>
              {channelData.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-400">No orders in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Channel</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">RTO</th>
                      </tr>
                    </thead>
                    <tbody className="stagger-rows">
                      {[...channelData].sort((a, b) => b.orders - a.orders).map(c => (
                        <tr key={c.channel} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{CHANNEL_LABELS[c.channel] ?? c.channel}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{c.orders}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">₹{Math.round(c.revenue).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{c.rto_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Payment Method Breakdown</h3>
              </div>
              {paymentMethodData.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-400">No orders in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Method</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Share</th>
                        <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="stagger-rows">
                      {paymentMethodData.map(m => (
                        <tr key={m.method} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{METHOD_LABELS[m.method] ?? m.method}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{m.orders}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-600 rounded-full" style={{ width: `${m.pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{m.pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">₹{Math.round(m.revenue).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Product Performance */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Top Products by Revenue</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Paid orders only — {periodMeta.shortLabel}</p>
            </div>
            {productPerformance.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No paid orders in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Units</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {productPerformance.map((p, i) => {
                      const pct = totalProductRevenue > 0 ? (p.revenue / totalProductRevenue * 100) : 0
                      return (
                        <tr key={p.sku} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">{p.units}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">₹{Math.round(p.revenue).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Customer Insights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Unique Buyers</p>
              <p className="text-2xl font-semibold text-gray-900">{customerInsights.unique}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">New Customers</p>
              <p className="text-2xl font-semibold text-brand-600">{customerInsights.newCount}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">first order in period</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Returning</p>
              <p className="text-2xl font-semibold text-green-600">{customerInsights.returning}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">repeat customers</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Repeat Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{customerInsights.repeatRate}%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">of buyers are repeat</p>
            </Card>
          </div>

        </div>
      )}

      {/* ── Reorder Engine Tab ───────────────────────────────────────────────── */}
      {tab === 'reorder' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-semibold text-red-600">{reorderSummary.lost}</p>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Lost</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Gone cold, needs win-back</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-semibold text-orange-600">{reorderSummary.churning}</p>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Churning</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Significantly overdue</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-semibold text-amber-600">{reorderSummary.at_risk}</p>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">At Risk</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Just past their cycle</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-semibold text-green-600">{reorderSummary.active}</p>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Active</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Within cycle window</p>
            </Card>
          </div>

          {/* Nudge table */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex-1">
                Customer Reorder Nudges
              </h3>
              <div className="relative w-56">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={reorderSearch}
                  onChange={e => setReorderSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="pl-7 py-1.5 text-xs h-8"
                />
              </div>
            </div>

            {filteredNudges.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                {reorderSearch ? 'No customers match your search' : 'No customer purchase history yet'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Last Order</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Overdue</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">LTV</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Nudge</th>
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {filteredNudges.map(nudge => (
                      <tr key={nudge.customer_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{nudge.customer_name}</p>
                          <p className="text-xs text-gray-400">{nudge.customer_phone}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <ChurnBadge level={nudge.churn_level} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600 hidden md:table-cell">
                          {nudge.last_order_date}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          {nudge.overdue_by_days > 0
                            ? <span className="text-sm font-medium text-red-500">+{nudge.overdue_by_days}d</span>
                            : <span className="text-sm text-green-600">on time</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{nudge.total_orders}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">
                          ₹{nudge.total_spent.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              title={nudge.nudge_message}
                              onClick={() => {
                                navigator.clipboard.writeText(nudge.nudge_message)
                                setCopiedPhone(nudge.customer_id)
                                setTimeout(() => setCopiedPhone(null), 2000)
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium rounded-md transition-colors"
                            >
                              {copiedPhone === nudge.customer_id
                                ? <><Copy size={10} /> Copied!</>
                                : <><MessageCircle size={10} /> Copy msg</>
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              {filteredNudges.length} of {allNudges.length} customers · {reorderSummary.lost + reorderSummary.churning} need immediate attention
            </div>
          </Card>
        </div>
      )}

      {/* ── Pincode Tab ──────────────────────────────────────────────────────── */}
      {tab === 'pincode' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Pincodes Reached</p>
              <p className="text-2xl font-semibold text-gray-900">{pincodeSummary.total}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">High RTO Zones</p>
              <p className="text-2xl font-semibold text-red-600">{pincodeSummary.high_rto}</p>
              <p className="text-[10px] text-gray-400">≥30% RTO rate</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Zero RTO Zones</p>
              <p className="text-2xl font-semibold text-green-600">{pincodeSummary.zero_rto}</p>
              <p className="text-[10px] text-gray-400">2+ orders, 0% RTO</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Top Revenue Zone</p>
              <p className="text-xl font-semibold text-gray-900">{pincodeSummary.top_revenue?.pincode ?? '—'}</p>
              <p className="text-[10px] text-gray-400">{pincodeSummary.top_revenue?.city}</p>
            </Card>
          </div>

          <Card>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex-1">Pincode Performance</h3>
              <div className="relative w-56">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={pincodeSearch} onChange={e => setPincodeSearch(e.target.value)} placeholder="Search pincode or city…" className="pl-7 py-1.5 text-xs h-8" />
              </div>
            </div>
            {filteredPincodes.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                {pincodeSearch ? 'No pincodes match your search' : 'No orders in this period'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pincode</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">City / State</th>
                      <SortTh label="Orders"  col="orders"   sort={pincodeSort} asc={pincodeSortAsc} onSort={onPincodeSort} />
                      <SortTh label="Revenue" col="revenue"  sort={pincodeSort} asc={pincodeSortAsc} onSort={onPincodeSort} />
                      <SortTh label="Avg Order" col="aov"    sort={pincodeSort} asc={pincodeSortAsc} onSort={onPincodeSort} />
                      <SortTh label="RTO Rate" col="rto_rate" sort={pincodeSort} asc={pincodeSortAsc} onSort={onPincodeSort} />
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {filteredPincodes.map(p => {
                      const riskDot   = p.rto_rate >= 30 ? 'bg-red-400' : p.rto_rate >= 15 ? 'bg-amber-400' : 'bg-green-400'
                      const riskText  = p.rto_rate >= 30 ? 'text-red-500' : p.rto_rate >= 15 ? 'text-amber-600' : 'text-green-600'
                      const riskLabel = p.rto_rate >= 30 ? 'High' : p.rto_rate >= 15 ? 'Medium' : 'Low'
                      return (
                        <tr key={p.pincode} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-gray-900">{p.pincode}</span></td>
                          <td className="px-4 py-3 hidden sm:table-cell"><p className="text-sm text-gray-700">{p.city}</p><p className="text-xs text-gray-400">{p.state}</p></td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{p.orders}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">₹{p.revenue.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">₹{p.aov.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-gray-700">{p.rto_rate.toFixed(1)}%</span>
                            {p.rto_count > 0 && <span className="text-[10px] text-gray-400 ml-1">({p.rto_count})</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${riskDot}`} />
                              <span className={`text-[11px] font-medium ${riskText}`}>{riskLabel}</span>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">{filteredPincodes.length} of {pincodeData.length} pincodes</div>
          </Card>
        </div>
      )}

      {/* ── Forecast Tab ─────────────────────────────────────────────────────── */}
      {tab === 'forecast' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SumCard label="Out of Stock"  value={summary.out_of_stock_count}  cls="text-red-600" />
            <SumCard label="Reorder Now"   value={summary.reorder_now_count}   cls="text-orange-600" />
            <SumCard label="Reorder Soon"  value={summary.reorder_soon_count}  cls="text-amber-600" />
            <SumCard label="In Stock"      value={summary.in_stock_count}      cls="text-green-600" />
            <SumCard label="Dead Stock"    value={summary.dead_stock_count}    cls="text-gray-400" />
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Daily Demand</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Days Left</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Stockout</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Reorder Qty</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {[...forecasts].sort((a, b) => {
                    const ord: ForecastStatus[] = ['OUT_OF_STOCK', 'REORDER_NOW', 'REORDER_SOON', 'IN_STOCK', 'DEAD_STOCK', 'INSUFFICIENT_DATA', 'UNPREDICTABLE']
                    return ord.indexOf(a.status) - ord.indexOf(b.status)
                  }).map(f => {
                    const s = FORECAST_STATUS_STYLE[f.status]
                    return (
                      <tr key={f.product_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{f.name}</p><p className="text-xs text-gray-400">{f.sku}</p></td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{f.inventory_count}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">{f.avg_daily_demand}/day</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden md:table-cell">{f.days_of_stock >= 999 ? '∞' : f.days_of_stock}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{f.predicted_stockout_date ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                            <span className={`text-[11px] font-medium ${s.text}`}>{s.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">{f.reorder_quantity > 0 ? f.reorder_quantity : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function ChurnBadge({ level }: { level: ChurnLevel }) {
  const styles: Record<ChurnLevel, { dot: string; text: string; label: string }> = {
    LOST:     { dot: 'bg-red-500',    text: 'text-red-600',    label: 'Lost' },
    CHURNING: { dot: 'bg-orange-400', text: 'text-orange-600', label: 'Churning' },
    AT_RISK:  { dot: 'bg-amber-400',  text: 'text-amber-600',  label: 'At Risk' },
    ACTIVE:   { dot: 'bg-green-400',  text: 'text-green-600',  label: 'Active' },
  }
  const s = styles[level]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span className={`text-[11px] font-medium ${s.text}`}>{s.label}</span>
    </span>
  )
}

function SumCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card className="p-4 text-center">
      <p className={`text-2xl font-semibold ${cls}`}>{value}</p>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </Card>
  )
}

function SortTh({ label, col, sort, asc, onSort }: { label: string; col: PincodeSortKey; sort: PincodeSortKey; asc: boolean; onSort: (k: PincodeSortKey) => void }) {
  const active = sort === col
  return (
    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700" onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        {active ? asc ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : <ChevronDown size={11} className="opacity-30" />}
      </span>
    </th>
  )
}
