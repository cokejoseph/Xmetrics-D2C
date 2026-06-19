import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag, Calendar, CheckCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button } from '../../components/ui'
import { FulfillmentBadge, ChannelBadge, PaymentMethodBadge } from '../../components/shared/StatusBadge'
import type { Order } from '../../types'

// "Ready to Pack" tab removed — that lives in Orders page.
// Entry point here is Packing (orders pushed from Orders → Start Packing).
const TABS = [
  { key: 'packing',   label: 'Packing' },
  { key: 'ready',     label: 'Ready for Pickup' },
  { key: 'pickup',    label: 'Pickup Scheduled' },
  { key: 'transit',   label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rto',       label: 'RTO / Returned' },
] as const

type TabKey = typeof TABS[number]['key']

function getTabOrders(orders: Order[], tab: TabKey): Order[] {
  switch (tab) {
    case 'packing':
      return orders.filter(o => o.fulfillment_status === 'PACKING')
    case 'ready':
      return orders.filter(o => o.fulfillment_status === 'READY_TO_SHIP')
    case 'pickup':
      return orders.filter(o => o.shipments?.some(s => s.status === 'PICKUP_SCHEDULED'))
    case 'transit':
      return orders.filter(o => ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.fulfillment_status))
    case 'delivered':
      return orders.filter(o => o.fulfillment_status === 'DELIVERED')
    case 'rto':
      return orders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
    default:
      return []
  }
}

export default function Fulfillment() {
  const { orders, generateLabels, updateOrder } = useAppStore()
  const [tab, setTab] = useState<TabKey>('packing')
  const [selected, setSelected] = useState<string[]>([])
  const [pickupDate, setPickupDate] = useState('')
  const [showPickupDate, setShowPickupDate] = useState(false)

  const tabOrders = getTabOrders(orders, tab)

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleAll = () =>
    setSelected(prev => prev.length === tabOrders.length ? [] : tabOrders.map(o => o.id))

  const handleGenerateLabels = () => {
    generateLabels(selected)
    setSelected([])
  }

  const handleSchedulePickup = () => {
    if (!pickupDate) return
    selected.forEach(id => {
      const order = orders.find(o => o.id === id)
      if (!order) return
      updateOrder(id, {
        shipments: (order.shipments ?? []).map((s, i) =>
          i === 0 ? { ...s, status: 'PICKUP_SCHEDULED' as const, pickup_scheduled_at: pickupDate } : s
        ),
      })
    })
    setSelected([])
    setPickupDate('')
    setShowPickupDate(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Fulfillment</h1>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => {
          const count = getTabOrders(orders, t.key).length
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected([]); setShowPickupDate(false) }}
              className={`tab-line flex items-center gap-1.5 ${tab === t.key ? 'active' : ''}`}
            >
              {t.label}
              {count > 0 && (
                <span className="text-[10px] font-medium text-gray-400 tabular-nums">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <Card>
        {/* Packing: Generate Labels */}
        {tab === 'packing' && selected.length > 0 && (
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <span className="text-sm text-gray-600">{selected.length} selected</span>
            <Button size="sm" onClick={handleGenerateLabels}>
              <Tag size={14} /> Generate Labels ({selected.length})
            </Button>
          </div>
        )}

        {/* Ready for Pickup: Schedule Pickup with date */}
        {tab === 'ready' && selected.length > 0 && (
          <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-wrap">
            <span className="text-sm text-gray-600">{selected.length} selected</span>
            {!showPickupDate ? (
              <Button size="sm" variant="secondary" onClick={() => setShowPickupDate(true)}>
                <Calendar size={14} /> Schedule Pickup
              </Button>
            ) : (
              <>
                <input
                  type="date"
                  value={pickupDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setPickupDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <Button size="sm" onClick={handleSchedulePickup} disabled={!pickupDate}>
                  <CheckCircle size={14} /> Confirm Pickup
                </Button>
                <button onClick={() => setShowPickupDate(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.length === tabOrders.length && tabOrders.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Order</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Channel</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Payment</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                {(tab === 'pickup') && (
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Pickup Date</th>
                )}
                {(tab === 'transit' || tab === 'delivered' || tab === 'rto') && (
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">AWB</th>
                )}
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {tabOrders.map(order => {
                const shipment = order.shipments?.[0]
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selected.includes(order.id) ? 'bg-brand-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggleSelect(order.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{order.customer?.name}</p>
                      <p className="text-xs text-gray-500">{order.shipping_address.city}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <ChannelBadge channel={order.channel} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <PaymentMethodBadge method={order.payment_method} />
                    </td>
                    <td className="px-4 py-3">
                      <FulfillmentBadge status={order.fulfillment_status} />
                    </td>
                    {tab === 'pickup' && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-600">
                          {shipment?.pickup_scheduled_at
                            ? new Date(shipment.pickup_scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'
                          }
                        </span>
                      </td>
                    )}
                    {(tab === 'transit' || tab === 'delivered' || tab === 'rto') && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {shipment && (
                          <div>
                            <p className="text-xs font-mono text-gray-700">{shipment.awb_number}</p>
                            <p className="text-xs text-gray-500">{shipment.courier}</p>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {tabOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500 text-sm">
                    No orders in this stage
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          {tabOrders.length} orders
        </div>
      </Card>
    </div>
  )
}
