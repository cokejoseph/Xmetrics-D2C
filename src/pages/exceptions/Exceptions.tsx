import { Link } from 'react-router-dom'
import { AlertOctagon, ExternalLink, Check, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button } from '../../components/ui'
import { SeverityBadge } from '../../components/shared/StatusBadge'
import { showToast } from '../../lib/toast'
import type { Exception } from '../../types'

const TYPE_LABELS: Record<string, string> = {
  HIGH_RTO_RISK: 'High RTO Risk',
  FAILED_PAYMENT: 'Failed Payment',
  STUCK_SHIPMENT: 'Stuck Shipment',
  RTO_INITIATED: 'RTO Initiated',
  LOW_INVENTORY: 'Low Inventory',
  PENDING_SETTLEMENT: 'Pending Settlement',
  FAILED_WEBHOOK: 'Failed Webhook',
  ADDRESS_ISSUE: 'Address Issue',
}

export default function Exceptions() {
  const { exceptions, resolveException, dismissException } = useAppStore()

  const unresolved = exceptions.filter(e => e.status === 'UNRESOLVED' || e.status === 'IN_PROGRESS')
  const resolved = exceptions.filter(e => e.status === 'RESOLVED' || e.status === 'DISMISSED')

  const criticalCount = unresolved.filter(e => e.severity === 'CRITICAL').length

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Exceptions</h1>

      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertOctagon size={18} className="shrink-0" />
          <p className="text-sm font-medium">
            {criticalCount} critical exception{criticalCount > 1 ? 's' : ''} require immediate attention
          </p>
        </div>
      )}

      {/* Unresolved */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Unresolved <span className="text-gray-400 font-normal">({unresolved.length})</span>
        </h2>
        <div className="space-y-3 stagger-children">
          {unresolved.length === 0 && (
            <Card className="p-8 text-center text-gray-500 text-sm">
              No unresolved exceptions 🎉
            </Card>
          )}
          {unresolved.map(exc => (
            <ExceptionCard
              key={exc.id}
              exception={exc}
              onResolve={() => {
                resolveException(exc.id)
                showToast.exceptionResolved()
              }}
              onDismiss={() => {
                dismissException(exc.id)
                showToast.exceptionDismissed()
              }}
            />
          ))}
        </div>
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
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

function ExceptionCard({
  exception, onResolve, onDismiss,
}: {
  exception: Exception
  onResolve?: () => void
  onDismiss?: () => void
}) {
  const isResolved = exception.status === 'RESOLVED' || exception.status === 'DISMISSED'

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
          <SeverityBadge severity={exception.severity} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {TYPE_LABELS[exception.type] ?? exception.type}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{exception.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">{exception.description}</p>
          <div className="flex items-center gap-3 mt-2">
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

        {!isResolved && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="text-green-700 border-green-100 hover:bg-green-50"
              onClick={onResolve}
            >
              <Check size={13} /> Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="text-gray-500"
            >
              <X size={13} /> Dismiss
            </Button>
          </div>
        )}

        {isResolved && (
          <span className="text-xs text-gray-400 font-medium shrink-0">{exception.status}</span>
        )}
      </div>
    </Card>
  )
}
