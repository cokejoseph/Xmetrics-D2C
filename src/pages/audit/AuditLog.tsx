import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ExternalLink, ArrowRight, Download } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card } from '../../components/ui'
import { DEMO_MODE } from '../../lib/supabase'
import { getAuditLog } from '../../lib/db'
import { exportCSV } from '../../lib/exportCSV'
import type { ApprovalAuditLog, AuditActionType, Order, Return, Integration } from '../../types'

// ─── Action metadata ─────────────────────────────────────────────────────────

const ACTION_LABEL: Record<AuditActionType, string> = {
  AUTO_APPROVED: 'Auto Approved',
  MANUALLY_APPROVED: 'Manually Approved',
  APPROVED_HIGH_RTO: 'Approved — High RTO',
  APPROVED_INVALID_ADDRESS: 'Approved — Invalid Address',
  APPROVED_LOW_INVENTORY: 'Approved — Low Inventory',
  APPROVED_PAYMENT_MISMATCH: 'Approved — Payment Mismatch',
  ADDRESS_CORRECTED_AND_APPROVED: 'Address Corrected & Approved',
  HELD: 'Order Held',
  RELEASED_FROM_HOLD: 'Released from Hold',
  ORDER_CANCELLED: 'Order Cancelled',
  PUSHED_TO_OMS: 'Pushed to OMS',
  AUTO_PUSHED_TO_OMS: 'Auto-pushed to OMS',
  RETURN_APPROVED: 'Return Approved',
  RETURN_REFUNDED: 'Refund Issued',
  INTEGRATION_CONNECTED: 'Integration Connected',
  INTEGRATION_DISCONNECTED: 'Integration Disconnected',
  SETTINGS_UPDATED: 'Settings Updated',
  DATA_EXPORTED: 'Data Exported',
}

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'

function actionBadgeVariant(type: AuditActionType): BadgeVariant {
  if (type === 'HELD') return 'amber'
  if (type === 'ORDER_CANCELLED') return 'red'
  if (type === 'RELEASED_FROM_HOLD') return 'gray'
  if (type === 'PUSHED_TO_OMS' || type === 'AUTO_PUSHED_TO_OMS') return 'blue'
  if (type === 'RETURN_APPROVED' || type === 'RETURN_REFUNDED') return 'purple'
  if (type === 'INTEGRATION_CONNECTED') return 'blue'
  if (type === 'INTEGRATION_DISCONNECTED') return 'amber'
  if (type === 'SETTINGS_UPDATED' || type === 'DATA_EXPORTED') return 'gray'
  return 'green'
}

type FilterGroup = 'all' | 'approvals' | 'holds' | 'pushes' | 'returns' | 'system'

const SYSTEM_ACTIONS: AuditActionType[] = [
  'INTEGRATION_CONNECTED', 'INTEGRATION_DISCONNECTED', 'SETTINGS_UPDATED', 'DATA_EXPORTED',
]

function matchesFilter(action: AuditActionType, filter: FilterGroup): boolean {
  if (filter === 'all') return true
  if (filter === 'approvals') {
    return action === 'AUTO_APPROVED' || action === 'MANUALLY_APPROVED' ||
      action.startsWith('APPROVED') || action === 'ADDRESS_CORRECTED_AND_APPROVED'
  }
  if (filter === 'holds') return action === 'HELD' || action === 'RELEASED_FROM_HOLD'
  if (filter === 'pushes') return action === 'PUSHED_TO_OMS' || action === 'AUTO_PUSHED_TO_OMS'
  if (filter === 'returns') return action === 'RETURN_APPROVED' || action === 'RETURN_REFUNDED'
  if (filter === 'system') return SYSTEM_ACTIONS.includes(action)
  return true
}

// ─── Demo data generation ─────────────────────────────────────────────────────

const DEMO_ACTORS = ['Rohit (Founder)', 'Priya (Ops)', 'Rahul (Support)']
const DEMO_REASONS_APPROVAL = [
  'Risk accepted by founder',
  'Customer verified via phone call',
  'Repeat customer — trusted',
  'Prepaid order — payment collected',
]
const DEMO_REASONS_HOLD = [
  'High RTO risk — awaiting customer callback',
  'Address unverifiable — needs manual check',
  'Payment mismatch under investigation',
]

function generateDemoAuditLog(
  orders: Order[],
  returns: Return[],
  integrations: Integration[],
  brandId: string,
): ApprovalAuditLog[] {
  const entries: ApprovalAuditLog[] = []
  const orderById = new Map(orders.map(o => [o.id, o]))

  for (const order of orders) {
    const actor = DEMO_ACTORS[order.id.charCodeAt(order.id.length - 1) % DEMO_ACTORS.length]
    const base = new Date(order.created_at).getTime()

    if (order.rto_review_status === 'APPROVED') {
      const actionType: AuditActionType = order.rto_risk_score >= 60
        ? 'APPROVED_HIGH_RTO'
        : order.rto_risk_score < 50
          ? 'AUTO_APPROVED'
          : 'MANUALLY_APPROVED'
      entries.push({
        id: `demo-${order.id}-approved`,
        brand_id: brandId,
        order_id: order.id,
        order_number: order.order_number,
        exception_id: null,
        action_type: actionType,
        actor_id: actionType === 'AUTO_APPROVED' ? null : 'demo-user',
        actor_name: actionType === 'AUTO_APPROVED' ? 'Auto-approve' : actor,
        actor_role: actionType === 'AUTO_APPROVED' ? null : 'EDITOR',
        action_timestamp: new Date(base + 2 * 3600 * 1000).toISOString(),
        original_rto_score: order.rto_risk_score,
        new_rto_score: order.rto_risk_score,
        original_status: 'PENDING',
        new_status: 'APPROVED',
        reason: actionType === 'AUTO_APPROVED'
          ? 'GREEN routing — auto-approve rule'
          : DEMO_REASONS_APPROVAL[order.id.charCodeAt(0) % DEMO_REASONS_APPROVAL.length],
        notes: null,
        metadata: {},
      })
    }

    if (order.rto_review_status === 'HELD') {
      entries.push({
        id: `demo-${order.id}-held`,
        brand_id: brandId,
        order_id: order.id,
        order_number: order.order_number,
        exception_id: null,
        action_type: 'HELD',
        actor_id: 'demo-user',
        actor_name: actor,
        actor_role: 'EDITOR',
        action_timestamp: new Date(base + 1 * 3600 * 1000).toISOString(),
        original_rto_score: order.rto_risk_score,
        new_rto_score: order.rto_risk_score,
        original_status: 'PENDING',
        new_status: 'HELD',
        reason: DEMO_REASONS_HOLD[order.id.charCodeAt(1) % DEMO_REASONS_HOLD.length],
        notes: null,
        metadata: {},
      })
    }

    if (order.oms_push_status === 'PUSHED') {
      entries.push({
        id: `demo-${order.id}-pushed`,
        brand_id: brandId,
        order_id: order.id,
        order_number: order.order_number,
        exception_id: null,
        action_type: order.rto_risk_score < 50 ? 'AUTO_PUSHED_TO_OMS' : 'PUSHED_TO_OMS',
        actor_id: order.rto_risk_score < 50 ? null : 'demo-user',
        actor_name: order.rto_risk_score < 50 ? 'Auto-push' : actor,
        actor_role: order.rto_risk_score < 50 ? null : 'EDITOR',
        action_timestamp: new Date(base + 3 * 3600 * 1000).toISOString(),
        original_rto_score: order.rto_risk_score,
        new_rto_score: order.rto_risk_score,
        original_status: 'APPROVED',
        new_status: 'PUSHED',
        reason: order.rto_risk_score < 50 ? 'GREEN — auto-push rule' : 'Manual push by founder',
        notes: null,
        metadata: {},
      })
    }

    if (order.fulfillment_status === 'CANCELLED') {
      entries.push({
        id: `demo-${order.id}-cancelled`,
        brand_id: brandId,
        order_id: order.id,
        order_number: order.order_number,
        exception_id: null,
        action_type: 'ORDER_CANCELLED',
        actor_id: 'demo-user',
        actor_name: actor,
        actor_role: 'EDITOR',
        action_timestamp: new Date(base + 4 * 3600 * 1000).toISOString(),
        original_rto_score: order.rto_risk_score,
        new_rto_score: order.rto_risk_score,
        original_status: 'CONFIRMED',
        new_status: 'CANCELLED',
        reason: 'Cancelled — customer unreachable for COD confirmation',
        notes: null,
        metadata: {},
      })
    }
  }

  // ── Returns: approval + refund trail ────────────────────────────────────────
  for (const ret of returns) {
    const order = orderById.get(ret.order_id)
    const orderNumber = order?.order_number ?? ret.order_id
    const actor = DEMO_ACTORS[ret.id.charCodeAt(ret.id.length - 1) % DEMO_ACTORS.length]
    const initiated = new Date(ret.return_initiation_date).getTime()

    const PAST_APPROVAL: Return['status'][] = ['APPROVED', 'LABEL_GENERATED', 'IN_TRANSIT', 'RECEIVED', 'REFUND_INITIATED', 'COMPLETED']
    if (ret.return_approved_date || PAST_APPROVAL.includes(ret.status)) {
      entries.push({
        id: `demo-${ret.id}-return-approved`,
        brand_id: brandId,
        order_id: ret.order_id,
        order_number: orderNumber,
        exception_id: null,
        action_type: 'RETURN_APPROVED',
        actor_id: 'demo-user',
        actor_name: ret.return_approved_by ?? actor,
        actor_role: 'EDITOR',
        action_timestamp: new Date(ret.return_approved_date ?? new Date(initiated + 6 * 3600 * 1000).toISOString()).toISOString(),
        original_rto_score: null,
        new_rto_score: null,
        original_status: 'RETURN_REQUESTED',
        new_status: 'RETURN_APPROVED',
        reason: ret.return_approval_notes ?? `Return approved — ${ret.return_reason.replace(/_/g, ' ').toLowerCase()}`,
        notes: ret.customer_comment,
        metadata: { return_id: ret.id },
      })
    }

    if ((ret.status === 'REFUND_INITIATED' || ret.status === 'COMPLETED') && ret.refund_amount) {
      entries.push({
        id: `demo-${ret.id}-refunded`,
        brand_id: brandId,
        order_id: ret.order_id,
        order_number: orderNumber,
        exception_id: null,
        action_type: 'RETURN_REFUNDED',
        actor_id: 'demo-user',
        actor_name: ret.return_approved_by ?? actor,
        actor_role: 'EDITOR',
        action_timestamp: new Date(initiated + 48 * 3600 * 1000).toISOString(),
        original_rto_score: null,
        new_rto_score: null,
        original_status: 'RETURN_APPROVED',
        new_status: 'REFUNDED',
        reason: `Refund of ₹${Math.round(ret.refund_amount).toLocaleString('en-IN')} issued to customer`,
        notes: null,
        metadata: { return_id: ret.id, refund_amount: ret.refund_amount },
      })
    }
  }

  // ── Integrations: connection events ─────────────────────────────────────────
  for (const integration of integrations) {
    if (integration.status !== 'CONNECTED') continue
    const ts = integration.last_sync_at ?? integration.created_at ?? new Date().toISOString()
    entries.push({
      id: `demo-int-${integration.id}-connected`,
      brand_id: brandId,
      order_id: '',
      order_number: '—',
      exception_id: null,
      action_type: 'INTEGRATION_CONNECTED',
      actor_id: 'demo-user',
      actor_name: 'Rohit (Founder)',
      actor_role: 'OWNER',
      action_timestamp: ts,
      original_rto_score: null,
      new_rto_score: null,
      original_status: 'DISCONNECTED',
      new_status: 'CONNECTED',
      reason: `${integration.platform} integration connected`,
      notes: null,
      metadata: { platform: integration.platform },
    })
  }

  return entries.sort((a, b) => b.action_timestamp.localeCompare(a.action_timestamp))
}

// ─── Badge component ──────────────────────────────────────────────────────────

function ActionBadge({ type }: { type: AuditActionType }) {
  const variant = actionBadgeVariant(type)
  const cls: Record<BadgeVariant, string> = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    red:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    blue:  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    gray:  'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400',
    purple:'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls[variant]}`}>
      {ACTION_LABEL[type]}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditLog() {
  useEffect(() => { document.title = 'Audit Log · Xmetrics' }, [])
  const { orders, returns, integrations, currentBrand } = useAppStore()
  const [entries, setEntries] = useState<ApprovalAuditLog[]>([])
  const [loading, setLoading] = useState(!DEMO_MODE)
  const [filter, setFilter] = useState<FilterGroup>('all')

  useEffect(() => {
    if (DEMO_MODE) {
      setEntries(generateDemoAuditLog(orders, returns, integrations, currentBrand?.id ?? 'demo'))
      return
    }
    if (!currentBrand?.id) return
    setLoading(true)
    getAuditLog(currentBrand.id, undefined, 100)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [orders, returns, integrations, currentBrand?.id])

  const filtered = useMemo(
    () => entries.filter(e => matchesFilter(e.action_type, filter)),
    [entries, filter]
  )

  const counts = useMemo(() => ({
    all: entries.length,
    approvals: entries.filter(e => matchesFilter(e.action_type, 'approvals')).length,
    holds: entries.filter(e => matchesFilter(e.action_type, 'holds')).length,
    pushes: entries.filter(e => matchesFilter(e.action_type, 'pushes')).length,
    returns: entries.filter(e => matchesFilter(e.action_type, 'returns')).length,
    system: entries.filter(e => matchesFilter(e.action_type, 'system')).length,
  }), [entries])

  const FILTERS: { key: FilterGroup; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'approvals', label: `Approvals (${counts.approvals})` },
    { key: 'holds',     label: `Holds (${counts.holds})` },
    { key: 'pushes',    label: `OMS Pushes (${counts.pushes})` },
    ...(counts.returns > 0 ? [{ key: 'returns' as const, label: `Returns (${counts.returns})` }] : []),
    ...(counts.system > 0 ? [{ key: 'system' as const, label: `System (${counts.system})` }] : []),
  ]

  // Export the current (filtered) view as CSV. The export itself is an auditable
  // action — recorded in the trail in live mode via insertAuditLog.
  const handleExport = () => {
    exportCSV(
      `xmetrics-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Order', 'Action', 'Actor', 'Role', 'RTO Score', 'From', 'To', 'Reason', 'Notes'],
      filtered.map(e => [
        new Date(e.action_timestamp).toLocaleString('en-IN'),
        e.order_number,
        ACTION_LABEL[e.action_type],
        e.actor_name ?? '',
        e.actor_role ?? '',
        e.original_rto_score ?? '',
        e.original_status ?? '',
        e.new_status ?? '',
        e.reason ?? '',
        e.notes ?? '',
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Immutable record of approvals, holds, OMS pushes, returns, refunds, and system changes</p>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList size={28} className="text-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-500">No audit entries</p>
              <p className="text-xs text-gray-400 mt-1">Approvals and OMS pushes will appear here</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Actor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">RTO Score</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Reason</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-8" />
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {filtered.map(entry => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-50 dark:border-white/[0.04] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {new Date(entry.action_timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(entry.action_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {entry.order_id ? (
                        <Link
                          to={`/orders/${entry.order_id}`}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {entry.order_number}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">{entry.order_number}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <ActionBadge type={entry.action_type} />
                      {entry.original_status && entry.new_status && entry.original_status !== entry.new_status && (
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          {entry.original_status} <ArrowRight size={9} /> {entry.new_status}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-700 dark:text-gray-300">{entry.actor_name ?? '—'}</p>
                      {entry.actor_role && (
                        <p className="text-[10px] text-gray-400">{entry.actor_role}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden lg:table-cell">
                      {entry.original_rto_score != null ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold tabular-nums ${
                            entry.original_rto_score >= 60 ? 'text-red-600 dark:text-red-400' :
                            entry.original_rto_score >= 50 ? 'text-amber-600 dark:text-amber-400' :
                            'text-green-600 dark:text-green-400'
                          }`}>
                            {entry.original_rto_score}
                          </span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            entry.original_rto_score >= 60
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              : entry.original_rto_score >= 50
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                          }`}>
                            {entry.original_rto_score >= 60 ? 'RED' : entry.original_rto_score >= 50 ? 'YLW' : 'GRN'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden xl:table-cell max-w-[240px]">
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={entry.reason ?? ''}>
                        {entry.reason ?? '—'}
                      </p>
                      {entry.notes && (
                        <p className="text-[10px] text-gray-400 truncate italic mt-0.5" title={entry.notes}>
                          {entry.notes}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {entry.order_id && (
                        <Link
                          to={`/orders/${entry.order_id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-brand-600"
                          title="View order"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.05] text-xs text-gray-500">
              {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
              {filter !== 'all' && ` · filtered from ${entries.length} total`}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
