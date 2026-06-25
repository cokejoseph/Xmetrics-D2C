import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, Search, Check, MessageCircle, Copy } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { buildSKUForecast } from '../../lib/forecastEngine'
import { buildReorderNudgeList, buildReorderForecast } from '../../lib/reorderEngine'
import type { ChurnLevel } from '../../lib/reorderEngine'
import { buildProfitAnalysis } from '../../lib/profitEngine'
import { buildCampaignAnalysis, campaignTotals } from '../../lib/campaignEngine'
import { buildDiscountAnalysis } from '../../lib/discountEngine'
import { useCampaignStore } from '../../stores/campaignStore'
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

type TabType = 'overview' | 'profit' | 'campaigns' | 'discount' | 'cohort' | 'products' | 'rto' | 'operations' | 'clv' | 'reorder' | 'forecast' | 'pincode'
type PincodeSortKey = 'orders' | 'revenue' | 'aov' | 'rto_rate'
type ProductSortKey = 'revenue' | 'units' | 'return_rate' | 'margin' | 'dioh'

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
                value === o.value ? 'text-brand-700 font-semibold bg-brand-50 dark:text-brand-300 dark:bg-brand-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function DeltaChip({ curr, prev, invertGood }: { curr: number; prev: number; invertGood?: boolean }) {
  if (prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  const up = pct >= 0
  const good = invertGood ? !up : up
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${good ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? '↑' : '↓'}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function ClvSegmentBadge({ segment }: { segment: 'VIP' | 'LOYAL' | 'RETURNING' | 'ONE_TIME' }) {
  const STYLES = {
    VIP:       { dot: 'bg-purple-400', text: 'text-purple-600 dark:text-purple-400', label: 'VIP' },
    LOYAL:     { dot: 'bg-blue-400',   text: 'text-blue-600 dark:text-blue-400',     label: 'Loyal' },
    RETURNING: { dot: 'bg-green-400',  text: 'text-green-600 dark:text-green-400',   label: 'Returning' },
    ONE_TIME:  { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400', label: 'One-time' },
  }
  const s = STYLES[segment]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span className={`text-[11px] font-medium ${s.text}`}>{s.label}</span>
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Analytics() {
  useEffect(() => { document.title = 'Analytics · Xmetrics' }, [])
  const [tab, setTab]                     = useState<TabType>('overview')
  const [period, setPeriod]               = useState<Period>('last_30d')
  const [pincodeSearch, setPincodeSearch] = useState('')
  const [pincodeSort, setPincodeSort]     = useState<PincodeSortKey>('orders')
  const [pincodeSortAsc, setPincodeSortAsc] = useState(false)
  const [reorderSearch, setReorderSearch] = useState('')
  const [copiedPhone, setCopiedPhone]     = useState<string | null>(null)
  const [productSort, setProductSort]     = useState<ProductSortKey>('revenue')
  const [productSortAsc, setProductSortAsc] = useState(false)
  const [productCategory, setProductCategory] = useState('all')
  const { orders, products, customers, returns, exceptions } = useAppStore()

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
  const reorderForecast = useMemo(() => buildReorderForecast(allNudges), [allNudges])

  const periodMeta = PERIOD_OPTIONS.find(o => o.value === period)!
  const { from, to } = useMemo(() => getDateRange(period), [period])

  const filteredOrders = useMemo(
    () => orders.filter(o => { const t = new Date(o.created_at); return t >= from && t < to }),
    [orders, from, to],
  )

  // ── Profit Intelligence — true contribution margin after COD + RTO ──────────
  const profit = useMemo(
    () => buildProfitAnalysis(filteredOrders, products, returns),
    [filteredOrders, products, returns],
  )

  // ── Campaign ROI — manual spend → true contribution margin per coupon ───────
  const { campaigns, addCampaign, removeCampaign } = useCampaignStore()
  const [cName, setCName] = useState('')
  const [cCoupon, setCCoupon] = useState('')
  const [cSpend, setCSpend] = useState('')
  const [cChannel, setCChannel] = useState('')
  // Campaign attribution spans the full order history (a campaign isn't bound to
  // the analytics period filter), so it reads from `orders`, not filteredOrders.
  const campaignResults = useMemo(() => buildCampaignAnalysis(campaigns, orders, products), [campaigns, orders, products])
  const campaignSum = useMemo(() => campaignTotals(campaignResults), [campaignResults])

  // ── Discount Leakage — dependency + coupon cannibalization ──────────────────
  const discount = useMemo(() => buildDiscountAnalysis(orders, customers), [orders, customers])
  const submitCampaign = () => {
    const spend = Math.round(Number(cSpend))
    if (!cName.trim() || !cCoupon.trim() || !Number.isFinite(spend) || spend <= 0) return
    addCampaign({ name: cName.trim(), coupon_code: cCoupon.trim(), spend, channel: cChannel.trim() || null, started_at: null })
    setCName(''); setCCoupon(''); setCSpend(''); setCChannel('')
  }

  // ── Previous period (MoM delta) ──────────────────────────────────────────────
  const prevFrom = useMemo(() => new Date(from.getTime() - (to.getTime() - from.getTime())), [from, to])
  const prevPeriodOrders = useMemo(
    () => orders.filter(o => { const t = new Date(o.created_at); return t >= prevFrom && t < from }),
    [orders, prevFrom, from]
  )
  const prevKpis = useMemo(() => {
    const paid = prevPeriodOrders.filter(o => o.payment_status === 'PAID')
    const rev  = paid.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
    const rto  = prevPeriodOrders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
    const del  = prevPeriodOrders.filter(o => o.fulfillment_status === 'DELIVERED')
    return {
      revenue: rev,
      orders: prevPeriodOrders.length,
      aov: paid.length > 0 ? rev / paid.length : 0,
      rtoRate: (del.length + rto.length) > 0 ? rto.length / (del.length + rto.length) * 100 : 0,
    }
  }, [prevPeriodOrders])

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

  // ── Cohort Analysis ──────────────────────────────────────────────────────────
  const cohortAnalysis = useMemo(() => {
    const firstOrderMonth = new Map<string, string>()       // customerId → first month key
    const customerOrderMonths = new Map<string, Set<string>>() // customerId → Set<monthKey>

    for (const order of [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
      if (!order.customer_id) continue
      const mk = getMonthKey(new Date(order.created_at))
      if (!firstOrderMonth.has(order.customer_id)) firstOrderMonth.set(order.customer_id, mk)
      if (!customerOrderMonths.has(order.customer_id)) customerOrderMonths.set(order.customer_id, new Set())
      customerOrderMonths.get(order.customer_id)!.add(mk)
    }

    const cohortMap = new Map<string, string[]>()
    for (const [cid, mk] of firstOrderMonth) {
      if (!cohortMap.has(mk)) cohortMap.set(mk, [])
      cohortMap.get(mk)!.push(cid)
    }

    const allMonths = [...cohortMap.keys()].sort()
    const currentKey = getMonthKey(new Date())
    const MAX_PERIODS = 5

    const rows = allMonths.map(cohortMonth => {
      const customers = cohortMap.get(cohortMonth) ?? []
      const size = customers.length
      const [y, m] = cohortMonth.split('-').map(Number)
      const retention: (number | null)[] = []

      for (let i = 0; i <= MAX_PERIODS; i++) {
        const total = (m - 1) + i
        const tYear = y + Math.floor(total / 12)
        const tMonth = total % 12
        const tKey = `${tYear}-${String(tMonth + 1).padStart(2, '0')}`
        if (tKey > currentKey) { retention.push(null); continue }
        const count = customers.filter(cid => customerOrderMonths.get(cid)?.has(tKey)).length
        retention.push(size > 0 ? Math.round(count / size * 100) : 0)
      }

      return { cohortMonth, label: getMonthLabel(cohortMonth), size, retention }
    })

    return { rows, maxPeriods: MAX_PERIODS }
  }, [orders])

  const cohortSummary = useMemo(() => {
    const withM1 = cohortAnalysis.rows.filter(r => r.retention[1] !== null)
    const avgM1 = withM1.length > 0
      ? withM1.reduce((s, r) => s + (r.retention[1] ?? 0), 0) / withM1.length
      : 0
    const best = [...cohortAnalysis.rows]
      .filter(r => r.retention[1] !== null)
      .sort((a, b) => (b.retention[1] ?? 0) - (a.retention[1] ?? 0))[0] ?? null
    return {
      avgM1Retention: avgM1,
      bestCohort: best,
      totalCustomers: cohortAnalysis.rows.reduce((s, r) => s + r.size, 0),
    }
  }, [cohortAnalysis])

  // ── Enhanced Product Performance ─────────────────────────────────────────────
  const enhancedProductPerf = useMemo(() => {
    const returnedOrderIds = new Set(returns.map(r => r.order_id))

    const map = new Map<string, {
      name: string; sku: string; category: string
      units_sold: number; revenue: number; cost_total: number; returned_units: number
    }>()

    for (const o of orders.filter(o => o.payment_status === 'PAID')) {
      const hasReturn = returnedOrderIds.has(o.id)
      for (const item of o.items ?? []) {
        const key = item.product_id ?? item.sku
        const product = products.find(p => p.id === item.product_id)
        const e = map.get(key) ?? {
          name: item.product?.name ?? item.product_name ?? item.sku,
          sku: item.sku,
          category: product?.category ?? 'Other',
          units_sold: 0, revenue: 0, cost_total: 0, returned_units: 0,
        }
        e.units_sold += item.quantity
        e.revenue += item.unit_price * item.quantity
        e.cost_total += (item.cost_price ?? product?.cost_price ?? 0) * item.quantity
        if (hasReturn) e.returned_units += item.quantity
        map.set(key, e)
      }
    }

    return Array.from(map.values()).map(p => {
      const forecast = forecasts.find(f => f.sku === p.sku)
      return {
        ...p,
        return_rate: p.units_sold > 0 ? (p.returned_units / p.units_sold) * 100 : 0,
        gross_margin: p.cost_total > 0 && p.revenue > 0
          ? ((p.revenue - p.cost_total) / p.revenue) * 100
          : null as number | null,
        dioh: forecast && forecast.avg_daily_demand > 0
          ? Math.round(forecast.inventory_count / forecast.avg_daily_demand)
          : null as number | null,
        inventory: forecast?.inventory_count ?? 0,
      }
    })
  }, [orders, products, returns, forecasts])

  const productPerfSummary = useMemo(() => {
    const withMargin = enhancedProductPerf.filter(p => p.gross_margin !== null)
    return {
      avgReturnRate: enhancedProductPerf.length > 0
        ? enhancedProductPerf.reduce((s, p) => s + p.return_rate, 0) / enhancedProductPerf.length
        : 0,
      avgMargin: withMargin.length > 0
        ? withMargin.reduce((s, p) => s + (p.gross_margin ?? 0), 0) / withMargin.length
        : 0,
      highReturnCount: enhancedProductPerf.filter(p => p.return_rate >= 20).length,
    }
  }, [enhancedProductPerf])

  const productCategories = useMemo(
    () => ['all', ...Array.from(new Set(enhancedProductPerf.map(p => p.category))).sort()],
    [enhancedProductPerf]
  )

  const sortedProductPerf = useMemo(() => {
    const list = productCategory === 'all'
      ? enhancedProductPerf
      : enhancedProductPerf.filter(p => p.category === productCategory)
    return [...list].sort((a, b) => {
      let va: number, vb: number
      switch (productSort) {
        case 'units':       va = a.units_sold;          vb = b.units_sold; break
        case 'return_rate': va = a.return_rate;          vb = b.return_rate; break
        case 'margin':      va = a.gross_margin ?? -1;   vb = b.gross_margin ?? -1; break
        case 'dioh':        va = a.dioh ?? 9999;         vb = b.dioh ?? 9999; break
        default:            va = a.revenue;              vb = b.revenue
      }
      return productSortAsc ? va - vb : vb - va
    })
  }, [enhancedProductPerf, productCategory, productSort, productSortAsc])

  const toggleProductSort = (key: ProductSortKey) => {
    if (productSort === key) setProductSortAsc(a => !a)
    else { setProductSort(key); setProductSortAsc(false) }
  }

  // ── RTO Intelligence ──────────────────────────────────────────────────────────
  const rtoKpis = useMemo(() => {
    const rtoO    = filteredOrders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
    const settled = filteredOrders.filter(o => ['DELIVERED', 'RTO_INITIATED'].includes(o.fulfillment_status))
    return {
      total:         rtoO.length,
      rate:          settled.length > 0 ? rtoO.length / settled.length * 100 : 0,
      estimatedLoss: rtoO.reduce((s, o) => s + (o.gross_amount - o.discount_amount) * 0.15, 0),
      avgScore:      filteredOrders.length > 0 ? filteredOrders.reduce((s, o) => s + o.rto_risk_score, 0) / filteredOrders.length : 0,
      highRisk:      filteredOrders.filter(o => o.rto_risk_score >= 60).length,
      pendingReview: filteredOrders.filter(o => o.rto_review_status === 'PENDING').length,
    }
  }, [filteredOrders])

  const rtoByChannel = useMemo(() => {
    const map = new Map<string, { total: number; rto: number }>()
    for (const o of filteredOrders) {
      const e = map.get(o.channel) ?? { total: 0, rto: 0 }
      map.set(o.channel, { total: e.total + 1, rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0) })
    }
    return Array.from(map.entries())
      .map(([ch, d]) => ({ channel: CHANNEL_LABELS[ch] ?? ch, total: d.total, rto: d.rto, rate: d.total > 0 ? d.rto / d.total * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate)
  }, [filteredOrders])

  const rtoByPayment = useMemo(() => {
    const map = new Map<string, { total: number; rto: number }>()
    for (const o of filteredOrders) {
      const e = map.get(o.payment_method) ?? { total: 0, rto: 0 }
      map.set(o.payment_method, { total: e.total + 1, rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0) })
    }
    return Array.from(map.entries())
      .map(([m, d]) => ({ method: METHOD_LABELS[m] ?? m, total: d.total, rto: d.rto, rate: d.total > 0 ? d.rto / d.total * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate)
  }, [filteredOrders])

  const rtoScoreBuckets = useMemo(() => {
    const buckets = [
      { label: '0–25',   min: 0,  max: 25,  count: 0, rto: 0 },
      { label: '26–50',  min: 26, max: 50,  count: 0, rto: 0 },
      { label: '51–75',  min: 51, max: 75,  count: 0, rto: 0 },
      { label: '76–100', min: 76, max: 100, count: 0, rto: 0 },
    ]
    for (const o of filteredOrders) {
      const b = buckets.find(x => o.rto_risk_score >= x.min && o.rto_risk_score <= x.max)
      if (b) { b.count++; if (o.fulfillment_status === 'RTO_INITIATED') b.rto++ }
    }
    return buckets.map(b => ({ ...b, rate: b.count > 0 ? b.rto / b.count * 100 : 0 }))
  }, [filteredOrders])

  // ── Operations Intelligence ───────────────────────────────────────────────────
  const timeToShipData = useMemo(() => {
    const times: number[] = []
    for (const o of filteredOrders) {
      if (!o.shipments || o.shipments.length === 0) continue
      const first = [...o.shipments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
      const hours = (new Date(first.created_at).getTime() - new Date(o.created_at).getTime()) / 3600000
      if (hours >= 0 && hours < 720) times.push(hours)
    }
    if (times.length === 0) return null
    const sorted = [...times].sort((a, b) => a - b)
    return {
      avg:    times.reduce((s, t) => s + t, 0) / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      total:  times.length,
      buckets: [
        { label: '<12h',  count: times.filter(t => t < 12).length },
        { label: '12–24h',count: times.filter(t => t >= 12 && t < 24).length },
        { label: '1–2d',  count: times.filter(t => t >= 24 && t < 48).length },
        { label: '2–3d',  count: times.filter(t => t >= 48 && t < 72).length },
        { label: '3–5d',  count: times.filter(t => t >= 72 && t < 120).length },
        { label: '5d+',   count: times.filter(t => t >= 120).length },
      ],
    }
  }, [filteredOrders])

  const fulfillmentFunnel = useMemo(() => [
    { label: 'Confirmed',        status: 'CONFIRMED' as const },
    { label: 'Processing',       status: 'PROCESSING' as const },
    { label: 'Shipped',          status: 'SHIPPED' as const },
    { label: 'In Transit',       status: 'IN_TRANSIT' as const },
    { label: 'Out for Delivery', status: 'OUT_FOR_DELIVERY' as const },
    { label: 'Delivered',        status: 'DELIVERED' as const },
  ].map(s => ({ ...s, count: filteredOrders.filter(o => o.fulfillment_status === s.status).length }))
  , [filteredOrders])

  const exceptionBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; unresolved: number }>()
    for (const e of exceptions) {
      const d = map.get(e.type) ?? { total: 0, unresolved: 0 }
      map.set(e.type, { total: d.total + 1, unresolved: d.unresolved + (e.status === 'UNRESOLVED' ? 1 : 0) })
    }
    return Array.from(map.entries())
      .map(([type, d]) => ({ type, label: type.replace(/_/g, ' '), ...d }))
      .sort((a, b) => b.total - a.total)
  }, [exceptions])

  const opsKpis = useMemo(() => {
    const shipped   = filteredOrders.filter(o => ['SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED'].includes(o.fulfillment_status))
    const ndrOrders = filteredOrders.filter(o => o.fulfillment_status === 'NDR')
    return {
      shipped:          shipped.length,
      ndrRate:          filteredOrders.length > 0 ? ndrOrders.length / filteredOrders.length * 100 : 0,
      avgHoursToShip:   timeToShipData?.avg ?? null,
      medianHoursToShip:timeToShipData?.median ?? null,
      exUnresolved:     exceptions.filter(e => e.status === 'UNRESOLVED').length,
      returnCount:      returns.length,
    }
  }, [filteredOrders, exceptions, returns, timeToShipData])

  const returnsByReason = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of returns) {
      map.set(r.return_reason, (map.get(r.return_reason) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason: reason.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count)
  }, [returns])

  // ── Customer LTV / Segmentation ───────────────────────────────────────────────
  const customerClv = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string; phone: string; city: string; state: string
      orderCount: number; totalSpent: number; firstOrderAt: number; lastOrderAt: number
    }>()
    for (const o of orders) {
      if (!o.customer_id) continue
      const cust = customers.find(c => c.id === o.customer_id)
      if (!cust) continue
      const e = map.get(o.customer_id) ?? {
        id: o.customer_id, name: cust.name, phone: cust.phone,
        city: cust.city, state: cust.state,
        orderCount: 0, totalSpent: 0, firstOrderAt: Infinity, lastOrderAt: -Infinity,
      }
      const t = new Date(o.created_at).getTime()
      map.set(o.customer_id, {
        ...e,
        orderCount: e.orderCount + 1,
        totalSpent: e.totalSpent + (o.payment_status === 'PAID' ? o.gross_amount - o.discount_amount : 0),
        firstOrderAt: Math.min(e.firstOrderAt, t),
        lastOrderAt:  Math.max(e.lastOrderAt, t),
      })
    }
    return Array.from(map.values()).map(c => ({
      ...c,
      daysSinceFirst: Math.round((Date.now() - c.firstOrderAt) / 86400000),
      daysSinceLast:  Math.round((Date.now() - c.lastOrderAt) / 86400000),
      avgOrderValue:  c.orderCount > 0 ? c.totalSpent / c.orderCount : 0,
      segment: (c.orderCount >= 5 || c.totalSpent >= 10000) ? 'VIP' as const
        : c.orderCount >= 3 ? 'LOYAL' as const
        : c.orderCount >= 2 ? 'RETURNING' as const
        : 'ONE_TIME' as const,
    })).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [orders, customers])

  const clvSegments = useMemo(() => {
    const vip      = customerClv.filter(c => c.segment === 'VIP')
    const loyal    = customerClv.filter(c => c.segment === 'LOYAL')
    const ret      = customerClv.filter(c => c.segment === 'RETURNING')
    const oneTime  = customerClv.filter(c => c.segment === 'ONE_TIME')
    const total    = customerClv.reduce((s, c) => s + c.totalSpent, 0)
    return {
      vip:      { count: vip.length,    revenue: vip.reduce((s, c) => s + c.totalSpent, 0) },
      loyal:    { count: loyal.length,  revenue: loyal.reduce((s, c) => s + c.totalSpent, 0) },
      returning:{ count: ret.length,    revenue: ret.reduce((s, c) => s + c.totalSpent, 0) },
      oneTime:  { count: oneTime.length,revenue: oneTime.reduce((s, c) => s + c.totalSpent, 0) },
      total,
      avgClv:   customerClv.length > 0 ? total / customerClv.length : 0,
    }
  }, [customerClv])

  const granularityLabel: Record<Granularity, string> = {
    hour: 'Hourly', day: 'Daily', week: 'Weekly', month: 'Monthly',
  }

  const TABS: { key: TabType; label: string }[] = [
    { key: 'overview',   label: 'Overview' },
    { key: 'profit',     label: 'Profit Intelligence' },
    { key: 'campaigns',  label: 'Campaign ROI' },
    { key: 'discount',   label: 'Discount Leakage' },
    { key: 'cohort',     label: 'Cohort Analysis' },
    { key: 'products',   label: 'Product Analysis' },
    { key: 'rto',        label: 'RTO Intelligence' },
    { key: 'operations', label: 'Operations' },
    { key: 'clv',        label: 'Customer LTV' },
    { key: 'reorder',    label: 'Reorder Engine' },
    { key: 'forecast',   label: 'Demand Forecast' },
    { key: 'pincode',    label: 'Pincode Intelligence' },
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
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {tab === 'overview'    ? periodMeta.label
             : tab === 'profit'   ? 'True contribution margin after COD, RTO & all costs — ' + periodMeta.shortLabel
             : tab === 'campaigns'? 'Marketing ROI on true profit, not revenue — manual spend by coupon'
             : tab === 'discount' ? 'Discount dependency & coupon cannibalization — the margin you give away'
             : tab === 'reorder'  ? 'Churn intelligence'
             : tab === 'cohort'   ? 'Customer retention by monthly cohort'
             : tab === 'products' ? 'Product-level performance, returns & inventory'
             : tab === 'rto'      ? 'Return-to-origin root cause analysis — ' + periodMeta.shortLabel
             : tab === 'operations'? 'Fulfillment velocity & exception management — ' + periodMeta.shortLabel
             : tab === 'clv'      ? 'Customer lifetime value & segment intelligence'
             : 'Demand forecast'}
          </p>
        </div>
        {(['overview','profit','rto','operations','pincode'] as TabType[]).includes(tab) && (
          <PeriodPicker value={period} onChange={setPeriod} />
        )}
      </div>

      <div className="flex gap-6 border-b border-gray-100 overflow-x-auto">
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
              <p className="text-[26px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">₹{totalRevenue >= 1000 ? `${Math.round(totalRevenue / 1000)}k` : Math.round(totalRevenue)}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400">{periodMeta.shortLabel}</span>
                <DeltaChip curr={totalRevenue} prev={prevKpis.revenue} />
              </div>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Orders</p>
              <p className="text-[26px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{filteredOrders.length}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400">{periodMeta.shortLabel}</span>
                <DeltaChip curr={filteredOrders.length} prev={prevKpis.orders} />
              </div>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Avg Order Value</p>
              <p className="text-[26px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">₹{aov.toLocaleString('en-IN')}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400">paid orders</span>
                <DeltaChip curr={aov} prev={prevKpis.aov} />
              </div>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">RTO Rate</p>
              <p className="text-[26px] font-semibold text-red-600 dark:text-red-400 leading-none tabular-nums">{rtoRate.toFixed(1)}%</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400">{periodMeta.shortLabel}</span>
                <DeltaChip curr={rtoRate} prev={prevKpis.rtoRate} invertGood />
              </div>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Gross Margin</p>
              <p className="text-[26px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">{cogs > 0 ? `${grossMarginPct.toFixed(1)}%` : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">after COGS</p>
            </Card>
            <Card className="px-4 py-3.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">RTO Loss</p>
              <p className="text-[26px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">₹{Math.round(rtoLoss).toLocaleString('en-IN')}</p>
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

      {/* ── Profit Intelligence Tab ─────────────────────────────────────────── */}
      {tab === 'profit' && (() => {
        const s = profit.summary
        const wfTotal = s.cogs + s.forwardShipping + s.paymentFees + s.rtoLosses + Math.max(s.contributionMargin, 0)
        const wf = [
          { label: 'COGS',          val: s.cogs,            color: 'bg-amber-400' },
          { label: 'Forward ship',  val: s.forwardShipping, color: 'bg-orange-400' },
          { label: 'Payment fees',  val: s.paymentFees,     color: 'bg-violet-400' },
          { label: 'RTO losses',    val: s.rtoLosses,       color: 'bg-red-400' },
          { label: 'Contribution',  val: Math.max(s.contributionMargin, 0), color: 'bg-emerald-400' },
        ]
        const sevStyle = {
          critical: { dot: 'bg-red-500',   box: 'bg-red-50/60 dark:bg-red-900/10 border-red-100 dark:border-red-900/20',   val: 'text-red-600 dark:text-red-400' },
          warning:  { dot: 'bg-amber-500', box: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20', val: 'text-amber-600 dark:text-amber-400' },
          good:     { dot: 'bg-emerald-500', box: 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20', val: 'text-emerald-600 dark:text-emerald-400' },
        } as const
        const money = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
        return (
        <div className="space-y-4">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">True Contribution Margin</p>
              <p className={`text-[26px] font-semibold leading-none tabular-nums ${s.contributionMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {money(s.contributionMargin)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1.5">{s.contributionMarginPct.toFixed(1)}% of delivered revenue · after RTO</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Gross Revenue</p>
              <p className="text-[26px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{money(s.grossRevenue)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{s.delivered} delivered orders</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">RTO Losses</p>
              <p className="text-[26px] font-semibold text-red-600 dark:text-red-400 leading-none tabular-nums">−{money(s.rtoLosses).replace('−','')}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{s.rto} RTO orders · round-trip + handling</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Cash Locked (COD)</p>
              <p className="text-[26px] font-semibold text-amber-600 dark:text-amber-400 leading-none tabular-nums">{money(s.codCashInTransit)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">shipped, not yet remitted</p>
            </Card>
          </div>

          {/* The insights — what the P&L is hiding */}
          {profit.insights.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What your revenue number is hiding</h3>
              <p className="text-xs text-gray-400 mb-4">Decisions you can act on today — the economics no other tool surfaces for COD + RTO.</p>
              <div className="space-y-2.5">
                {profit.insights.map((ins, i) => {
                  const st = sevStyle[ins.severity]
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${st.box}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{ins.title}</span>
                          {ins.value && <span className={`text-sm font-bold tabular-nums shrink-0 ${st.val}`}>{ins.value}</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{ins.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* P&L waterfall */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Where every rupee of delivered revenue goes</h3>
            <p className="text-xs text-gray-400 mb-4">Gross revenue {money(s.grossRevenue)} → contribution {money(s.contributionMargin)}</p>
            {wfTotal > 0 ? (
              <>
                <div className="h-7 w-full rounded-lg overflow-hidden flex mb-3">
                  {wf.filter(seg => seg.val > 0).map(seg => (
                    <div key={seg.label} className={`h-full ${seg.color}`} style={{ width: `${seg.val / wfTotal * 100}%` }} title={`${seg.label}: ${money(seg.val)}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {wf.map(seg => (
                    <div key={seg.label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 leading-tight">{seg.label}</p>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{money(seg.val)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-gray-400 text-center py-6">No delivered orders in this period yet.</p>}
          </Card>

          {/* By channel + by payment method */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Contribution Margin by Channel</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Worst first — negative channels lose money after RTO</p>
              </div>
              {profit.byChannel.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No realized orders this period</p>
                : <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {profit.byChannel.map(g => (
                      <div key={g.key} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{g.key}</span>
                          <span className={`text-sm font-semibold tabular-nums ${g.contribution >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {money(g.contribution)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{g.delivered} delivered · {g.rto} RTO</span>
                          <span className={g.negative ? 'text-red-500 font-medium' : ''}>
                            {g.negative ? 'MARGIN-NEGATIVE' : `${g.marginPct.toFixed(0)}% margin`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </Card>

            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Contribution Margin by Payment Method</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">The real COD vs prepaid profitability</p>
              </div>
              {profit.byPayment.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No realized orders this period</p>
                : <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {profit.byPayment.map(g => (
                      <div key={g.key} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{g.key}</span>
                          <span className={`text-sm font-semibold tabular-nums ${g.contribution >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {money(g.contribution)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{g.delivered} delivered · {g.rto} RTO</span>
                          <span className={g.negative ? 'text-red-500 font-medium' : ''}>
                            {g.negative ? 'MARGIN-NEGATIVE' : `${g.marginPct.toFixed(0)}% margin`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </Card>
          </div>
        </div>
        )
      })()}

      {/* ── Campaign ROI Tab ────────────────────────────────────────────────── */}
      {tab === 'campaigns' && (() => {
        const money = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
        const verdictStyle = {
          PROFITABLE: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
          BREAKEVEN:  'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400',
          LOSS:       'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
          NO_DATA:    'bg-gray-50 dark:bg-white/[0.04] text-gray-400',
        } as const
        const vanityTraps = campaignResults.filter(r => r.verdict !== 'NO_DATA' && r.revenueRoas >= 1.5 && r.netProfit < 0)
        return (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Marketing Spend</p>
              <p className="text-[24px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{money(campaignSum.spend)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{campaignResults.length} campaigns tracked</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Net Profit (after spend)</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${campaignSum.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{money(campaignSum.netProfit)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">contribution {money(campaignSum.contribution)} − spend</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">True Margin ROAS</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${campaignSum.blendedMarginRoas >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{campaignSum.blendedMarginRoas.toFixed(2)}×</p>
              <p className="text-[10px] text-gray-400 mt-1.5">₹ margin per ₹ spend (not revenue)</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Loss-making</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${campaignSum.losers > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{campaignSum.losers}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">campaigns losing money after RTO</p>
            </Card>
          </div>

          {/* The vanity-ROAS trap callout */}
          {vanityTraps.length > 0 && (
            <Card className="p-4 border border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/10">
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{vanityTraps.length} campaign{vanityTraps.length > 1 ? 's look' : ' looks'} like a winner but loses money</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {vanityTraps.map(r => `${r.campaign.name} (${r.revenueRoas.toFixed(1)}× revenue ROAS → ${money(r.netProfit)} net after RTO)`).join(' · ')}.
                    Revenue ROAS hides the truth — these orders go COD to high-RTO pincodes and the margin never lands.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Add campaign — manual entry */}
          <Card className="p-4">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Add campaign spend</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <Input placeholder="Campaign name" value={cName} onChange={e => setCName(e.target.value)} />
              <Input placeholder="Coupon code" value={cCoupon} onChange={e => setCCoupon(e.target.value.toUpperCase())} />
              <Input placeholder="Spend (₹)" type="number" value={cSpend} onChange={e => setCSpend(e.target.value)} />
              <Input placeholder="Channel (optional)" value={cChannel} onChange={e => setCChannel(e.target.value)} />
              <button
                onClick={submitCampaign}
                disabled={!cName.trim() || !cCoupon.trim() || !(Number(cSpend) > 0)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add campaign
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Orders that used the coupon are attributed to the campaign and run through the contribution-margin engine.</p>
          </Card>

          {/* Results table */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Campaign profitability — worst first</h3>
            </div>
            {campaignResults.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No campaigns yet — add one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Campaign</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Spend</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Orders</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">RTO</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell" title="Revenue / spend — the vanity metric">Rev ROAS</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider" title="True contribution margin / spend">Margin ROAS</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Net Profit</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider w-8" />
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {campaignResults.map(r => (
                      <tr key={r.campaign.id} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.campaign.name}</p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${verdictStyle[r.verdict]}`}>{r.verdict.replace('_', ' ')}</span>
                          </div>
                          <p className="text-[11px] text-gray-400">{r.campaign.coupon_code}{r.campaign.channel ? ` · ${r.campaign.channel}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{money(r.spend)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400 tabular-nums hidden sm:table-cell">{r.delivered}<span className="text-gray-300 dark:text-gray-600">/{r.orders}</span></td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums hidden lg:table-cell">
                          <span className={r.rtoRate >= 20 ? 'text-red-500' : r.rtoRate >= 10 ? 'text-amber-500' : 'text-gray-500'}>{r.rtoRate.toFixed(0)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-400 tabular-nums hidden md:table-cell line-through decoration-gray-300">{r.verdict === 'NO_DATA' ? '—' : `${r.revenueRoas.toFixed(1)}×`}</td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${r.marginRoas >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.verdict === 'NO_DATA' ? '—' : `${r.marginRoas.toFixed(2)}×`}</td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${r.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.verdict === 'NO_DATA' ? '—' : money(r.netProfit)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeCampaign(r.campaign.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 text-xs" title="Remove campaign">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] text-[11px] text-gray-400">
                  Margin ROAS uses true contribution margin (after COGS, shipping, RTO, COD &amp; gateway fees) — not revenue. A campaign can win on Rev ROAS and still lose money.
                </div>
              </div>
            )}
          </Card>
        </div>
        )
      })()}

      {/* ── Discount Leakage Tab ────────────────────────────────────────────── */}
      {tab === 'discount' && (() => {
        const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
        const sevStyle = {
          critical: { dot: 'bg-red-500',     box: 'bg-red-50/60 dark:bg-red-900/10 border-red-100 dark:border-red-900/20',     val: 'text-red-600 dark:text-red-400' },
          warning:  { dot: 'bg-amber-500',   box: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20', val: 'text-amber-600 dark:text-amber-400' },
          good:     { dot: 'bg-emerald-500', box: 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20', val: 'text-emerald-600 dark:text-emerald-400' },
        } as const
        const d = discount
        return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Discount Given</p>
              <p className="text-[24px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{money(d.summary.totalDiscount)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">{d.summary.discountedOrders} of {d.summary.totalOrders} orders</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">% of GMV Given Away</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${d.summary.discountAsPctOfGmv >= 15 ? 'text-red-600 dark:text-red-400' : d.summary.discountAsPctOfGmv >= 8 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{d.summary.discountAsPctOfGmv.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-400 mt-1.5">of gross order value</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Discount-Dependent</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${d.summary.dependentCustomers > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{d.summary.dependentCustomers}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">customers who rarely pay full price</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Cannibalized Margin</p>
              <p className={`text-[24px] font-semibold leading-none tabular-nums ${d.summary.cannibalizedTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{money(d.summary.cannibalizedTotal)}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">to existing repeat customers</p>
            </Card>
          </div>

          {d.insights.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Where your discounts leak</h3>
              <p className="text-xs text-gray-400 mb-4">Margin you give away that you may not need to.</p>
              <div className="space-y-2.5">
                {d.insights.map((ins, i) => {
                  const st = sevStyle[ins.severity]
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${st.box}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{ins.title}</span>
                          {ins.value && <span className={`text-sm font-bold tabular-nums shrink-0 ${st.val}`}>{ins.value}</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{ins.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coupon cannibalization */}
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Coupon Cannibalization</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Codes redeemed by existing customers = margin given to people who'd buy anyway</p>
              </div>
              {d.coupons.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No coupon redemptions yet</p>
                : <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {d.coupons.map(c => (
                      <div key={c.code} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{c.code}</span>
                          <span className={`text-sm font-semibold tabular-nums ${c.cannibalizationPct >= 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{money(c.cannibalizedDiscount)} lost</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{c.redemptions} redemptions · {c.toNew} new / {c.toExisting} existing</span>
                          <span className={c.cannibalizationPct >= 40 ? 'text-red-500 font-medium' : ''}>{c.cannibalizationPct.toFixed(0)}% to existing</span>
                        </div>
                        <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.cannibalizationPct >= 40 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${c.cannibalizationPct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>}
            </Card>

            {/* Discount-dependent customers */}
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Most Discount-Dependent Customers</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">High % = they may only buy when there's a code</p>
              </div>
              {d.dependentCustomers.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No discounted orders yet</p>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                          <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Discounted</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.dependentCustomers.slice(0, 12).map(c => (
                          <tr key={c.id} className="border-b border-gray-50 dark:border-white/[0.03]">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900 dark:text-white">{c.name}</span>
                                {c.neverFullPrice && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">NEVER FULL PRICE</span>}
                              </div>
                              <p className="text-[10px] text-gray-400">{c.totalOrders} orders</p>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`text-sm font-semibold tabular-nums ${c.dependencyPct === 100 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>{c.dependencyPct.toFixed(0)}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm text-gray-600 dark:text-gray-400 tabular-nums">{money(c.totalDiscount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </Card>
          </div>
        </div>
        )
      })()}

      {/* ── RTO Intelligence Tab ────────────────────────────────────────────── */}
      {tab === 'rto' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">RTO Orders</p>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{rtoKpis.total}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">RTO Rate</p>
              <p className={`text-2xl font-semibold ${rtoKpis.rate >= 20 ? 'text-red-600 dark:text-red-400' : rtoKpis.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {rtoKpis.rate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">of settled orders</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Est. RTO Loss</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">₹{Math.round(rtoKpis.estimatedLoss).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">~15% of order value</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">High Risk Orders</p>
              <p className={`text-2xl font-semibold ${rtoKpis.highRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {rtoKpis.highRisk}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">score ≥60, needs review</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">RTO Rate by Channel</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Which acquisition channel delivers the most RTOs</p>
              </div>
              {rtoByChannel.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No data for this period</p>
                : <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {rtoByChannel.map(r => (
                      <div key={r.channel} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{r.channel}</span>
                          <span className="text-xs text-gray-400">{r.rto} RTOs / {r.total} orders</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${r.rate >= 20 ? 'bg-red-400' : r.rate >= 10 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${Math.min(r.rate * 2.5, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold w-12 text-right shrink-0 ${r.rate >= 20 ? 'text-red-600 dark:text-red-400' : r.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            {r.rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </Card>

            <Card>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">RTO Rate by Payment Method</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">COD typically drives higher RTO — confirm here</p>
              </div>
              {rtoByPayment.length === 0
                ? <p className="px-4 py-8 text-center text-sm text-gray-400">No data for this period</p>
                : <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {rtoByPayment.map(r => (
                      <div key={r.method} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{r.method}</span>
                          <span className="text-xs text-gray-400">{r.rto} RTOs / {r.total} orders</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${r.rate >= 20 ? 'bg-red-400' : r.rate >= 10 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${Math.min(r.rate * 2.5, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold w-12 text-right shrink-0 ${r.rate >= 20 ? 'text-red-600 dark:text-red-400' : r.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            {r.rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Risk Score Distribution vs Actual RTO Rate</h3>
            <p className="text-xs text-gray-400 mb-4">Validates that the RTO model is correctly scoring high-risk orders</p>
            <div className="grid grid-cols-4 gap-3">
              {rtoScoreBuckets.map(b => {
                const tiers = ['bg-green-50 dark:bg-green-900/10', 'bg-yellow-50 dark:bg-yellow-900/10', 'bg-amber-50 dark:bg-amber-900/10', 'bg-red-50 dark:bg-red-900/10']
                const idx = rtoScoreBuckets.indexOf(b)
                return (
                  <div key={b.label} className={`rounded-xl p-4 text-center ${tiers[idx]}`}>
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Score {b.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{b.count}</p>
                    <p className="text-[10px] text-gray-400 mt-1">orders</p>
                    {b.count > 0 && (
                      <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10">
                        <p className={`text-xs font-semibold ${b.rate >= 20 ? 'text-red-600 dark:text-red-400' : b.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                          {b.rate.toFixed(0)}% RTO
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              Avg risk score: <span className="font-semibold text-gray-700 dark:text-gray-300">{rtoKpis.avgScore.toFixed(1)}</span>
              {' · '}Pending review: <span className="font-semibold text-amber-600">{rtoKpis.pendingReview}</span>
            </p>
          </Card>
        </div>
      )}

      {/* ── Operations Tab ───────────────────────────────────────────────────── */}
      {tab === 'operations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Avg Time to Ship</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {opsKpis.avgHoursToShip !== null
                  ? opsKpis.avgHoursToShip < 24
                    ? `${Math.round(opsKpis.avgHoursToShip)}h`
                    : `${(opsKpis.avgHoursToShip / 24).toFixed(1)}d`
                  : '—'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">order → first shipment</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Orders Shipped</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{opsKpis.shipped}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{periodMeta.shortLabel}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Open Exceptions</p>
              <p className={`text-2xl font-semibold ${opsKpis.exUnresolved > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {opsKpis.exUnresolved}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">unresolved</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">NDR Rate</p>
              <p className={`text-2xl font-semibold ${opsKpis.ndrRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {opsKpis.ndrRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">non-delivery reports</p>
            </Card>
          </div>

          {/* Fulfillment Pipeline */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Fulfillment Pipeline</h3>
            <p className="text-xs text-gray-400 mb-5">Live count of orders in each fulfillment stage — {periodMeta.shortLabel}</p>
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {fulfillmentFunnel.map(stage => {
                const maxC = Math.max(...fulfillmentFunnel.map(s => s.count), 1)
                const h = Math.max(stage.count / maxC * 72, 6)
                const colorMap: Record<string, string> = {
                  DELIVERED: 'bg-green-400 dark:bg-green-500',
                  OUT_FOR_DELIVERY: 'bg-blue-400 dark:bg-blue-500',
                  IN_TRANSIT: 'bg-brand-400 dark:bg-brand-500',
                  SHIPPED: 'bg-brand-300 dark:bg-brand-400',
                }
                return (
                  <div key={stage.status} className="flex-1 min-w-[70px] flex flex-col items-center gap-2">
                    <span className="text-base font-bold text-gray-900 dark:text-white">{stage.count}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-700 ${colorMap[stage.status] ?? 'bg-gray-200 dark:bg-white/20'}`}
                        style={{ height: `${h}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 text-center leading-tight">{stage.label}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Time to Ship */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Time to Ship Distribution</h3>
              <p className="text-xs text-gray-400 mb-4">
                {timeToShipData
                  ? `Avg ${timeToShipData.avg < 24 ? `${Math.round(timeToShipData.avg)}h` : `${(timeToShipData.avg/24).toFixed(1)}d`}  ·  Median ${timeToShipData.median < 24 ? `${Math.round(timeToShipData.median)}h` : `${(timeToShipData.median/24).toFixed(1)}d`}  ·  ${timeToShipData.total} orders`
                  : 'No shipment data available'}
              </p>
              {timeToShipData ? (
                <div className="space-y-2">
                  {timeToShipData.buckets.map(b => {
                    const maxC = Math.max(...timeToShipData.buckets.map(x => x.count), 1)
                    return (
                      <div key={b.label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0">{b.label}</span>
                        <div className="flex-1 h-5 bg-gray-100 dark:bg-white/10 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-brand-400 dark:bg-brand-500 rounded-md transition-all duration-500"
                            style={{ width: `${b.count / maxC * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-6 text-right shrink-0">{b.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No shipments found in this period</p>
              )}
            </Card>

            {/* Exception + Returns breakdown */}
            <div className="space-y-4">
              <Card>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                  <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Exception Breakdown</h3>
                </div>
                {exceptionBreakdown.length === 0
                  ? <p className="px-4 py-6 text-center text-sm text-gray-400">No exceptions</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                            <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total</th>
                            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exceptionBreakdown.map(e => (
                            <tr key={e.type} className="border-b border-gray-50 dark:border-white/[0.03]">
                              <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white capitalize">{e.label.toLowerCase()}</td>
                              <td className="px-4 py-2.5 text-right text-sm text-gray-700 dark:text-gray-300">{e.total}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`text-sm font-medium ${e.unresolved > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{e.unresolved}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>}
              </Card>

              {returnsByReason.length > 0 && (
                <Card>
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                    <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Returns by Reason</h3>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                    {returnsByReason.map(r => {
                      const maxC = returnsByReason[0].count
                      return (
                        <div key={r.reason} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize flex-1">{r.reason}</span>
                          <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${r.count / maxC * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-6 text-right shrink-0">{r.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Customer LTV Tab ─────────────────────────────────────────────────── */}
      {tab === 'clv' && (
        <div className="space-y-4">
          {/* Segment cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">VIP</p>
              </div>
              <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">{clvSegments.vip.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{Math.round(clvSegments.vip.revenue).toLocaleString('en-IN')} LTV</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">5+ orders or ₹10k+ spend</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Loyal</p>
              </div>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{clvSegments.loyal.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{Math.round(clvSegments.loyal.revenue).toLocaleString('en-IN')} LTV</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">3–4 orders</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Returning</p>
              </div>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{clvSegments.returning.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{Math.round(clvSegments.returning.revenue).toLocaleString('en-IN')} LTV</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">2 orders</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">One-time</p>
              </div>
              <p className="text-2xl font-semibold text-gray-600 dark:text-gray-300">{clvSegments.oneTime.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">₹{Math.round(clvSegments.oneTime.revenue).toLocaleString('en-IN')} LTV</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">single order</p>
            </Card>
          </div>

          {/* Revenue concentration stacked bar */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Revenue Concentration by Segment</h3>
            <p className="text-xs text-gray-400 mb-4">
              Total LTV: ₹{Math.round(clvSegments.total).toLocaleString('en-IN')}  ·  Avg CLV: ₹{Math.round(clvSegments.avgClv).toLocaleString('en-IN')}  ·  {customerClv.length} customers
            </p>
            {clvSegments.total > 0 && (
              <>
                <div className="h-6 w-full rounded-full overflow-hidden flex">
                  {([
                    { key: 'vip',      val: clvSegments.vip.revenue,       color: 'bg-purple-400' },
                    { key: 'loyal',    val: clvSegments.loyal.revenue,     color: 'bg-blue-400' },
                    { key: 'returning',val: clvSegments.returning.revenue,  color: 'bg-green-400' },
                    { key: 'oneTime',  val: clvSegments.oneTime.revenue,    color: 'bg-gray-200 dark:bg-white/20' },
                  ] as const).map(s => (
                    <div
                      key={s.key}
                      className={`h-full transition-all duration-700 ${s.color}`}
                      style={{ width: `${s.val / clvSegments.total * 100}%` }}
                      title={`₹${Math.round(s.val).toLocaleString('en-IN')} (${Math.round(s.val / clvSegments.total * 100)}%)`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 flex-wrap text-[11px] text-gray-500">
                  {[
                    { label: 'VIP',       color: 'bg-purple-400', rev: clvSegments.vip.revenue },
                    { label: 'Loyal',     color: 'bg-blue-400',   rev: clvSegments.loyal.revenue },
                    { label: 'Returning', color: 'bg-green-400',  rev: clvSegments.returning.revenue },
                    { label: 'One-time',  color: 'bg-gray-300 dark:bg-white/30', rev: clvSegments.oneTime.revenue },
                  ].map(s => (
                    <span key={s.label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
                      {s.label} ({Math.round(s.rev / clvSegments.total * 100)}%)
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Customer LTV table */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Top Customers by Lifetime Value</h3>
            </div>
            {customerClv.length === 0
              ? <p className="px-4 py-10 text-center text-sm text-gray-400">No customer purchase history</p>
              : <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                          <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
                          <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                          <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Segment</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">LTV</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Avg Order</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Last Order</th>
                        </tr>
                      </thead>
                      <tbody className="stagger-rows">
                        {customerClv.slice(0, 25).map((c, i) => (
                          <tr key={c.id} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                              <p className="text-xs text-gray-400">{c.city}, {c.state}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <ClvSegmentBadge segment={c.segment} />
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{c.orderCount}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                              ₹{Math.round(c.totalSpent).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                              ₹{Math.round(c.avgOrderValue).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400 hidden lg:table-cell">
                              {c.daysSinceLast === 0 ? 'today' : `${c.daysSinceLast}d ago`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] text-xs text-gray-400">
                    Top 25 of {customerClv.length} customers by lifetime value
                  </div>
                </>}
          </Card>
        </div>
      )}

      {/* ── Reorder Engine Tab ───────────────────────────────────────────────── */}
      {tab === 'reorder' && (
        <div className="space-y-4">
          {/* Predicted reorder revenue */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Predicted reorder revenue · next 30 days</p>
                <p className="text-[28px] font-semibold text-gray-900 dark:text-white leading-none tabular-nums">₹{reorderForecast.expectedRevenue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{reorderForecast.dueCount} customers due to reorder, based on their order cycles</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">At-risk revenue</p>
                <p className="text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums leading-none">₹{reorderForecast.atRiskRevenue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{reorderForecast.overdueCount} overdue — nudge now to recover</p>
              </div>
            </div>
            {reorderForecast.dueList.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05] flex flex-wrap gap-2">
                {reorderForecast.dueList.slice(0, 8).map(c => (
                  <span key={c.customer_id} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300">
                    {c.customer_name} · ₹{c.expected.toLocaleString('en-IN')} · <span className={c.days_until < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}>{c.days_until >= 0 ? `in ${c.days_until}d` : `${Math.abs(c.days_until)}d overdue`}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>

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
                  aria-label="Search customers for reorder nudges"
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
                <Input value={pincodeSearch} onChange={e => setPincodeSearch(e.target.value)} placeholder="Search pincode or city…" className="pl-7 py-1.5 text-xs h-8" aria-label="Search by pincode or city" />
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

      {/* ── Cohort Analysis Tab ─────────────────────────────────────────────── */}
      {tab === 'cohort' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Cohorts Tracked</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{cohortAnalysis.rows.length}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">monthly cohorts</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Avg M+1 Retention</p>
              <p className={`text-2xl font-semibold ${cohortSummary.avgM1Retention >= 30 ? 'text-green-600 dark:text-green-400' : cohortSummary.avgM1Retention >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {cohortSummary.avgM1Retention > 0 ? `${cohortSummary.avgM1Retention.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">returned next month</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Total Customers</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{cohortSummary.totalCustomers}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">with order history</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Best Cohort</p>
              <p className="text-xl font-semibold text-brand-600 dark:text-brand-400 truncate">{cohortSummary.bestCohort?.label ?? '—'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {cohortSummary.bestCohort ? `${cohortSummary.bestCohort.retention[1] ?? 0}% M+1 retention` : 'no data yet'}
              </p>
            </Card>
          </div>

          <Card>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Monthly Retention Cohorts</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">% of cohort customers who placed an order in each subsequent month</p>
            </div>
            {cohortAnalysis.rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">Not enough order history to build cohorts</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Cohort</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider">Size</th>
                      {Array.from({ length: cohortAnalysis.maxPeriods + 1 }, (_, i) => (
                        <th key={i} className="px-2 py-3 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {i === 0 ? 'M+0' : `M+${i}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortAnalysis.rows.map(row => (
                      <tr key={row.cohortMonth} className="border-b border-gray-50 dark:border-white/[0.03]">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.label}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">{row.size}</td>
                        {row.retention.map((pct, i) => (
                          <CohortCell key={i} pct={pct} isFirst={i === 0} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
              <span>Retention heat:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-100 dark:bg-brand-900/30 inline-block" /> M+0 (100%)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 inline-block" /> ≥30%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-900/20 inline-block" /> ≥15%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/10 inline-block" /> &lt;15%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 dark:bg-white/10 inline-block" /> future</span>
            </div>
          </Card>
        </div>
      )}

      {/* ── Product Analysis Tab ─────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">SKUs Tracked</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{enhancedProductPerf.length}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">with sales history</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Avg Return Rate</p>
              <p className={`text-2xl font-semibold ${productPerfSummary.avgReturnRate >= 20 ? 'text-red-600 dark:text-red-400' : productPerfSummary.avgReturnRate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {productPerfSummary.avgReturnRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">across all SKUs</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Avg Gross Margin</p>
              <p className={`text-2xl font-semibold ${productPerfSummary.avgMargin > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                {productPerfSummary.avgMargin > 0 ? `${productPerfSummary.avgMargin.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">revenue minus COGS</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">High Return SKUs</p>
              <p className={`text-2xl font-semibold ${productPerfSummary.highReturnCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {productPerfSummary.highReturnCount}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">≥20% return rate</p>
            </Card>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {productCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setProductCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  productCategory === cat
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <Card>
            {sortedProductPerf.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No paid orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                      <th
                        className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider hidden sm:table-cell cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={() => toggleProductSort('units')}
                      >
                        <span className={`inline-flex items-center gap-1 ${productSort === 'units' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>
                          Units {productSort === 'units' ? (productSortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={() => toggleProductSort('revenue')}
                      >
                        <span className={`inline-flex items-center gap-1 ${productSort === 'revenue' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>
                          Revenue {productSort === 'revenue' ? (productSortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={() => toggleProductSort('return_rate')}
                      >
                        <span className={`inline-flex items-center gap-1 ${productSort === 'return_rate' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>
                          Returns {productSort === 'return_rate' ? (productSortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={() => toggleProductSort('margin')}
                      >
                        <span className={`inline-flex items-center gap-1 ${productSort === 'margin' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>
                          Margin {productSort === 'margin' ? (productSortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={() => toggleProductSort('dioh')}
                      >
                        <span className={`inline-flex items-center gap-1 ${productSort === 'dioh' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>
                          DIOH {productSort === 'dioh' ? (productSortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {sortedProductPerf.map((p, i) => (
                      <tr key={p.sku} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{p.category}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">{p.units_sold}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                          ₹{Math.round(p.revenue).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${
                            p.return_rate >= 20 ? 'text-red-600 dark:text-red-400' :
                            p.return_rate >= 10 ? 'text-amber-600 dark:text-amber-400' :
                            p.return_rate > 0  ? 'text-yellow-600 dark:text-yellow-500' :
                            'text-green-600 dark:text-green-400'
                          }`}>
                            {p.return_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">
                          {p.gross_margin !== null
                            ? <span className={p.gross_margin >= 30 ? 'text-emerald-600 dark:text-emerald-400' : p.gross_margin >= 15 ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}>{p.gross_margin.toFixed(1)}%</span>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {p.dioh !== null ? (
                            <span className={`text-sm font-medium ${
                              p.dioh <= 7  ? 'text-red-600 dark:text-red-400' :
                              p.dioh <= 14 ? 'text-amber-600 dark:text-amber-400' :
                              'text-gray-700 dark:text-gray-300'
                            }`}>
                              {p.dioh >= 999 ? '∞' : `${p.dioh}d`}
                            </span>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] text-xs text-gray-400 flex flex-wrap gap-3">
              <span>{sortedProductPerf.length} products</span>
              <span>·</span>
              <span>Return rate: <span className="text-green-600">0%</span> → <span className="text-amber-600">10%</span> → <span className="text-red-600">≥20%</span></span>
              <span>·</span>
              <span>DIOH = Days of Inventory on Hand</span>
            </div>
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

function CohortCell({ pct, isFirst }: { pct: number | null; isFirst: boolean }) {
  if (pct === null) {
    return (
      <td className="px-2 py-3 text-center">
        <span className="inline-flex items-center justify-center w-11 h-6 rounded text-[10px] text-gray-200 dark:text-gray-700">—</span>
      </td>
    )
  }
  let bg: string, txt: string
  if (isFirst) {
    bg = 'bg-brand-100 dark:bg-brand-900/40'
    txt = 'text-brand-700 dark:text-brand-400 font-semibold'
  } else if (pct >= 30) {
    bg = 'bg-emerald-100 dark:bg-emerald-900/30'
    txt = 'text-emerald-700 dark:text-emerald-400'
  } else if (pct >= 15) {
    bg = 'bg-amber-50 dark:bg-amber-900/20'
    txt = 'text-amber-700 dark:text-amber-500'
  } else if (pct > 0) {
    bg = 'bg-red-50 dark:bg-red-900/10'
    txt = 'text-red-600 dark:text-red-400'
  } else {
    bg = ''
    txt = 'text-gray-300 dark:text-gray-600'
  }
  return (
    <td className="px-2 py-3 text-center">
      <span className={`inline-flex items-center justify-center w-11 h-6 rounded text-[11px] font-medium ${bg} ${txt}`}>
        {pct}%
      </span>
    </td>
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
