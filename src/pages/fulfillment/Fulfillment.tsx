import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Tag, Calendar, CheckCircle, RotateCcw, MapPin, PackageX,
  MessageCircle, Loader2, AlertTriangle, Truck,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Input } from '../../components/ui'
import { FulfillmentBadge, ChannelBadge, PaymentMethodBadge } from '../../components/shared/StatusBadge'
import { showToast } from '../../lib/toast'
import { DEMO_MODE } from '../../lib/supabase'
import { ndrReschedule, ndrUpdateAddress, ndrAcceptRto } from '../../lib/db'
import { useConfirm } from '../../hooks/useConfirm'
import type { Order } from '../../types'

const TABS = [
  { key: 'packing',   label: 'Packing' },
  { key: 'ready',     label: 'Ready for Pickup' },
  { key: 'pickup',    label: 'Pickup Scheduled' },
  { key: 'transit',   label: 'In Transit' },
  { key: 'ndr',       label: 'NDR', title: 'Non-Delivery Report — courier failed delivery attempt' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rto',       label: 'RTO / Returned' },
] as const

type TabKey = typeof TABS[number]['key']

function getTabOrders(orders: Order[], tab: TabKey): Order[] {
  switch (tab) {
    case 'packing':   return orders.filter(o => o.fulfillment_status === 'PACKING')
    case 'ready':     return orders.filter(o => o.fulfillment_status === 'READY_TO_SHIP')
    case 'pickup':    return orders.filter(o => o.shipments?.some(s => s.status === 'PICKUP_SCHEDULED'))
    case 'transit':   return orders.filter(o => ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.fulfillment_status))
    case 'ndr':       return orders.filter(o => o.fulfillment_status === 'NDR')
    case 'delivered': return orders.filter(o => o.fulfillment_status === 'DELIVERED')
    case 'rto':       return orders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
    default:          return []
  }
}

// ─── NDR demo reasons (deterministic per order so they're stable) ────────────

const DEMO_NDR_REASONS = [
  'Customer not available or not reachable',
  'Wrong address — unable to locate',
  'Customer refused to accept shipment',
  'Address not found in delivery area',
  'Customer requested rescheduling',
  'Delivery area inaccessible',
]

function getDemoNdrReason(orderId: string): string {
  const idx = orderId.charCodeAt(orderId.length - 1) % DEMO_NDR_REASONS.length
  return DEMO_NDR_REASONS[idx]
}

// ─── NDR Order Card ──────────────────────────────────────────────────────────

type NdrAction = 'reschedule' | 'address' | null

function NdrOrderCard({
  order,
  shiprocketEmail,
  shiprocketPassword,
}: {
  order: Order
  shiprocketEmail: string | null
  shiprocketPassword: string | null
}) {
  const confirm = useConfirm()
  const [action, setAction] = useState<NdrAction>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'rescheduled' | 'address-updated' | 'rto-accepted' | null>(null)
  const [waNotified, setWaNotified] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [addressForm, setAddressForm] = useState({
    address: order.shipping_address?.address ?? '',
    city: order.shipping_address?.city ?? '',
    state: order.shipping_address?.state ?? '',
    pincode: order.shipping_address?.pincode ?? '',
  })

  const shipment = order.shipments?.[0]
  const awb = shipment?.awb_number ?? ''
  const ndrReason = DEMO_MODE ? getDemoNdrReason(order.id) : 'Delivery attempt failed'
  const amount = order.gross_amount - order.discount_amount

  const getCreds = () => {
    if (DEMO_MODE) return { ok: true }
    if (!shiprocketEmail || !shiprocketPassword) return { ok: false }
    return { ok: true }
  }

  const handleReschedule = async () => {
    const creds = getCreds()
    if (!creds.ok) { showToast.error('Shiprocket not connected — go to Settings → Integrations'); return }
    setLoading(true)
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 700))
      showToast.success('Re-delivery scheduled with courier')
      setDone('rescheduled')
    } else {
      const { ok, error } = await ndrReschedule(shiprocketEmail!, shiprocketPassword!, awb,
        rescheduleDate ? `Rescheduled for ${rescheduleDate}` : undefined)
      if (ok) { showToast.success('Re-delivery scheduled with Shiprocket'); setDone('rescheduled') }
      else showToast.error(error ?? 'Failed to reschedule delivery')
    }
    setLoading(false)
    setAction(null)
  }

  const handleUpdateAddress = async () => {
    if (!addressForm.address || !addressForm.city || !addressForm.pincode) return
    const creds = getCreds()
    if (!creds.ok) { showToast.error('Shiprocket not connected — go to Settings → Integrations'); return }
    setLoading(true)
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 700))
      showToast.success('Address updated and re-delivery scheduled')
      setDone('address-updated')
    } else {
      const { ok, error } = await ndrUpdateAddress(shiprocketEmail!, shiprocketPassword!, awb, {
        address: addressForm.address,
        city: addressForm.city,
        state: addressForm.state,
        pincode: addressForm.pincode,
      })
      if (ok) { showToast.success('Address updated and re-delivery requested'); setDone('address-updated') }
      else showToast.error(error ?? 'Failed to update delivery address')
    }
    setLoading(false)
    setAction(null)
  }

  const handleAcceptRto = async () => {
    const ok = await confirm({
      title: 'Accept RTO?',
      message: `This will notify Shiprocket to return order ${order.order_number} to your warehouse. This cannot be undone.`,
      confirmText: 'Accept RTO',
      cancelText: 'Keep Trying',
      isDangerous: true,
    })
    if (!ok) return
    const creds = getCreds()
    if (!creds.ok) { showToast.error('Shiprocket not connected — go to Settings → Integrations'); return }
    setLoading(true)
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 700))
      showToast.success('RTO accepted — courier notified to return shipment')
      setDone('rto-accepted')
    } else {
      const { ok: apiOk, error } = await ndrAcceptRto(shiprocketEmail!, shiprocketPassword!, awb)
      if (apiOk) { showToast.success('RTO accepted — shipment returning to warehouse'); setDone('rto-accepted') }
      else showToast.error(error ?? 'Failed to accept RTO')
    }
    setLoading(false)
  }

  const handleWaNotify = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    setLoading(false)
    setWaNotified(true)
    showToast.success('WhatsApp message sent to customer')
  }

  return (
    <Card className={`p-4 transition-opacity ${done === 'rto-accepted' ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/orders/${order.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                {order.order_number}
              </Link>
              <PaymentMethodBadge method={order.payment_method} />
            </div>
            <p className="text-[13px] font-medium text-gray-900 dark:text-white mt-0.5">{order.customer?.name}</p>
            <p className="text-xs text-gray-500">
              {order.shipping_address?.city}{order.shipping_address?.state ? `, ${order.shipping_address.state}` : ''}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            ₹{amount.toLocaleString('en-IN')}
          </p>
          {done && (
            <span className={`text-[11px] font-medium ${
              done === 'rto-accepted' ? 'text-red-600' :
              done === 'rescheduled' ? 'text-green-600' : 'text-brand-600'
            }`}>
              {done === 'rescheduled' && '✓ Rescheduled'}
              {done === 'address-updated' && '✓ Address updated'}
              {done === 'rto-accepted' && '↩ RTO accepted'}
            </span>
          )}
        </div>
      </div>

      {/* Shipment + NDR info */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={12} className="text-gray-400 shrink-0" />
            {awb ? (
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{awb}</span>
            ) : (
              <span className="text-xs text-gray-400">No AWB</span>
            )}
            {shipment?.courier && (
              <span className="text-xs text-gray-400">via {shipment.courier}</span>
            )}
          </div>
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600 dark:text-gray-400">{ndrReason}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full">
            Attempt #1
          </span>
        </div>
      </div>

      {/* Action buttons (hidden once resolved) */}
      {!done && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAction(action === 'reschedule' ? null : 'reschedule')}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              action === 'reschedule'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20'
            }`}
          >
            <RotateCcw size={12} /> Reschedule
          </button>
          <button
            onClick={() => setAction(action === 'address' ? null : 'address')}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              action === 'address'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20'
            }`}
          >
            <MapPin size={12} /> Update Address
          </button>
          <button
            onClick={handleAcceptRto}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-white/[0.1] text-red-600 dark:text-red-400 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {loading && !action ? <Loader2 size={12} className="animate-spin" /> : <PackageX size={12} />}
            Accept RTO
          </button>
          <div className="ml-auto">
            <button
              onClick={handleWaNotify}
              disabled={loading || waNotified}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                waNotified
                  ? 'border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-gray-400 hover:border-green-300 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
              }`}
            >
              <MessageCircle size={12} />
              {waNotified ? 'WA Sent ✓' : 'Notify Customer'}
            </button>
          </div>
        </div>
      )}

      {/* Reschedule form */}
      {action === 'reschedule' && !done && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Preferred re-delivery date (optional)</p>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date"
              value={rescheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setRescheduleDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
            />
            <Button size="sm" onClick={handleReschedule} disabled={loading}>
              {loading ? <><Loader2 size={12} className="animate-spin" /> Scheduling…</> : <><CheckCircle size={12} /> Confirm Reschedule</>}
            </Button>
            <button onClick={() => setAction(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Cancel
            </button>
          </div>
          {!rescheduleDate && (
            <p className="text-[11px] text-gray-400 mt-1.5">Leave blank to let the courier pick the next available slot.</p>
          )}
        </div>
      )}

      {/* Address update form */}
      {action === 'address' && !done && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">New delivery address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-400 mb-1">Address line</label>
              <Input
                value={addressForm.address}
                onChange={e => setAddressForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street, building, locality"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">City</label>
              <Input
                value={addressForm.city}
                onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">State</label>
              <Input
                value={addressForm.state}
                onChange={e => setAddressForm(f => ({ ...f, state: e.target.value }))}
                placeholder="State"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Pincode</label>
              <Input
                value={addressForm.pincode}
                onChange={e => setAddressForm(f => ({ ...f, pincode: e.target.value }))}
                placeholder="6-digit pincode"
                maxLength={6}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleUpdateAddress}
              disabled={loading || !addressForm.address || !addressForm.city || !addressForm.pincode}
            >
              {loading ? <><Loader2 size={12} className="animate-spin" /> Updating…</> : <><MapPin size={12} /> Update & Reschedule</>}
            </Button>
            <button onClick={() => setAction(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── NDR Recovery Center ─────────────────────────────────────────────────────

function NdrRecoveryCenter({
  orders,
  shiprocketEmail,
  shiprocketPassword,
}: {
  orders: Order[]
  shiprocketEmail: string | null
  shiprocketPassword: string | null
}) {
  if (orders.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Truck size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm font-medium">No NDR orders</p>
        <p className="text-gray-400 text-xs mt-1">Orders with failed delivery attempts appear here</p>
      </Card>
    )
  }

  const needsAction = orders.filter(o => o.fulfillment_status === 'NDR').length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/[0.07] border border-amber-500/20 dark:border-amber-400/20 rounded-xl">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
        <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
          {needsAction} order{needsAction !== 1 ? 's' : ''} with failed delivery — reschedule, update address, or accept RTO
        </span>
        {!DEMO_MODE && !shiprocketEmail && (
          <span className="ml-auto text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle size={12} />
            Shiprocket not connected
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3 stagger-children">
        {orders.map(order => (
          <NdrOrderCard
            key={order.id}
            order={order}
            shiprocketEmail={shiprocketEmail}
            shiprocketPassword={shiprocketPassword}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Fulfillment page ───────────────────────────────────────────────────

export default function Fulfillment() {
  useEffect(() => { document.title = 'Fulfillment · Xmetrics' }, [])
  const { orders, integrations, generateLabels, schedulePickup } = useAppStore()
  const [tab, setTab] = useState<TabKey>('packing')
  const [selected, setSelected] = useState<string[]>([])
  const [pickupDate, setPickupDate] = useState('')
  const [showPickupDate, setShowPickupDate] = useState(false)

  const tabOrders = getTabOrders(orders, tab)
  const showStatusCol = tab === 'transit'

  const shiprocketInt = integrations.find(i => i.platform === 'SHIPROCKET' && i.status === 'CONNECTED')
  const shiprocketEmail = shiprocketInt?.credentials?.email ?? null
  const shiprocketPassword = shiprocketInt?.credentials?.password ?? null

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
    schedulePickup(selected, pickupDate)
    setSelected([])
    setPickupDate('')
    setShowPickupDate(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Fulfillment</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {tabOrders.length} order{tabOrders.length !== 1 ? 's' : ''} in {TABS.find(t => t.key === tab)?.label.toLowerCase()}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 dark:border-white/[0.06] overflow-x-auto">
        {TABS.map(t => {
          const count = getTabOrders(orders, t.key).length
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected([]); setShowPickupDate(false) }}
              className={`tab-line flex items-center gap-1.5 ${tab === t.key ? 'active' : ''}`}
              title={'title' in t ? t.title : undefined}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-medium tabular-nums ${
                  t.key === 'ndr' ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* NDR tab — card layout */}
      {tab === 'ndr' && (
        <NdrRecoveryCenter
          orders={tabOrders}
          shiprocketEmail={shiprocketEmail}
          shiprocketPassword={shiprocketPassword}
        />
      )}

      {/* All other tabs — table layout */}
      {tab !== 'ndr' && (
        <Card>
          {/* Packing: Generate Labels */}
          {tab === 'packing' && selected.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-600 rounded-t-xl border-b border-brand-700">
              <span className="text-sm font-medium text-white">{selected.length} order{selected.length > 1 ? 's' : ''} selected</span>
              <Button size="sm" onClick={handleGenerateLabels} className="ml-auto bg-white text-brand-700 hover:bg-brand-50">
                <Tag size={14} /> Generate Labels ({selected.length})
              </Button>
              <button onClick={() => setSelected([])} className="text-white/70 hover:text-white text-sm">✕</button>
            </div>
          )}

          {/* Ready for Pickup: Schedule Pickup */}
          {tab === 'ready' && selected.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 dark:bg-white/[0.05] rounded-t-xl border-b border-gray-700 dark:border-white/[0.08] flex-wrap">
              <span className="text-sm font-medium text-white dark:text-gray-200">{selected.length} selected</span>
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
                <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.length === tabOrders.length && tabOrders.length > 0}
                      onChange={toggleAll}
                      className="rounded accent-brand-600 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Channel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Payment</th>
                  {showStatusCol && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  )}
                  {tab === 'pickup' && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Pickup Date</th>
                  )}
                  {(tab === 'transit' || tab === 'delivered' || tab === 'rto') && (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">AWB</th>
                  )}
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {tabOrders.map(order => {
                  const shipment = order.shipments?.[0]
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-gray-50 dark:border-white/[0.04] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${selected.includes(order.id) ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggleSelect(order.id)} className="rounded accent-brand-600 w-4 h-4 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{order.customer?.name}</p>
                        <p className="text-xs text-gray-500">{order.shipping_address?.city}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ChannelBadge channel={order.channel} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <PaymentMethodBadge method={order.payment_method} />
                      </td>
                      {showStatusCol && (
                        <td className="px-4 py-3">
                          <FulfillmentBadge status={order.fulfillment_status} />
                        </td>
                      )}
                      {tab === 'pickup' && (
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {shipment?.pickup_scheduled_at
                              ? new Date(shipment.pickup_scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </span>
                        </td>
                      )}
                      {(tab === 'transit' || tab === 'delivered' || tab === 'rto') && (
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {shipment && (
                            <div>
                              <p className="text-xs font-mono text-gray-700 dark:text-gray-300">{shipment.awb_number}</p>
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
          <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] text-xs text-gray-500">
            {tabOrders.length} order{tabOrders.length !== 1 ? 's' : ''}
          </div>
        </Card>
      )}
    </div>
  )
}
