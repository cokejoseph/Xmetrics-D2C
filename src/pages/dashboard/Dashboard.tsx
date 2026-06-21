import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, ChevronRight, Zap, CheckCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { generateDailyBrief } from '../../lib/briefEngine'
import { Card } from '../../components/ui'
import { RevenueAreaChart, StatusDonut, ChannelBarChart } from '../../components/charts'
import { FulfillmentBadge, RTOScoreBar, SeverityBadge } from '../../components/shared/StatusBadge'

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · Xmetrics' }, [])
  const { orders, customers, products, exceptions } = useAppStore()

  const today = new Date().toISOString().slice(0, 10)
  const brief = useMemo(
    () => generateDailyBrief(today, orders, customers, products, exceptions),
    [today, orders, customers, products, exceptions]
  )
  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // KPIs
  const todayOrders = orders.filter(o => o.created_at.startsWith(today))
  const todayRevenue = todayOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
  const todayPaid = todayOrders.filter(o => o.payment_status === 'PAID').length
  const openExceptions = exceptions.filter(e => e.status === 'UNRESOLVED').length
  const allDelivered = orders.filter(o => o.fulfillment_status === 'DELIVERED').length
  const allRTO = orders.filter(o => o.fulfillment_status === 'RTO_INITIATED').length
  const rtoRate = allDelivered + allRTO > 0 ? (allRTO / (allDelivered + allRTO)) * 100 : 0

  // WoW trends
  const lastWeekTodayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
  }, [])
  const lastWeekRevenue = useMemo(
    () => orders.filter(o => o.created_at.startsWith(lastWeekTodayStr)).reduce((s, o) => s + o.gross_amount - o.discount_amount, 0),
    [orders, lastWeekTodayStr]
  )
  const lastWeekPaid = useMemo(
    () => orders.filter(o => o.created_at.startsWith(lastWeekTodayStr) && o.payment_status === 'PAID').length,
    [orders, lastWeekTodayStr]
  )
  const revenueTrendPct = lastWeekRevenue > 0 ? Math.round(((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0
  const paidTrendPct = lastWeekPaid > 0 ? Math.round(((todayPaid - lastWeekPaid) / lastWeekPaid) * 100) : 0

  const { rtoTrendPct, rtoTrendPositive } = useMemo(() => {
    const now = new Date()
    const dow = now.getDay()
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1)); thisMonday.setHours(0,0,0,0)
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
    const tm = thisMonday.toISOString().slice(0, 10)
    const lm = lastMonday.toISOString().slice(0, 10)
    const tw = orders.filter(o => o.created_at >= tm && o.created_at <= now.toISOString())
    const lw = orders.filter(o => o.created_at >= lm && o.created_at < tm)
    const twRate = (tw.filter(o => o.fulfillment_status === 'DELIVERED').length + tw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length) > 0
      ? tw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length / (tw.filter(o => o.fulfillment_status === 'DELIVERED').length + tw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length) * 100
      : 0
    const lwRate = (lw.filter(o => o.fulfillment_status === 'DELIVERED').length + lw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length) > 0
      ? lw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length / (lw.filter(o => o.fulfillment_status === 'DELIVERED').length + lw.filter(o => o.fulfillment_status === 'RTO_INITIATED').length) * 100
      : 0
    return { rtoTrendPct: Math.abs(Math.round(twRate - lwRate)), rtoTrendPositive: twRate <= lwRate }
  }, [orders])

  // Chart data
  const revenueChartData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (13 - i))
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr))
      return { label, revenue: dayOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0), orders: dayOrders.length }
    })
  }, [orders])

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.fulfillment_status, (map.get(o.fulfillment_status) ?? 0) + 1)
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [orders])

  const channelData = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.channel, (map.get(o.channel) ?? 0) + 1)
    return Array.from(map.entries()).map(([channel, orders]) => ({ channel, orders }))
  }, [orders])

  const readyToPack = orders.filter(
    o => o.payment_status === 'PAID' && o.rto_review_status === 'APPROVED' &&
      (o.fulfillment_status === 'CONFIRMED' || o.fulfillment_status === 'PROCESSING')
  ).slice(0, 5)

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  const unresolved = exceptions.filter(e => e.status === 'UNRESOLVED')

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{formattedDate}</p>
        </div>
        <Link
          to="/briefs"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
        >
          Full brief <ChevronRight size={12} />
        </Link>
      </div>

      {/* ── Intelligence strip ──────────────────────────── */}
      {brief.headline.total_orders > 0 && (
        <div className="bg-brand-600 rounded-xl px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-2" aria-hidden="true">
                <Zap size={11} className="text-white/50" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Today's Intelligence</span>
              </div>
              <p className="text-[18px] font-semibold text-white leading-tight">
                {brief.headline.total_orders} orders · ₹{Math.round(brief.headline.total_revenue).toLocaleString('en-IN')} revenue
              </p>
              <p className="text-[13px] text-white/90 mt-1">
                {Math.round(brief.headline.true_margin)}% margin · {brief.headline.rto_count} RTO today
              </p>
            </div>
            {brief.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:max-w-[380px]">
                {brief.actions.slice(0, 2).map((action, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/[0.12] rounded-lg px-3 py-2 flex-1 min-w-[150px]">
                    <span className={`w-1.5 h-1.5 rounded-full mt-[4px] shrink-0 ${action.priority === 'HIGH' ? 'bg-red-300' : 'bg-amber-300'}`} />
                    <span className="text-[12px] text-white/95 leading-[1.45]">{action.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KPI strip — single surface, 4 columns ───────── */}
      <div className="bg-white dark:bg-card-surface rounded-xl border border-gray-100 dark:border-white/[0.07] shadow-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-gray-100 dark:divide-white/[0.07]">
        <KPIMetric
          title="Revenue Today"
          value={`₹${Math.round(todayRevenue).toLocaleString('en-IN')}`}
          sub={`${todayOrders.length} orders`}
          trend={{ value: Math.abs(revenueTrendPct), positive: revenueTrendPct >= 0 }}
          invertTrend={false}
        />
        <KPIMetric
          title="Paid Orders"
          value={String(todayPaid)}
          sub="Confirmed today"
          trend={{ value: Math.abs(paidTrendPct), positive: paidTrendPct >= 0 }}
          invertTrend={false}
        />
        <KPIMetric
          title="RTO Rate"
          value={`${rtoRate.toFixed(1)}%`}
          sub="All-time · WoW"
          trend={{ value: rtoTrendPct, positive: !rtoTrendPositive }}
          invertTrend={true}
          tooltip="Return-to-Origin rate: percentage of shipped orders returned to warehouse. Industry benchmark for D2C is under 20%. Lower is better."
        />
        <KPIMetric
          title="Open Exceptions"
          value={String(openExceptions)}
          sub="Need attention"
          trend={{ value: openExceptions, positive: openExceptions > 0 }}
          invertTrend={true}
          tooltip="Unresolved operational exceptions — high RTO risk, payment failures, stuck shipments, or inventory alerts requiring your action."
        />
      </div>

      {/* ── Charts ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Revenue</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">14-day trend</p>
            </div>
            <span className="text-[11px] text-gray-400 tabular-nums">
              {revenueChartData[0]?.label} – {revenueChartData[revenueChartData.length - 1]?.label}
            </span>
          </div>
          <RevenueAreaChart data={revenueChartData} />
        </Card>
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Order Status</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{orders.length} total orders</p>
          </div>
          <StatusDonut data={statusCounts} />
        </Card>
      </div>

      {/* ── Exceptions + Channel ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Exceptions</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{unresolved.length} unresolved</p>
            </div>
            <Link to="/exceptions" className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
              View all →
            </Link>
          </div>
          {unresolved.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle size={18} className="text-emerald-400" />
              <p className="text-[13px] text-gray-400">No unresolved exceptions</p>
            </div>
          ) : (
            <div>
              {unresolved.slice(0, 5).map((exc, i, arr) => (
                <div
                  key={exc.id}
                  className={`flex items-start gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-gray-50 dark:border-white/[0.04]' : ''}`}
                >
                  <SeverityBadge severity={exc.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-900 truncate">{exc.title}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{exc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Channel Performance</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Orders by channel</p>
          </div>
          <ChannelBarChart data={channelData} />
        </Card>
      </div>

      {/* ── Action queues ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Ready to Pack</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{readyToPack.length} orders waiting</p>
            </div>
            <Link to="/fulfillment" className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
              Fulfillment →
            </Link>
          </div>
          {readyToPack.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-8">Queue is clear</p>
          ) : (
            <div>
              {readyToPack.map((order, i, arr) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className={`flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${i < arr.length - 1 ? 'border-b border-gray-50 dark:border-white/[0.04]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-[11px] text-gray-400">{order.customer?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-white tabular-nums">
                      ₹{order.gross_amount.toLocaleString('en-IN')}
                    </span>
                    <FulfillmentBadge status={order.fulfillment_status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Latest activity</p>
            </div>
            <Link to="/orders" className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
              View all →
            </Link>
          </div>
          <div>
            {recentOrders.map((order, i, arr) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className={`flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${i < arr.length - 1 ? 'border-b border-gray-50 dark:border-white/[0.04]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{order.order_number}</p>
                  <p className="text-[11px] text-gray-400 truncate">{order.customer?.name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white tabular-nums">
                    ₹{order.gross_amount.toLocaleString('en-IN')}
                  </span>
                  <RTOScoreBar score={order.rto_risk_score} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

    </div>
  )
}

// ── KPI Metric ──────────────────────────────────────────────────────────────
function KPIMetric({
  title, value, sub, trend, invertTrend = false, tooltip,
}: {
  title: string
  value: string
  sub: string
  trend: { value: number; positive: boolean }
  invertTrend?: boolean
  tooltip?: string
}) {
  const isGood = invertTrend ? !trend.positive : trend.positive
  return (
    <div className="px-6 py-5">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3"
        title={tooltip}
        aria-label={tooltip ? `${title}: ${tooltip}` : undefined}
      >{title}</p>
      <p className="text-[36px] font-semibold tracking-tight text-gray-900 dark:text-white leading-none mb-2 tabular-nums">{value}</p>
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-gray-400">{sub}</p>
        {trend.value !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            isGood
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400'
              : 'bg-red-50 text-red-500 dark:bg-red-400/10 dark:text-red-400'
          }`}>
            {isGood ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
            {Math.abs(trend.value) > 999 ? '999+' : Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  )
}
