import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Copy, CheckCheck, TrendingUp, TrendingDown, Package, Users, Zap, AlertTriangle, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { generateDailyBrief, buildWhatsAppText, getOrderDates, dayLabel } from '../../lib/briefEngine'
import { Card, Button, Modal } from '../../components/ui'

const PRIORITY_STYLE = {
  HIGH: 'bg-red-50 border-l-2 border-red-400 text-red-800',
  MEDIUM: 'bg-amber-50 border-l-2 border-amber-400 text-amber-800',
  LOW: 'bg-green-50 border-l-2 border-green-400 text-green-800',
}

const PRIORITY_DOT = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-green-500',
}

export default function DailyBrief() {
  useEffect(() => { document.title = 'Daily Brief · Xmetrics' }, [])
  const { orders, customers, products, exceptions } = useAppStore()
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [copied, setCopied] = useState(false)

  const dates = useMemo(() => getOrderDates(orders), [orders])
  const [selectedDate, setSelectedDate] = useState<string>(dates[0] ?? new Date().toISOString().slice(0, 10))

  const brief = useMemo(() => {
    if (!selectedDate) return null
    return generateDailyBrief(selectedDate, orders, customers, products, exceptions)
  }, [selectedDate, orders, customers, products, exceptions])

  const whatsAppText = brief ? buildWhatsAppText(brief) : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsAppText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!brief) return <div className="text-gray-500 text-sm">No data available.</div>

  const { headline: h, delivery_health: d, channel_performance, product_performance, customer_health, actions } = brief

  return (
    <div className="flex gap-4 min-h-0">
      {/* Date sidebar */}
      <div className="w-44 shrink-0 space-y-1 overflow-y-auto max-h-[80vh] pb-2">
        {dates.length === 0 && (
          <p className="text-xs text-gray-400 px-2">No order history</p>
        )}
        {groupDates(dates.slice(0, 30)).map(({ group, dates: groupDates }) => (
          <div key={group}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-3 pb-1">{group}</p>
            {groupDates.map(date => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedDate === date
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                {dayLabel(date)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Main brief */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Daily Brief — {dayLabel(selectedDate)}</h1>
          <Button size="sm" variant="secondary" onClick={() => setShowWhatsApp(true)}>
            Export to WhatsApp
          </Button>
        </div>

        {/* Headline P&L */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-brand-600" /> Headline P&L
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PLStat label="Revenue" value={`₹${Math.round(h.total_revenue).toLocaleString('en-IN')}`} sub={`${h.total_orders} orders`} />
            <PLStat label="COGS" value={`₹${Math.round(h.cogs).toLocaleString('en-IN')}`} sub="estimated" dimmed />
            <PLStat label="Shipping Cost" value={`₹${Math.round(h.shipping_cost).toLocaleString('en-IN')}`} sub="actual" dimmed />
            <PLStat
              label="True Profit"
              value={`₹${Math.round(h.true_profit).toLocaleString('en-IN')}`}
              sub={`${Math.round(h.true_margin)}% margin`}
              highlight={h.true_profit > 0 ? 'green' : 'red'}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 text-sm text-gray-600">
            <span><span className="font-medium text-gray-900">{h.paid_count}</span> paid</span>
            <span><span className="font-medium text-gray-900">{h.cod_count}</span> COD</span>
            <span><span className="font-medium text-gray-900">{h.rto_count}</span> RTO</span>
          </div>
        </Card>

        {/* Delivery Health */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {d.spiked
              ? <AlertTriangle size={14} className="text-red-500" />
              : <TrendingDown size={14} className="text-green-600" />}
            Delivery Health
          </h2>
          {d.spiked && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
              RTO spike: {Math.round(d.rto_rate * 100)}% (threshold: 15%)
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <PLStat label="RTO Rate" value={`${Math.round(d.rto_rate * 100)}%`} highlight={d.spiked ? 'red' : undefined} tooltip="Return-to-Origin rate: percentage of shipped orders being returned. Industry benchmark for D2C is under 20%." />
            <PLStat label="Avg RTO Score" value={String(Math.round(d.avg_rto_score))} sub="out of 100" tooltip="Average risk score across all orders today. Scores above 60 are flagged for manual review. Lower is better." />
            <PLStat label="High Risk Orders" value={String(d.high_risk_orders.length)} sub="score ≥ 60" tooltip="Orders with RTO risk score ≥ 60 — these have a high probability of being returned. Review before shipping." />
          </div>
          {d.high_risk_orders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {d.high_risk_orders.map(o => (
                <span key={o.order_number} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg font-medium">
                  {o.order_number} ({o.score})
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Channel + Product */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Zap size={14} className="text-brand-600" /> Channel Performance
            </h2>
            {channel_performance.length === 0 ? (
              <p className="text-sm text-gray-400">No orders this day</p>
            ) : (
              <div className="space-y-2">
                {channel_performance.sort((a, b) => b.orders - a.orders).map(ch => (
                  <div key={ch.channel} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-700">{ch.channel}</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{Math.round(ch.revenue).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{ch.orders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package size={14} className="text-brand-600" /> Top Products
            </h2>
            {product_performance.length === 0 ? (
              <p className="text-sm text-gray-400">No products sold</p>
            ) : (
              <div className="space-y-2">
                {product_performance.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{p.name}</p>
                      {p.low_stock && <span className="text-[10px] text-red-600 font-semibold">LOW STOCK</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{Math.round(p.revenue).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{p.units} units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Customer Health */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={14} className="text-brand-600" /> Customer Health
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <PLStat label="New Customers" value={String(customer_health.new_customers)} />
            <PLStat label="Returning" value={String(customer_health.returning_customers)} />
            <PLStat label="Repeat Rate" value={`${Math.round(customer_health.repeat_rate)}%`} highlight={customer_health.repeat_rate > 40 ? 'green' : undefined} />
          </div>
        </Card>

        {/* Action Items */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Action Items</h2>
          {actions.length === 0 ? (
            <p className="text-sm text-gray-400">No action items for this period</p>
          ) : (
            <div className="space-y-2">
              {actions.map((action, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${PRIORITY_STYLE[action.priority]}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[action.priority]}`} />
                  <span className="flex-1">{action.text}</span>
                  {action.link && (
                    <Link
                      to={action.link}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-semibold opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      Go <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* WhatsApp Export Modal */}
      <Modal open={showWhatsApp} onClose={() => setShowWhatsApp(false)} title="Export to WhatsApp">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
            {whatsAppText}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{whatsAppText.length} characters</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowWhatsApp(false)}>Close</Button>
              <Button onClick={handleCopy}>
                {copied ? <><CheckCheck size={13} /> Copied!</> : <><Copy size={13} /> Copy Text</>}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function groupDates(dates: string[]): { group: string; dates: string[] }[] {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  const dow = today.getDay()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  const recent: string[] = [], thisWeek: string[] = [], older: string[] = []
  for (const d of dates) {
    if (d === todayStr || d === yesterdayStr) recent.push(d)
    else if (d >= weekStartStr) thisWeek.push(d)
    else older.push(d)
  }

  const groups: { group: string; dates: string[] }[] = []
  if (recent.length) groups.push({ group: 'Recent', dates: recent })
  if (thisWeek.length) groups.push({ group: 'This Week', dates: thisWeek })
  if (older.length) groups.push({ group: 'Earlier', dates: older })
  return groups
}

function PLStat({
  label, value, sub, dimmed, highlight, tooltip,
}: {
  label: string
  value: string
  sub?: string
  dimmed?: boolean
  highlight?: 'green' | 'red'
  tooltip?: string
}) {
  const valueColor = highlight === 'green'
    ? 'text-green-700'
    : highlight === 'red'
      ? 'text-red-600'
      : dimmed ? 'text-gray-500' : 'text-gray-900'
  return (
    <div title={tooltip} className={tooltip ? 'cursor-help' : undefined}>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}
