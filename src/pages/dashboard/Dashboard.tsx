import { useMemo } from 'react'
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
import { WEEKLY_REVENUE } from '../../data/seed'

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

  // Chart data
  const revenueChartData = WEEKLY_REVENUE

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
    <div className="space-y-5">
      {/* Morning Brief Widget */}
      {brief.headline.total_orders > 0 && (
        <Card className="p-5 bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#2E1065] text-white border-0 overflow-hidden relative animate-fade-in-up">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(129,140,248,0.15),transparent_60%)]" />
          <div className="relative flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={15} className="text-brand-300" />
                <span className="text-brand-300 text-sm font-medium tracking-tight">Morning Brief · Today</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                {brief.headline.total_orders} orders · ₹{Math.round(brief.headline.total_revenue).toLocaleString('en-IN')} revenue
              </h2>
              <p className="text-brand-300 text-sm mt-0.5">
                Margin {Math.round(brief.headline.true_margin)}% · {brief.headline.rto_count} RTO
              </p>
            </div>
            <Link to="/briefs" className="text-brand-300 hover:text-white text-sm flex items-center gap-1 transition-colors">
              Full brief <ChevronRight size={14} />
            </Link>
          </div>
          <div className="relative space-y-1.5">
            {brief.actions.slice(0, 2).map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  action.priority === 'HIGH' ? 'bg-red-400' : action.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-400'
                }`} />
                <span className="text-indigo-200 leading-5">{action.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Cards — staggered */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { title: 'Revenue Today', value: `₹${Math.round(todayRevenue).toLocaleString('en-IN')}`, trend: { value: 12, positive: true }, icon: <TrendingUp size={18} />, sub: `${todayOrders.length} orders`, invertTrend: false },
          { title: 'Paid Orders',   value: String(todayPaid), trend: { value: 8, positive: true }, icon: <ShoppingBag size={18} />, sub: 'Today', invertTrend: false },
          { title: 'RTO Rate',      value: `${rtoRate.toFixed(1)}%`, trend: { value: 2, positive: false }, icon: <Truck size={18} />, sub: 'All-time', invertTrend: true },
          { title: 'Open Exceptions', value: String(openExceptions), trend: { value: openExceptions, positive: false }, icon: <AlertTriangle size={18} />, sub: 'Unresolved', invertTrend: true },
        ]).map((kpi, i) => (
          <div key={kpi.title} className="animate-fade-in-up" style={{ animationDelay: `${i * 65}ms` }}>
            <KPICard {...kpi} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Card className="lg:col-span-2 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Orders — 14 Days</h3>
          <RevenueAreaChart data={revenueChartData} />
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Order Status</h3>
          <StatusDonut data={statusCounts} />
        </Card>
      </div>

      {/* Channel + Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '290ms' }}>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Performance</h3>
          <ChannelBarChart data={channelData} />
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Exceptions</h3>
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
            <h3 className="text-sm font-semibold text-gray-900">Ready to Pack</h3>
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
            <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
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

function KPICard({
  title, value, trend, icon, sub, invertTrend = false,
}: {
  title: string
  value: string
  trend: { value: number; positive: boolean }
  icon: React.ReactNode
  sub: string
  invertTrend?: boolean
}) {
  const isGood = invertTrend ? !trend.positive : trend.positive
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500">
          {icon}
        </div>
        <div className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
          {isGood ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(trend.value)}%
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </Card>
  )
}
