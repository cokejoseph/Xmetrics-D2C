import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, ExternalLink, CheckCircle, Lock } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Modal } from '../../components/ui'
import { SeverityBadge } from '../../components/shared/StatusBadge'
import { showToast } from '../../lib/toast'
import type { Exception, ExceptionStatus } from '../../types'

const TYPE_LABELS: Record<string, string> = {
  HIGH_RTO_RISK: 'High RTO Risk',
  FAILED_PAYMENT: 'Failed Payment',
  STUCK_SHIPMENT: 'Stuck Shipment',
  RTO_INITIATED: 'RTO Initiated',
  LOW_INVENTORY: 'Low Inventory',
  PENDING_SETTLEMENT: 'Pending Settlement',
  FAILED_WEBHOOK: 'Failed Webhook',
  ADDRESS_ISSUE: 'Address Issue',
  PAYMENT_MISMATCH: 'Payment Mismatch',
}

const APPROVE_REASONS: Record<string, string[]> = {
  HIGH_RTO_RISK: [
    'Risk accepted by founder',
    'Customer verified via phone call',
    'Repeat customer — trusted',
    'Prepaid order — payment collected',
    'Other',
  ],
  ADDRESS_ISSUE: [
    'Address verified manually',
    'Customer confirmed address via WhatsApp',
    'Minor formatting issue — address is valid',
    'Other',
  ],
  LOW_INVENTORY: [
    'Stock confirmed in warehouse',
    'Sourcing alternate SKU',
    'Customer notified — proceeding anyway',
    'Other',
  ],
  PAYMENT_MISMATCH: [
    'Difference within acceptable tolerance',
    'Customer will pay balance on delivery',
    'Rounding error — not material',
    'Other',
  ],
}

const DEFAULT_REASONS = ['Issue resolved', 'Manually verified', 'Other']

// ─── Approve Modal ──────────────────────────────────────────────────────────

function ApproveModal({
  exception,
  onClose,
  onApprove,
}: {
  exception: Exception
  onClose: () => void
  onApprove: (reason: string, notes?: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reasons = APPROVE_REASONS[exception.type] ?? DEFAULT_REASONS

  const handleSubmit = async () => {
    if (!reason) return
    setSubmitting(true)
    await onApprove(reason, notes || undefined)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal open onClose={submitting ? () => {} : onClose} title="Approve & Push to OMS">
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
          <SeverityBadge severity={exception.severity} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{exception.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{exception.description}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Reason for approval *</label>
          <div className="space-y-2">
            {reasons.map(r => (
              <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="approve-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-brand-600 w-3.5 h-3.5 shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {r}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="w-full border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional context for the audit log…"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? 'Pushing to OMS…' : 'Approve & Push'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Exception Card ─────────────────────────────────────────────────────────

function ExceptionCard({
  exception,
  onResolve,
  onDismiss,
  onHoldOrder,
  onApproveAndPush,
}: {
  exception: Exception
  onResolve?: () => void
  onDismiss?: () => void
  onHoldOrder?: () => void
  onApproveAndPush?: (reason: string, notes?: string) => Promise<void>
}) {
  const [showApproveModal, setShowApproveModal] = useState(false)
  const isResolved = exception.status === 'RESOLVED' || exception.status === 'DISMISSED'
  const hasOrder = !!exception.order_id

  const renderActions = () => {
    if (isResolved) {
      return <span className="text-xs text-gray-400 font-medium shrink-0">{exception.status}</span>
    }

    // OMS-aware exceptions: type-specific actions
    if (exception.type === 'HIGH_RTO_RISK') {
      return (
        <div className="flex gap-2 shrink-0 flex-wrap">
          {hasOrder && onApproveAndPush && (
            <Button
              size="sm"
              onClick={() => setShowApproveModal(true)}
              className="whitespace-nowrap"
            >
              Approve Anyway
            </Button>
          )}
          {hasOrder && onHoldOrder && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onHoldOrder}
              className="text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Hold Order
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} className="text-gray-500">
            Dismiss
          </Button>
        </div>
      )
    }

    if (exception.type === 'ADDRESS_ISSUE') {
      return (
        <div className="flex gap-2 shrink-0 flex-wrap">
          {hasOrder && onApproveAndPush && (
            <Button
              size="sm"
              onClick={() => setShowApproveModal(true)}
              className="whitespace-nowrap"
            >
              Approve Anyway
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} className="text-gray-500">
            Dismiss
          </Button>
        </div>
      )
    }

    if (exception.type === 'LOW_INVENTORY') {
      return (
        <div className="flex gap-2 shrink-0 flex-wrap">
          {hasOrder && onApproveAndPush && (
            <Button
              size="sm"
              onClick={() => setShowApproveModal(true)}
              className="whitespace-nowrap"
            >
              Approve Anyway
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} className="text-gray-500">
            Dismiss
          </Button>
        </div>
      )
    }

    if (exception.type === 'FAILED_PAYMENT') {
      return (
        <div className="flex gap-2 shrink-0 flex-wrap">
          {hasOrder && onApproveAndPush && (
            <Button size="sm" onClick={() => setShowApproveModal(true)}>
              Approve
            </Button>
          )}
          {hasOrder && onHoldOrder && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onHoldOrder}
              className="text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Hold Order
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onResolve} className="text-gray-500">
            Mark Resolved
          </Button>
        </div>
      )
    }

    // Generic fallback (STUCK_SHIPMENT, FAILED_WEBHOOK, etc.)
    return (
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          aria-label="Resolve exception"
          className="text-green-700 dark:text-green-400 border-green-100 dark:border-green-800/50 hover:bg-green-50 dark:hover:bg-green-900/20"
          onClick={onResolve}
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Dismiss exception"
          onClick={onDismiss}
          className="text-gray-500 dark:text-gray-400"
        >
          Dismiss
        </Button>
      </div>
    )
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
            <SeverityBadge severity={exception.severity} />
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {TYPE_LABELS[exception.type] ?? exception.type}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{exception.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{exception.description}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {exception.order_id && (
                <Link
                  to={`/orders/${exception.order_id}`}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  View Order <ExternalLink size={10} />
                </Link>
              )}
              <span className="text-xs text-gray-400">
                {new Date(exception.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {renderActions()}
        </div>
      </Card>

      {showApproveModal && onApproveAndPush && (
        <ApproveModal
          exception={exception}
          onClose={() => setShowApproveModal(false)}
          onApprove={onApproveAndPush}
        />
      )}
    </>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Exceptions() {
  useEffect(() => { document.title = 'Exceptions · Xmetrics' }, [])
  const {
    exceptions,
    resolveException, dismissException, restoreException,
    holdOrder, approveExceptionAndPush,
  } = useAppStore()

  const unresolved = exceptions.filter(e => e.status === 'UNRESOLVED' || e.status === 'IN_PROGRESS')
  const resolved = exceptions.filter(e => e.status === 'RESOLVED' || e.status === 'DISMISSED')

  const criticalCount = unresolved.filter(e => e.severity === 'CRITICAL').length
  const omsBlockedCount = unresolved.filter(e =>
    e.type === 'HIGH_RTO_RISK' || e.type === 'ADDRESS_ISSUE' ||
    e.type === 'LOW_INVENTORY' || e.type === 'FAILED_PAYMENT'
  ).length

  const handleApproveAndPush = async (exc: Exception, reason: string, notes?: string) => {
    if (!exc.order_id) return
    const { ok, error } = await approveExceptionAndPush(exc.id, exc.order_id, reason, notes)
    if (ok) {
      showToast.success('Exception approved and order pushed to OMS')
    } else {
      showToast.error(error ?? 'Approval failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Exceptions</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{unresolved.length} unresolved · {resolved.length} resolved</p>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-300">
          <AlertOctagon size={18} className="shrink-0 text-red-500" />
          <div>
            <p className="text-base font-bold leading-none">{criticalCount} Critical</p>
            <p className="text-xs mt-0.5 text-red-700/70 dark:text-red-400/70">
              exception{criticalCount > 1 ? 's' : ''} require immediate attention
            </p>
          </div>
        </div>
      )}

      {omsBlockedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/[0.07] border border-amber-500/20 dark:border-amber-400/20 rounded-xl">
          <Lock size={14} className="text-amber-600 shrink-0" />
          <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
            {omsBlockedCount} exception{omsBlockedCount > 1 ? 's' : ''} blocking OMS push — approve or hold to unblock
          </span>
        </div>
      )}

      {/* Unresolved */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Unresolved <span className="text-gray-400 font-normal">({unresolved.length})</span>
        </h2>
        <div className="space-y-3 stagger-children">
          {unresolved.length === 0 && (
            <Card className="p-8 flex flex-col items-center gap-2">
              <CheckCircle size={24} className="text-green-400" />
              <p className="text-sm text-gray-500">No unresolved exceptions</p>
            </Card>
          )}
          {unresolved.map(exc => (
            <ExceptionCard
              key={exc.id}
              exception={exc}
              onResolve={() => {
                const prev = exc.status as ExceptionStatus
                resolveException(exc.id)
                showToast.exceptionResolved(() => restoreException(exc.id, prev))
              }}
              onDismiss={() => {
                const prev = exc.status as ExceptionStatus
                dismissException(exc.id)
                showToast.exceptionDismissed(() => restoreException(exc.id, prev))
              }}
              onHoldOrder={exc.order_id ? () => {
                holdOrder(exc.order_id!)
                showToast.orderHeld()
              } : undefined}
              onApproveAndPush={exc.order_id ? (reason, notes) => handleApproveAndPush(exc, reason, notes) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Resolved / Dismissed <span className="text-gray-400 font-normal">({resolved.length})</span>
          </h2>
          <div className="space-y-3 opacity-50">
            {resolved.map(exc => (
              <ExceptionCard key={exc.id} exception={exc} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
