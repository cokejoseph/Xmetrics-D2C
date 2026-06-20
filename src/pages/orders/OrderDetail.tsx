import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronRight, MapPin, Package, Clock, User, Truck, CreditCard, ShieldAlert, Lock } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Badge } from '../../components/ui'
import {
  FulfillmentBadge, PaymentBadge, ChannelBadge,
  ShipmentStatusBadge, PaymentMethodBadge,
} from '../../components/shared/StatusBadge'
import { calculateRTOScore } from '../../lib/services'
import { lookupPincode } from '../../lib/pincodeService'
import { useCanViewFinancials } from '../../hooks/useCurrentRole'
import type { PincodeResult } from '../../lib/pincodeService'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { orders, products, customers, currentBrand, updateOrder } = useAppStore()
  const [pincodeData, setPincodeData] = useState<PincodeResult | null>(null)

  // All hooks must be called unconditionally before any early returns
  const canViewFinancials = useCanViewFinancials()

  const order = orders.find(o => o.id === id)

  useEffect(() => {
    if (!order?.shipping_address.pincode) return
    lookupPincode(order.shipping_address.pincode).then(setPincodeData).catch(() => setPincodeData(null))
  }, [order?.shipping_address.pincode])

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Order not found</p>
        <Link to="/orders" className="text-brand-600 mt-2 inline-block hover:underline">← Back to Orders</Link>
      </div>
    )
  }

  const customer = order.customer ?? customers.find(c => c.id === order.customer_id)
  const items = order.items ?? []
  const brandAov = currentBrand?.settings?.average_order_value ?? 450

  // P&L waterfall
  const revenue = order.gross_amount
  const discount = order.discount_amount
  const cogs = items.reduce((s, item) => {
    const p = products.find(x => x.id === item.product_id)
    return s + (p?.cost_price ?? 0) * item.quantity
  }, 0)
  const shippingCost = order.shipping_cost ?? 60
  const txnFee = (order.razorpay_fee ?? 0) + (order.razorpay_tax ?? 0)
  const rtoReserve = order.rto_risk_score >= 60 ? Math.round(revenue * 0.05) : 0
  const netProfit = revenue - discount - cogs - shippingCost - txnFee - rtoReserve
  const margin = revenue > 0 ? (netProfit / (revenue - discount)) * 100 : 0

  // RTO score — enriched with live pincode data
  const rtoResult = calculateRTOScore({
    payment_method: order.payment_method,
    pincode: order.shipping_address.pincode,
    customer_id: order.customer_id,
    order_value: order.gross_amount,
    brand_aov: brandAov,
    is_first_order: (customer?.total_orders ?? 1) <= 1,
    has_prior_rto: customer?.tags?.includes('rto-history') ?? false,
    address_complete: !!(order.shipping_address.address && order.shipping_address.pincode),
    pincodeData,
  })

  const shipment = order.shipments?.[0]
  const canMarkPaid = order.payment_status === 'AWAITING_PAYMENT'
    && order.payment_method !== 'COD'
    && order.channel === 'MANUAL'

  return (
    <div className="space-y-4">
      {/* Sticky action header */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-white/95 dark:bg-[#0C1118]/97 backdrop-blur-sm border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-3 flex-wrap">
          <nav className="flex items-center gap-1.5 text-sm">
            <Link to="/orders" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">Orders</Link>
            <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
            <h1 className="text-gray-900 dark:text-gray-100 font-semibold">{order.order_number}</h1>
          </nav>
          <div className="flex items-center gap-2 ml-1">
            <ChannelBadge channel={order.channel} />
            <FulfillmentBadge status={order.fulfillment_status} />
            <PaymentBadge status={order.payment_status} />
          </div>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package size={16} className="text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900">Order Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="pb-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Qty</th>
                  <th className="pb-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Unit Price</th>
                  <th className="pb-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{item.product?.name ?? item.sku}</p>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    </td>
                    <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-700">₹{item.unit_price.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right font-medium text-gray-900">₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="pt-3 text-sm font-medium text-gray-900">Total</td>
                  <td className="pt-3 text-right text-sm font-medium text-gray-900">₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* P&L Waterfall */}
          {canViewFinancials ? (
            <Card className="p-5">
              <h2 className="text-sm font-medium text-gray-900 mb-4">P&L Breakdown</h2>
              <div className="space-y-2">
                <PLRow label="Gross Revenue" value={revenue} positive />
                {discount > 0 && <PLRow label="Discount" value={-discount} />}
                <PLRow label="COGS" value={-cogs} />
                <PLRow label="Shipping Cost" value={-shippingCost} />
                {txnFee > 0
                  ? <PLRow label={`Transaction Fee${order.razorpay_tax ? ' (incl. GST)' : ''}`} value={-txnFee} />
                  : <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Transaction Fee</span>
                      <span className="text-gray-400 text-xs italic">pending payment</span>
                    </div>
                }
                {rtoReserve > 0 && <PLRow label="RTO Reserve (5%)" value={-rtoReserve} />}
                <div className={`mt-2 rounded-xl px-4 py-3.5 flex items-center justify-between ${netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-400/[0.08]' : 'bg-red-50 dark:bg-red-400/[0.08]'}`}>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${netProfit >= 0 ? 'text-emerald-600/60 dark:text-emerald-400/50' : 'text-red-600/60 dark:text-red-400/50'}`}>Net Profit</p>
                    <p className={`text-[11px] ${netProfit >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/60' : 'text-red-600/70 dark:text-red-400/60'}`}>{Math.round(margin)}% margin</p>
                  </div>
                  <span className={`text-[28px] font-bold tabular-nums tracking-tight leading-none ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    ₹{Math.round(netProfit).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5 flex items-center gap-3 text-gray-400">
              <Lock size={16} />
              <span className="text-sm">P&L data is restricted to Editor and above</span>
            </Card>
          )}

          {/* Shipment tracking */}
          {shipment && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={16} className="text-gray-400" />
                <h2 className="text-sm font-medium text-gray-900">Shipment</h2>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{shipment.courier}</p>
                  <p className="text-xs text-gray-500 font-mono">AWB: {shipment.awb_number}</p>
                </div>
                <ShipmentStatusBadge status={shipment.status} />
              </div>
              <ShipmentTimeline status={shipment.status} />
            </Card>
          )}

          {/* Order Timeline */}
          {(order.timeline ?? []).length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-gray-400" />
                <h2 className="text-sm font-medium text-gray-900">Timeline</h2>
              </div>
              <div className="space-y-3">
                {(order.timeline ?? []).map(event => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-brand-600 mt-1 shrink-0" />
                      <div className="w-px flex-1 bg-gray-100 mt-1" />
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.event.replace(/_/g, ' ')}</p>
                      {event.actor && <p className="text-xs text-gray-500">{event.actor}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          {customer && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User size={15} className="text-gray-400" />
                <h2 className="text-sm font-medium text-gray-900">Customer</h2>
              </div>
              <Link to={`/customers/${customer.id}`} className="block hover:bg-gray-50 rounded-md p-2 -mx-2 transition-colors">
                <p className="text-sm font-medium text-brand-600">{customer.name}</p>
                <p className="text-xs text-gray-500">{customer.phone}</p>
                {customer.email && <p className="text-xs text-gray-500">{customer.email}</p>}
              </Link>
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-base font-medium text-gray-900">{customer.total_orders}</p>
                  <p className="text-xs text-gray-500">Orders</p>
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900">₹{customer.total_spent.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-500">Lifetime</p>
                </div>
              </div>
            </Card>
          )}

          {/* Shipping Address */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900">Shipping Address</h2>
            </div>
            <p className="text-sm text-gray-700">{order.shipping_address.address}</p>
            <p className="text-sm text-gray-700">
              {order.shipping_address.city}, {order.shipping_address.state}
            </p>
            <p className="text-sm text-gray-500">{order.shipping_address.pincode}</p>
          </Card>

          {/* RTO Intelligence */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={15} className="text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900">RTO Intelligence</h2>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-light text-gray-900">{rtoResult.score}</span>
              <Badge
                variant={rtoResult.level === 'HIGH' ? 'danger' : rtoResult.level === 'MEDIUM' ? 'warning' : 'success'}
              >
                {rtoResult.level} RISK
              </Badge>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${rtoResult.score >= 60 ? 'bg-red-500' : rtoResult.score >= 30 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${rtoResult.score}%` }}
              />
            </div>

            {/* Pincode location context */}
            {pincodeData && (
              <div className="mb-3 px-2.5 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-700">{pincodeData.district}, {pincodeData.state}</p>
                <div className="flex flex-wrap gap-x-3">
                  <span>Tier {pincodeData.tier}</span>
                  {pincodeData.isRural && <span className="text-amber-600">Rural area</span>}
                  {!pincodeData.deliverable && <span className="text-red-600 font-medium">Non-deliverable</span>}
                  {pincodeData.highRiskState && <span className="text-red-600">High-risk region</span>}
                </div>
              </div>
            )}

            <div className="space-y-1">
              {rtoResult.factors.map((f, i) => (
                <p key={i} className="text-xs text-gray-600">• {f}</p>
              ))}
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={15} className="text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900">Payment</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <PaymentMethodBadge method={order.payment_method} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-medium text-gray-900">₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <PaymentBadge status={order.payment_status} />
              </div>
              {canMarkPaid && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => updateOrder(order.id, { payment_status: 'PAID' })}
                    className="w-full text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2 transition-colors"
                  >
                    Mark as Paid
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PLRow({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  const display = value < 0 ? `−₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}` : `₹${Math.round(value).toLocaleString('en-IN')}`
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={positive ? 'font-medium text-gray-900' : 'text-gray-600'}>{display}</span>
    </div>
  )
}

const SHIP_STAGES = [
  'LABEL_CREATED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const

const SHIP_LABELS: Record<string, string> = {
  LABEL_CREATED: 'Label Created',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
}

function ShipmentTimeline({ status }: { status: string }) {
  const isRTO = status === 'RTO_INITIATED' || status === 'RTO_DELIVERED' || status === 'LOST'
  const activeIndex = isRTO ? -1 : SHIP_STAGES.indexOf(status as typeof SHIP_STAGES[number])

  if (isRTO) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-md">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs font-medium text-red-700">
          {status === 'LOST' ? 'Package Lost' : status === 'RTO_DELIVERED' ? 'RTO Delivered' : 'RTO Initiated — returning to sender'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1">
      {SHIP_STAGES.map((stage, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        return (
          <div key={stage} className="flex-1 flex flex-col items-center min-w-[60px]">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={`flex-1 h-0.5 ${done || current ? 'bg-brand-600' : 'bg-gray-200'}`} />
              )}
              <div className={`w-3 h-3 rounded-full shrink-0 border-2 transition-colors ${
                current
                  ? 'bg-brand-600 border-brand-600 ring-2 ring-brand-200'
                  : done
                    ? 'bg-brand-600 border-brand-600'
                    : 'bg-white border-gray-300'
              }`} />
              {i < SHIP_STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 ${done ? 'bg-brand-600' : 'bg-gray-200'}`} />
              )}
            </div>
            <p className={`text-[10px] text-center mt-1 leading-tight px-0.5 ${
              current ? 'text-brand-700 font-medium' : done ? 'text-brand-500' : 'text-gray-400'
            }`}>
              {SHIP_LABELS[stage]}
            </p>
          </div>
        )
      })}
    </div>
  )
}
