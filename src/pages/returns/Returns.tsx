import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  RotateCcw, Search, RefreshCw, Truck, CheckCircle2,
  XCircle, X, ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Input, Modal } from '../../components/ui'
import { showToast } from '../../lib/toast'
import {
  fetchReturns,
  initiateReturn,
  generateReturnLabel,
  approveReturnRefund,
  RETURN_STATUS_CONFIG,
  RETURN_REASON_LABELS,
  RETURN_CONDITION_LABELS,
} from '../../lib/returns'
import { DEMO_MODE } from '../../lib/supabase'
import type { Return, ReturnStatus, ReturnCondition, ReturnReason } from '../../types'

// ── Demo seed data ────────────────────────────────────────────────────────────

const DEMO_RETURNS: Return[] = [
  {
    id: 'ret-demo-1', brand_id: 'brand-1', order_id: 'ord-demo-1', customer_id: 'cust-1',
    return_reason: 'damaged', customer_comment: 'Packaging was torn on arrival',
    status: 'PENDING_APPROVAL', denial_reason: null, return_condition: null,
    return_eligible_for_resale: false, return_window_days: 30,
    return_initiation_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    return_approved_date: null, return_approved_by: null, return_approval_notes: null,
    shiprocket_awb_number: null, shiprocket_order_id: null, shiprocket_label_url: null, shiprocket_error: null,
    expected_return_delivery: null, actual_return_received_date: null,
    refund_amount: 1499, refund_method: 'RAZORPAY', razorpay_refund_id: null, cod_refund_status: null,
    inventory_updated_at: null, created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    order: { id: 'ord-demo-1', order_number: '#XM-1042' } as Return['order'],
    customer: { id: 'cust-1', name: 'Anjali Sharma', phone: '9876543210', email: 'anjali@example.com' } as Return['customer'],
  },
  {
    id: 'ret-demo-2', brand_id: 'brand-1', order_id: 'ord-demo-2', customer_id: 'cust-2',
    return_reason: 'wrong_item', customer_comment: null,
    status: 'APPROVED', denial_reason: null, return_condition: null,
    return_eligible_for_resale: false, return_window_days: 30,
    return_initiation_date: new Date(Date.now() - 4 * 86400000).toISOString(),
    return_approved_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    return_approved_by: 'ops@xmetrics.app', return_approval_notes: null,
    shiprocket_awb_number: null, shiprocket_order_id: null, shiprocket_label_url: null, shiprocket_error: null,
    expected_return_delivery: null, actual_return_received_date: null,
    refund_amount: 2199, refund_method: 'RAZORPAY', razorpay_refund_id: null, cod_refund_status: null,
    inventory_updated_at: null, created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    order: { id: 'ord-demo-2', order_number: '#XM-1038' } as Return['order'],
    customer: { id: 'cust-2', name: 'Rohan Verma', phone: '9123456789', email: null } as Return['customer'],
  },
  {
    id: 'ret-demo-3', brand_id: 'brand-1', order_id: 'ord-demo-3', customer_id: 'cust-3',
    return_reason: 'defective', customer_comment: 'Stopped working after 2 days',
    status: 'IN_TRANSIT', denial_reason: null, return_condition: null,
    return_eligible_for_resale: false, return_window_days: 30,
    return_initiation_date: new Date(Date.now() - 7 * 86400000).toISOString(),
    return_approved_date: new Date(Date.now() - 6 * 86400000).toISOString(),
    return_approved_by: 'ops@xmetrics.app', return_approval_notes: null,
    shiprocket_awb_number: 'SR1234567890001', shiprocket_order_id: 'SR-ORD-001', shiprocket_label_url: '#',
    shiprocket_error: null,
    expected_return_delivery: new Date(Date.now() + 2 * 86400000).toISOString(),
    actual_return_received_date: null,
    refund_amount: 3499, refund_method: 'RAZORPAY', razorpay_refund_id: null, cod_refund_status: null,
    inventory_updated_at: null, created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    order: { id: 'ord-demo-3', order_number: '#XM-1031' } as Return['order'],
    customer: { id: 'cust-3', name: 'Priya Nair', phone: '9988776655', email: 'priya@example.com' } as Return['customer'],
  },
  {
    id: 'ret-demo-4', brand_id: 'brand-1', order_id: 'ord-demo-4', customer_id: 'cust-4',
    return_reason: 'changed_mind', customer_comment: null,
    status: 'RECEIVED', denial_reason: null, return_condition: null,
    return_eligible_for_resale: false, return_window_days: 30,
    return_initiation_date: new Date(Date.now() - 12 * 86400000).toISOString(),
    return_approved_date: new Date(Date.now() - 11 * 86400000).toISOString(),
    return_approved_by: 'ops@xmetrics.app', return_approval_notes: null,
    shiprocket_awb_number: 'SR9876543210002', shiprocket_order_id: 'SR-ORD-002', shiprocket_label_url: '#',
    shiprocket_error: null,
    expected_return_delivery: new Date(Date.now() - 1 * 86400000).toISOString(),
    actual_return_received_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    refund_amount: 899, refund_method: 'COD_REVERSAL', razorpay_refund_id: null, cod_refund_status: 'PENDING',
    inventory_updated_at: null, created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    order: { id: 'ord-demo-4', order_number: '#XM-1025' } as Return['order'],
    customer: { id: 'cust-4', name: 'Kiran Mehta', phone: '8765432109', email: null } as Return['customer'],
  },
  {
    id: 'ret-demo-5', brand_id: 'brand-1', order_id: 'ord-demo-5', customer_id: 'cust-5',
    return_reason: 'size_issue', customer_comment: 'Size runs too small',
    status: 'COMPLETED', denial_reason: null, return_condition: 'GOOD',
    return_eligible_for_resale: true, return_window_days: 30,
    return_initiation_date: new Date(Date.now() - 20 * 86400000).toISOString(),
    return_approved_date: new Date(Date.now() - 18 * 86400000).toISOString(),
    return_approved_by: 'ops@xmetrics.app', return_approval_notes: 'Good condition, restocked',
    shiprocket_awb_number: 'SR1122334455003', shiprocket_order_id: 'SR-ORD-003', shiprocket_label_url: '#',
    shiprocket_error: null,
    expected_return_delivery: new Date(Date.now() - 12 * 86400000).toISOString(),
    actual_return_received_date: new Date(Date.now() - 13 * 86400000).toISOString(),
    refund_amount: 1299, refund_method: 'RAZORPAY',
    razorpay_refund_id: 'rfnd_demo_abc123', cod_refund_status: null,
    inventory_updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    order: { id: 'ord-demo-5', order_number: '#XM-1010' } as Return['order'],
    customer: { id: 'cust-5', name: 'Deepa Singh', phone: '7654321098', email: 'deepa@example.com' } as Return['customer'],
  },
]

// ── KPI row ───────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub }: {
  label: string; value: string | number; sub?: string;
  icon?: React.ReactNode; color?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const RETURN_STATUS_DOTS: Record<string, { dot: string; text: string }> = {
  PENDING_APPROVAL:  { dot: 'bg-amber-400',  text: 'text-amber-600' },
  APPROVED:          { dot: 'bg-blue-400',   text: 'text-blue-600' },
  LABEL_GENERATED:   { dot: 'bg-sky-400',    text: 'text-sky-600' },
  IN_TRANSIT:        { dot: 'bg-violet-400', text: 'text-violet-600' },
  RECEIVED:          { dot: 'bg-indigo-400', text: 'text-indigo-600' },
  REFUND_INITIATED:  { dot: 'bg-purple-400', text: 'text-purple-600' },
  COMPLETED:         { dot: 'bg-green-400',  text: 'text-green-600' },
  AUTO_DENIED:       { dot: 'bg-red-400',    text: 'text-red-500' },
  LOST:              { dot: 'bg-gray-300',   text: 'text-gray-400' },
}

function StatusBadge({ status }: { status: ReturnStatus }) {
  const cfg = RETURN_STATUS_CONFIG[status]
  const d = RETURN_STATUS_DOTS[status] ?? { dot: 'bg-gray-300', text: 'text-gray-400' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.dot}`} />
      <span className={`text-[11px] font-medium ${d.text}`}>{cfg?.label ?? status}</span>
    </span>
  )
}

// ── Approve-refund modal ──────────────────────────────────────────────────────

function ApproveRefundModal({
  ret, onClose, onDone,
}: { ret: Return; onClose: () => void; onDone: (updated: Partial<Return>) => void }) {
  const [condition, setCondition] = useState<ReturnCondition>('GOOD')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const isGood = condition === 'GOOD'
  const refundAmt = ret.refund_amount ?? 0
  const actualRefund = isGood ? refundAmt : Math.round(refundAmt * 0.5 * 100) / 100

  const handle = async () => {
    setLoading(true)
    try {
      const result = await approveReturnRefund(ret.id, condition, notes || undefined)
      if (!result.ok) throw new Error(result.error ?? 'Refund failed')
      showToast.success(`₹${result.refund_amount?.toFixed(2)} refund initiated`)
      onDone({ status: 'REFUND_INITIATED', return_condition: condition, refund_amount: result.refund_amount ?? undefined })
      onClose()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Refund failed')
    } finally {
      setLoading(false)
    }
  }

  const conditions: ReturnCondition[] = ['GOOD', 'DAMAGED', 'DEFECTIVE']

  return (
    <Modal open onClose={onClose} title="Process Return Refund" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
          <p className="font-medium text-gray-700">
            Order {(ret.order as { order_number?: string })?.order_number ?? ret.order_id}
          </p>
          <p className="text-gray-500">
            Reason: {RETURN_REASON_LABELS[ret.return_reason]}
          </p>
          {ret.shiprocket_awb_number && (
            <p className="text-gray-500">AWB: {ret.shiprocket_awb_number}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Item condition received</label>
          <div className="grid grid-cols-3 gap-2">
            {conditions.map(c => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  condition === c
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {RETURN_CONDITION_LABELS[c].split(' /')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className={`p-3 rounded-lg border text-sm ${
          isGood ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <p className="font-medium">
            {isGood ? 'Full refund' : '50% partial refund'} — ₹{actualRefund.toFixed(2)}
          </p>
          <p className="text-xs mt-0.5 opacity-75">
            {isGood ? 'Item resellable, inventory restocked' : 'Damaged/defective — partial refund policy applies'}
          </p>
        </div>

        {ret.refund_method === 'COD_REVERSAL' && (
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-700">
            COD order — exception will be created for manual bank transfer / UPI refund
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 resize-none"
            placeholder="Inspection notes…"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1" onClick={handle} disabled={loading}>
            {loading ? 'Processing…' : `Issue ₹${actualRefund.toFixed(2)} Refund`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Initiate return modal ─────────────────────────────────────────────────────

function InitiateReturnModal({ onClose, onDone }: { onClose: () => void; onDone: (ret: Return) => void }) {
  const { orders } = useAppStore()
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState<ReturnReason>('damaged')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const deliveredOrders = orders.filter(o => o.fulfillment_status === 'DELIVERED')

  const handle = async () => {
    if (!orderId) { showToast.error('Select an order'); return }
    setLoading(true)
    try {
      const result = await initiateReturn(orderId, reason, comment || undefined)
      if (!result.eligible) {
        showToast.error(result.denial_reason ?? 'Not eligible for return')
        return
      }
      showToast.success(result.message ?? 'Return created')
      if (result.return_id) {
        const now = new Date().toISOString()
        const order = orders.find(o => o.id === orderId)
        const fake: Return = {
          id: result.return_id, brand_id: '', order_id: orderId, customer_id: order?.customer_id ?? '',
          return_reason: reason, customer_comment: comment || null,
          status: 'PENDING_APPROVAL', denial_reason: null, return_condition: null,
          return_eligible_for_resale: false, return_window_days: 30,
          return_initiation_date: now, return_approved_date: null,
          return_approved_by: null, return_approval_notes: null,
          shiprocket_awb_number: null, shiprocket_order_id: null, shiprocket_label_url: null, shiprocket_error: null,
          expected_return_delivery: null, actual_return_received_date: null,
          refund_amount: result.refund_amount ?? null, refund_method: (result.refund_method as Return['refund_method']) ?? null,
          razorpay_refund_id: null, cod_refund_status: null, inventory_updated_at: null,
          created_at: now, updated_at: now,
          order: order ? { id: order.id, order_number: order.order_number } as Return['order'] : undefined,
          customer: order?.customer,
        }
        onDone(fake)
      }
      onClose()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const reasons: ReturnReason[] = ['damaged', 'wrong_item', 'changed_mind', 'defective', 'size_issue']

  return (
    <Modal open onClose={onClose} title="Initiate Return">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
          <select
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          >
            <option value="">Select delivered order…</option>
            {deliveredOrders.map(o => (
              <option key={o.id} value={o.id}>
                {o.order_number} — {o.customer?.name ?? 'Unknown'} — ₹{(o.gross_amount - o.discount_amount).toFixed(0)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Return reason</label>
          <div className="space-y-1.5">
            {reasons.map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-brand-600" />
                <span className="text-sm text-gray-700">{RETURN_REASON_LABELS[r]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Customer comment (optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 resize-none"
            placeholder="Customer's description of the issue…"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1" onClick={handle} disabled={loading || !orderId}>
            {loading ? 'Submitting…' : 'Create Return'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All status' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'LABEL_GENERATED', label: 'Label Generated' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'REFUND_INITIATED', label: 'Refund Sent' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'LOST', label: 'Lost' },
]

export default function Returns() {
  const { currentBrand } = useAppStore()
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refundModal, setRefundModal] = useState<Return | null>(null)
  const [initiateModal, setInitiateModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 400))
        setReturns(DEMO_RETURNS)
      } else {
        const data = await fetchReturns(currentBrand?.id ?? '')
        setReturns(data)
      }
    } finally {
      setLoading(false)
    }
  }, [currentBrand?.id])

  useEffect(() => { load() }, [load])

  const filtered = returns.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const orderNum = (r.order as { order_number?: string } | undefined)?.order_number ?? ''
      const custName = (r.customer as { name?: string } | undefined)?.name ?? ''
      if (!orderNum.toLowerCase().includes(q) && !custName.toLowerCase().includes(q)) return false
    }
    return true
  })

  // KPI counts
  const pendingCount  = returns.filter(r => r.status === 'PENDING_APPROVAL').length
  const activeCount   = returns.filter(r => ['APPROVED','LABEL_GENERATED','IN_TRANSIT'].includes(r.status)).length
  const receivedCount = returns.filter(r => r.status === 'RECEIVED').length
  const totalRefund   = returns
    .filter(r => ['REFUND_INITIATED','COMPLETED'].includes(r.status))
    .reduce((sum, r) => sum + (r.refund_amount ?? 0), 0)

  const handleApprove = async (ret: Return) => {
    setActionLoading(ret.id)
    try {
      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 600))
        setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'APPROVED' } : r))
        showToast.success('Return approved — generate label next')
        return
      }
      // In live mode: update DB directly via supabase client
      const { supabase } = await import('../../lib/supabase')
      if (!supabase) throw new Error('Not connected')
      const { error } = await supabase.from('returns').update({
        status: 'APPROVED',
        return_approved_date: new Date().toISOString(),
      }).eq('id', ret.id)
      if (error) throw error
      setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'APPROVED' } : r))
      showToast.success('Return approved — generate label next')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateLabel = async (ret: Return) => {
    setActionLoading(ret.id)
    try {
      const result = await generateReturnLabel(ret.id)
      if (!result.ok) throw new Error(result.error ?? 'Label generation failed')
      setReturns(prev => prev.map(r =>
        r.id === ret.id
          ? { ...r, status: 'LABEL_GENERATED', shiprocket_awb_number: result.awb_number ?? null, shiprocket_label_url: result.label_url ?? null }
          : r
      ))
      showToast.success(result.message ?? `Label generated. AWB: ${result.awb_number}`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (ret: Return) => {
    setActionLoading(`deny-${ret.id}`)
    try {
      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 400))
        setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'AUTO_DENIED' } : r))
        showToast.success('Return denied')
        return
      }
      const { supabase } = await import('../../lib/supabase')
      if (!supabase) throw new Error('Not connected')
      const { error } = await supabase.from('returns').update({
        status: 'AUTO_DENIED',
        denial_reason: 'Denied by ops',
      }).eq('id', ret.id)
      if (error) throw error
      setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'AUTO_DENIED' } : r))
      showToast.success('Return denied')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkComplete = async (ret: Return) => {
    setActionLoading(ret.id)
    try {
      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 400))
        setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'COMPLETED' } : r))
        showToast.success('Return marked complete')
        return
      }
      const { supabase } = await import('../../lib/supabase')
      if (!supabase) throw new Error('Not connected')
      await supabase.from('returns').update({ status: 'COMPLETED' }).eq('id', ret.id)
      setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'COMPLETED' } : r))
      showToast.success('Return marked complete')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage return requests, labels, and refunds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => setInitiateModal(true)}>
            <RotateCcw size={14} />
            New Return
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Pending Approval"
          value={pendingCount}
          sub="awaiting ops review"
        />
        <KPICard
          label="Active Returns"
          value={activeCount}
          sub="approved or in transit"
        />
        <KPICard
          label="Awaiting Inspection"
          value={receivedCount}
          sub="received at warehouse"
        />
        <KPICard
          label="Refunds Issued"
          value={`₹${totalRefund.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub="completed + initiated"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Order # or customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30 cursor-pointer"
          >
            {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {(search || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('') }}>
            <X size={12} /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500 mt-3">Loading returns…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No returns found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || filterStatus ? 'Try clearing filters' : 'Returns will appear here once initiated'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Order</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">AWB</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Refund</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(ret => {
                  const orderNum = (ret.order as { order_number?: string } | undefined)?.order_number ?? ret.order_id.slice(0, 8)
                  const custName = (ret.customer as { name?: string } | undefined)?.name ?? '—'
                  const isActing = actionLoading === ret.id || actionLoading === `deny-${ret.id}`

                  return (
                    <tr key={ret.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Order */}
                      <td className="px-4 py-3">
                        <Link
                          to={`/orders/${ret.order_id}`}
                          className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          {orderNum}
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{custName}</span>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3">
                        <span className="text-gray-600">{RETURN_REASON_LABELS[ret.return_reason]}</span>
                        {ret.customer_comment && (
                          <p className="text-xs text-gray-400 truncate max-w-[140px]" title={ret.customer_comment}>
                            "{ret.customer_comment}"
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={ret.status} />
                      </td>

                      {/* AWB */}
                      <td className="px-4 py-3">
                        {ret.shiprocket_awb_number ? (
                          <div>
                            <span className="text-xs font-mono text-gray-600">{ret.shiprocket_awb_number}</span>
                            {ret.shiprocket_label_url && ret.shiprocket_label_url !== '#' && (
                              <a
                                href={ret.shiprocket_label_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs text-brand-600 hover:underline"
                              >
                                View label
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Refund */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {ret.refund_amount ? `₹${ret.refund_amount.toLocaleString('en-IN')}` : '—'}
                        </span>
                        {ret.refund_method && (
                          <p className="text-xs text-gray-400">
                            {ret.refund_method === 'COD_REVERSAL' ? 'COD' : 'Razorpay'}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(ret.created_at)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <ActionCell
                          ret={ret}
                          isActing={isActing}
                          onApprove={() => handleApprove(ret)}
                          onDeny={() => handleDeny(ret)}
                          onGenerateLabel={() => handleGenerateLabel(ret)}
                          onProcessRefund={() => setRefundModal(ret)}
                          onMarkComplete={() => handleMarkComplete(ret)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      {refundModal && (
        <ApproveRefundModal
          ret={refundModal}
          onClose={() => setRefundModal(null)}
          onDone={updates => setReturns(prev => prev.map(r => r.id === refundModal.id ? { ...r, ...updates } : r))}
        />
      )}

      {initiateModal && (
        <InitiateReturnModal
          onClose={() => setInitiateModal(false)}
          onDone={ret => setReturns(prev => [ret, ...prev])}
        />
      )}
    </div>
  )
}

// ── Action cell — shows contextual button(s) per status ───────────────────────

function ActionCell({
  ret, isActing, onApprove, onDeny, onGenerateLabel, onProcessRefund, onMarkComplete,
}: {
  ret: Return; isActing: boolean
  onApprove: () => void; onDeny: () => void; onGenerateLabel: () => void
  onProcessRefund: () => void; onMarkComplete: () => void
}) {
  if (ret.status === 'PENDING_APPROVAL') {
    return (
      <div className="flex gap-1.5 justify-end">
        <Button size="sm" onClick={onApprove} disabled={isActing}>
          {isActing ? '…' : 'Approve'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDeny} disabled={isActing} className="text-red-600 hover:text-red-700">
          <XCircle size={13} />
        </Button>
      </div>
    )
  }
  if (ret.status === 'APPROVED') {
    return (
      <Button size="sm" onClick={onGenerateLabel} disabled={isActing}>
        <Truck size={12} />
        {isActing ? 'Generating…' : 'Gen. Label'}
      </Button>
    )
  }
  if (ret.status === 'RECEIVED') {
    return (
      <Button size="sm" onClick={onProcessRefund}>
        <CheckCircle2 size={12} />
        Process Refund
      </Button>
    )
  }
  if (ret.status === 'REFUND_INITIATED') {
    return (
      <Button size="sm" variant="ghost" onClick={onMarkComplete} disabled={isActing}>
        {isActing ? '…' : 'Mark Complete'}
      </Button>
    )
  }
  return <span className="text-xs text-gray-300">—</span>
}
