import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, ShoppingBag, Truck, AlertTriangle,
  ArrowUpRight, ArrowDownRight, ChevronRight, Zap,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { generateDailyBrief } from '../../lib/briefEngine'
import { Card } from '../../components/ui'
import { RevenueAreaChart, StatusDonut, ChannelBarChart } from '../../components/charts'
import { FulfillmentBadge, RTOScoreBar, SeverityBadge } from '../../components/shared/StatusBadge'
export default function Dashboard() {
  const { orders, customers, products, exceptions } = useAppStore()

  const today = new Date().toISOString().slice(0, 10)
  const brief = useMemo(
    () => generateDailyBrief(today, orders, customers, products, exceptions),
    [today, orders, customers, products, exceptions]
  )

  // KPI calculations
  const todayOrders = orders.filter(o => o.created_at.startsWith(today))
  const todayRevenue = todayOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
  const todayPaid = todayOrders.filter(o => o.payment_status === 'PAID').length
  const allDelivered = orders.filter(o => o.fulfillment_status === 'DELIVERED').length
  const allRTO = orders.filter(o => o.fulfillment_status === 'RTO_INITIATED').length
  const rtoRate = allDelivered + allRTO > 0 ? (allRTO / (allDelivered + allRTO)) * 100 : 0
  const openExceptions = exceptions.filter(e => e.status === 'UNRESOLVED').length

  // 14-day rolling revenue chart from real orders
  const revenueChartData = useMemo(() => {
    const days = 14
    const now = new Date()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (days - 1 - i))
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr))
      return {
        label,
        revenue: dayOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0),
        orders: dayOrders.length,
      }
    })
  }, [orders])

  // Order status donut
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      map.set(o.fulfillment_status, (map.get(o.fulfillment_status) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [orders])

  // Channel data
  const channelData = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      map.set(o.channel, (map.get(o.channel) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([channel, orders]) => ({ channel, orders }))
  }, [orders])

  // Ready to pack
  const readyToPack = orders.filter(
    o =>
      o.payment_status === 'PAID' &&
      o.rto_review_status === 'APPROVED' &&
      (o.fulfillment_status === 'CONFIRMED' || o.fulfillment_status === 'PROCESSING')
  ).slice(0, 5)

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  return (
    <div className="space-y-5 stagger-children">
      {/* Morning Brief Widget */}
      {brief.headline.total_orders > 0 && (
        <Card className="p-5 border-l-[3px] border-l-brand-600">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className="text-brand-600" />
                <span className="text-[11px] font-medium text-brand-600 uppercase tracking-wider">Today's Brief</span>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {brief.headline.total_orders} orders · ₹{Math.round(brief.headline.total_revenue).toLocaleString('en-IN')} revenue
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Margin {Math.round(brief.headline.true_margin)}% · {brief.headline.rto_count} RTO
              </p>
            </div>
            <Link to="/briefs" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 transition-colors">
              Full brief <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-1.5 border-t border-gray-50 pt-3">
            {brief.actions.slice(0, 2).map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  action.priority === 'HIGH' ? 'bg-red-400' : action.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-400'
                }`} />
                <span className="text-xs text-gray-500 leading-5">{action.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Cards — staggered, values count up on mount */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { title: 'Revenue Today', value: <CountUp value={todayRevenue} format={n => `₹${Math.round(n).toLocaleString('en-IN')}`} />, trend: { value: 12, positive: true }, icon: <TrendingUp size={18} />, sub: `${todayOrders.length} orders`, invertTrend: false },
          { title: 'Paid Orders',   value: <CountUp value={todayPaid} format={n => String(Math.round(n))} />, trend: { value: 8, positive: true }, icon: <ShoppingBag size={18} />, sub: 'Today', invertTrend: false },
          { title: 'RTO Rate',      value: <CountUp value={rtoRate} format={n => `${n.toFixed(1)}%`} />, trend: { value: 2, positive: false }, icon: <Truck size={18} />, sub: 'All-time', invertTrend: true },
          { title: 'Open Exceptions', value: <CountUp value={openExceptions} format={n => String(Math.round(n))} />, trend: { value: openExceptions, positive: false }, icon: <AlertTriangle size={18} />, sub: 'Unresolved', invertTrend: true },
        ]).map((kpi, i) => (
          <div key={kpi.title} className="animate-fade-in-up" style={{ animationDelay: `${i * 65}ms` }}>
            <KPICard {...kpi} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Revenue Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">14-day revenue and order trend</p>
          </div>
          <RevenueAreaChart data={revenueChartData} />
        </Card>
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Order Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">Current fulfillment breakdown</p>
          </div>
          <StatusDonut data={statusCounts} />
        </Card>
      </div>

      {/* Channel + Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '290ms' }}>
        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Channel Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Orders by sales channel</p>
          </div>
          <ChannelBarChart data={channelData} />
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Exceptions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Unresolved issues</p>
            </div>
            <Link to="/exceptions" className="text-brand-600 text-xs hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {exceptions.filter(e => e.status === 'UNRESOLVED').slice(0, 5).map(exc => (
              <div key={exc.id} className="flex items-start gap-3">
                <SeverityBadge severity={exc.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{exc.title}</p>
                  <p className="text-xs text-gray-500 truncate">{exc.description}</p>
                </div>
              </div>
            ))}
            {exceptions.filter(e => e.status === 'UNRESOLVED').length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No unresolved exceptions 🎉</p>
            )}
          </div>
        </Card>
      </div>

      {/* Ready to Pack + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '370ms' }}>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Ready to Pack</h3>
              <p className="text-xs text-gray-400 mt-0.5">Paid & cleared orders</p>
            </div>
            <Link to="/fulfillment" className="text-brand-600 text-xs hover:underline">Fulfillment →</Link>
          </div>
          {readyToPack.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No orders ready to pack</p>
          ) : (
            <div className="space-y-2">
              {readyToPack.map(order => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">{order.customer?.name} · ₹{order.gross_amount}</p>
                  </div>
                  <FulfillmentBadge status={order.fulfillment_status} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest activity</p>
            </div>
            <Link to="/orders" className="text-brand-600 text-xs hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                  <p className="text-xs text-gray-500 truncate">{order.customer?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">₹{order.gross_amount}</span>
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

// Eased count-up for KPI values — runs once on mount, re-runs if the value changes
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    let raf = 0
    const start = performance.now()
    const duration = 750
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className="tabular-nums">{format(display)}</span>
}

function KPICard({
  title, value, trend, icon, sub, invertTrend = false,
}: {
  title: string
  value: React.ReactNode
  trend: { value: number; positive: boolean }
  icon: React.ReactNode
  sub: string
  invertTrend?: boolean
}) {
  const isGood = invertTrend ? !trend.positive : trend.positive
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
          {icon}
        </div>
        <span className={`text-xs font-medium flex items-center gap-0.5 ${isGood ? 'text-green-500' : 'text-red-400'}`}>
          {isGood ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {Math.abs(trend.value)}%
        </span>
      </div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </Card>
  )
}
