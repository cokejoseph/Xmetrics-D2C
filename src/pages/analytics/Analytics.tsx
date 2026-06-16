import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { buildSKUForecast } from '../../lib/forecastEngine'
import { Card, Input } from '../../components/ui'
import { RevenueAreaChart, OrdersBarChart, StatusDonut, ChannelBarChart } from '../../components/charts'
import type { ForecastStatus } from '../../types'

const FORECAST_STATUS_STYLE: Record<ForecastStatus, { label: string; cls: string }> = {
  OUT_OF_STOCK: { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' },
  REORDER_NOW: { label: 'Reorder Now', cls: 'bg-orange-100 text-orange-700' },
  REORDER_SOON: { label: 'Reorder Soon', cls: 'bg-amber-100 text-amber-700' },
  IN_STOCK: { label: 'In Stock', cls: 'bg-green-100 text-green-700' },
  DEAD_STOCK: { label: 'Dead Stock', cls: 'bg-gray-100 text-gray-500' },
  INSUFFICIENT_DATA: { label: 'Insufficient Data', cls: 'bg-blue-100 text-blue-700' },
  UNPREDICTABLE: { label: 'Unpredictable', cls: 'bg-purple-100 text-purple-700' },
}

type TabType = 'overview' | 'forecast' | 'pincode'
type PincodeSortKey = 'orders' | 'revenue' | 'aov' | 'rto_rate'

export default function Analytics() {
  const [tab, setTab] = useState<TabType>('overview')
  const [pincodeSearch, setPincodeSearch] = useState('')
  const [pincodeSort, setPincodeSort] = useState<PincodeSortKey>('orders')
  const [pincodeSortAsc, setPincodeSortAsc] = useState(false)
  const { orders, products } = useAppStore()

  const { forecasts, summary } = useMemo(() => buildSKUForecast(products, orders), [products, orders])

  // Overview KPIs
  const totalRevenue = orders.filter(o => o.payment_status === 'PAID').reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)
  const rtoOrders = orders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
  const deliveredOrders = orders.filter(o => o.fulfillment_status === 'DELIVERED')
  const rtoRate = (deliveredOrders.length + rtoOrders.length) > 0
    ? (rtoOrders.length / (deliveredOrders.length + rtoOrders.length) * 100)
    : 0
  const rtoLoss = rtoOrders.reduce((s, o) => s + (o.gross_amount - o.discount_amount) * 0.15, 0)

  const channelData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number; rto: number }>()
    for (const o of orders) {
      const e = map.get(o.channel) ?? { orders: 0, revenue: 0, rto: 0 }
      map.set(o.channel, {
        orders: e.orders + 1,
        revenue: e.revenue + o.gross_amount - o.discount_amount,
        rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0),
      })
    }
    return Array.from(map.entries()).map(([channel, data]) => ({
      channel,
      orders: data.orders,
      revenue: data.revenue,
      rto_rate: data.orders > 0 ? (data.rto / data.orders * 100).toFixed(1) : '0',
    }))
  }, [orders])

  const pincodeData = useMemo(() => {
    const map = new Map<string, { city: string; state: string; orders: number; revenue: number; rto: number }>()
    for (const o of orders) {
      const pin = o.shipping_address.pincode
      if (!pin) continue
      const e = map.get(pin) ?? { city: o.shipping_address.city, state: o.shipping_address.state, orders: 0, revenue: 0, rto: 0 }
      map.set(pin, {
        city: e.city,
        state: e.state,
        orders: e.orders + 1,
        revenue: e.revenue + o.gross_amount - o.discount_amount,
        rto: e.rto + (o.fulfillment_status === 'RTO_INITIATED' ? 1 : 0),
      })
    }
    return Array.from(map.entries()).map(([pincode, d]) => ({
      pincode,
      city: d.city,
      state: d.state,
      orders: d.orders,
      revenue: d.revenue,
      aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      rto_count: d.rto,
      rto_rate: d.orders > 0 ? (d.rto / d.orders) * 100 : 0,
    }))
  }, [orders])

  const filteredPincodes = useMemo(() => {
    let list = pincodeData
    if (pincodeSearch) {
      const q = pincodeSearch.toLowerCase()
      list = list.filter(p => p.pincode.includes(q) || p.city.toLowerCase().includes(q) || p.state.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const dir = pincodeSortAsc ? 1 : -1
      return (a[pincodeSort] - b[pincodeSort]) * dir
    })
  }, [pincodeData, pincodeSearch, pincodeSort, pincodeSortAsc])

  const pincodeSummary = useMemo(() => ({
    total: pincodeData.length,
    high_rto: pincodeData.filter(p => p.rto_rate >= 30).length,
    zero_rto: pincodeData.filter(p => p.rto_rate === 0 && p.orders >= 2).length,
    top_revenue: pincodeData.reduce((max, p) => p.revenue > max.revenue ? p : max, pincodeData[0] ?? { pincode: '—', revenue: 0, city: '' }),
  }), [pincodeData])

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
  const dailyOrders = revenueChartData.map(r => ({ label: r.label, orders: r.orders }))
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.fulfillment_status, (map.get(o.fulfillment_status) ?? 0) + 1)
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [orders])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'forecast', label: 'Demand Forecast' },
          { key: 'pincode', label: 'Pincode Intelligence' },
        ] as { key: TabType; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Total Revenue</p><p className="text-2xl font-bold text-gray-900">₹{Math.round(totalRevenue / 1000)}k</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Total Orders</p><p className="text-2xl font-bold text-gray-900">{orders.length}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">RTO Rate</p><p className="text-2xl font-bold text-red-600">{rtoRate.toFixed(1)}%</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">RTO Loss</p><p className="text-2xl font-bold text-orange-600">₹{Math.round(rtoLoss).toLocaleString('en-IN')}</p></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend (14 days)</h3>
              <RevenueAreaChart data={revenueChartData} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Orders</h3>
              <OrdersBarChart data={dailyOrders} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Order Status Mix</h3>
              <StatusDonut data={statusCounts} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Performance</h3>
              <ChannelBarChart data={channelData} />
            </Card>
          </div>

          {/* Channel table */}
          <Card>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Channel Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">RTO Rate</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {channelData.sort((a, b) => b.orders - a.orders).map(c => (
                    <tr key={c.channel} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.channel}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{c.orders}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">₹{Math.round(c.revenue).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{c.rto_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'pincode' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Pincodes Reached</p>
              <p className="text-2xl font-bold text-gray-900">{pincodeSummary.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">High RTO Zones</p>
              <p className="text-2xl font-bold text-red-600">{pincodeSummary.high_rto}</p>
              <p className="text-[10px] text-gray-400">≥30% RTO rate</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Zero RTO Zones</p>
              <p className="text-2xl font-bold text-green-600">{pincodeSummary.zero_rto}</p>
              <p className="text-[10px] text-gray-400">2+ orders, 0% RTO</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Top Revenue Zone</p>
              <p className="text-xl font-bold text-gray-900">{pincodeSummary.top_revenue?.pincode ?? '—'}</p>
              <p className="text-[10px] text-gray-400">{pincodeSummary.top_revenue?.city}</p>
            </Card>
          </div>

          <Card>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900 flex-1">Pincode Performance</h3>
              <div className="relative w-56">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={pincodeSearch}
                  onChange={e => setPincodeSearch(e.target.value)}
                  placeholder="Search pincode or city…"
                  className="pl-7 py-1.5 text-xs h-8"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pincode</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">City / State</th>
                    <SortTh label="Orders" col="orders" sort={pincodeSort} asc={pincodeSortAsc} onSort={k => { if (pincodeSort === k) setPincodeSortAsc(p => !p); else { setPincodeSort(k); setPincodeSortAsc(false) } }} />
                    <SortTh label="Revenue" col="revenue" sort={pincodeSort} asc={pincodeSortAsc} onSort={k => { if (pincodeSort === k) setPincodeSortAsc(p => !p); else { setPincodeSort(k); setPincodeSortAsc(false) } }} />
                    <SortTh label="Avg Order" col="aov" sort={pincodeSort} asc={pincodeSortAsc} onSort={k => { if (pincodeSort === k) setPincodeSortAsc(p => !p); else { setPincodeSort(k); setPincodeSortAsc(false) } }} />
                    <SortTh label="RTO Rate" col="rto_rate" sort={pincodeSort} asc={pincodeSortAsc} onSort={k => { if (pincodeSort === k) setPincodeSortAsc(p => !p); else { setPincodeSort(k); setPincodeSortAsc(false) } }} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Risk</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {filteredPincodes.map(p => {
                    const riskColor = p.rto_rate >= 30
                      ? 'bg-red-100 text-red-700'
                      : p.rto_rate >= 15
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    const riskLabel = p.rto_rate >= 30 ? 'High' : p.rto_rate >= 15 ? 'Medium' : 'Low'
                    return (
                      <tr key={p.pincode} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono font-semibold text-gray-900">{p.pincode}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-sm text-gray-700">{p.city}</p>
                          <p className="text-xs text-gray-400">{p.state}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{p.orders}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">₹{p.revenue.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">₹{p.aov.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-700">{p.rto_rate.toFixed(0)}%</span>
                          {p.rto_count > 0 && <span className="text-[10px] text-gray-400 ml-1">({p.rto_count})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskColor}`}>
                            {riskLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredPincodes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                        No pincodes match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              {filteredPincodes.length} of {pincodeData.length} pincodes
            </div>
          </Card>
        </div>
      )}

      {tab === 'forecast' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SumCard label="Out of Stock" value={summary.out_of_stock_count} cls="text-red-600" />
            <SumCard label="Reorder Now" value={summary.reorder_now_count} cls="text-orange-600" />
            <SumCard label="Reorder Soon" value={summary.reorder_soon_count} cls="text-amber-600" />
            <SumCard label="In Stock" value={summary.in_stock_count} cls="text-green-600" />
            <SumCard label="Dead Stock" value={summary.dead_stock_count} cls="text-gray-400" />
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Daily Demand</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Days Left</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Stockout</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Reorder Qty</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {forecasts.sort((a, b) => {
                    const order: ForecastStatus[] = ['OUT_OF_STOCK', 'REORDER_NOW', 'REORDER_SOON', 'IN_STOCK', 'DEAD_STOCK', 'INSUFFICIENT_DATA', 'UNPREDICTABLE']
                    return order.indexOf(a.status) - order.indexOf(b.status)
                  }).map(f => {
                    const s = FORECAST_STATUS_STYLE[f.status]
                    return (
                      <tr key={f.product_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{f.name}</p>
                          <p className="text-xs text-gray-400">{f.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{f.inventory_count}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">{f.avg_daily_demand}/day</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden md:table-cell">
                          {f.days_of_stock >= 999 ? '∞' : f.days_of_stock}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                          {f.predicted_stockout_date ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">
                          {f.reorder_quantity > 0 ? f.reorder_quantity : '—'}
                        </td>
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

function SumCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card className="p-4 text-center">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Card>
  )
}

function SortTh({
  label, col, sort, asc, onSort,
}: {
  label: string
  col: PincodeSortKey
  sort: PincodeSortKey
  asc: boolean
  onSort: (k: PincodeSortKey) => void
}) {
  const active = sort === col
  return (
    <th
      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        {active
          ? asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <ChevronDown size={11} className="opacity-30" />
        }
      </span>
    </th>
  )
}
