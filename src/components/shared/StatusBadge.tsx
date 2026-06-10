import { Badge } from '../ui'
import type {
  FulfillmentStatus, PaymentStatus, RTORiskLevel, OrderChannel,
  ExceptionSeverity, ShipmentStatus,
} from '../../types'

export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  const map: Record<FulfillmentStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'default' }> = {
    CONFIRMED: { label: 'Confirmed', variant: 'info' },
    PROCESSING: { label: 'Processing', variant: 'info' },
    PACKING: { label: 'Packing', variant: 'warning' },
    READY_TO_SHIP: { label: 'Ready to Ship', variant: 'warning' },
    SHIPPED: { label: 'Shipped', variant: 'info' },
    IN_TRANSIT: { label: 'In Transit', variant: 'info' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', variant: 'warning' },
    DELIVERED: { label: 'Delivered', variant: 'success' },
    RTO_INITIATED: { label: 'RTO Initiated', variant: 'danger' },
    CANCELLED: { label: 'Cancelled', variant: 'gray' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' | 'default' }> = {
    PAID: { label: 'Paid', variant: 'success' },
    PENDING: { label: 'Pending', variant: 'warning' },
    AWAITING_PAYMENT: { label: 'Awaiting', variant: 'warning' },
    FAILED: { label: 'Failed', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function ChannelBadge({ channel }: { channel: OrderChannel }) {
  const colors: Record<OrderChannel, string> = {
    SHOPIFY: 'bg-green-100 text-green-700',
    WHATSAPP: 'bg-emerald-100 text-emerald-700',
    MANUAL: 'bg-gray-100 text-gray-600',
    AMAZON: 'bg-orange-100 text-orange-700',
    FLIPKART: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[channel]}`}>
      {channel}
    </span>
  )
}

export function RTORiskBadge({ level }: { level: RTORiskLevel }) {
  return (
    <Badge variant={level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warning' : 'success'}>
      {level}
    </Badge>
  )
}

export function RTOScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-red-500' : score >= 30 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${score >= 60 ? 'text-red-600' : score >= 30 ? 'text-amber-600' : 'text-green-600'}`}>
        {score}
      </span>
    </div>
  )
}

export function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  const map: Record<ExceptionSeverity, { label: string; variant: 'danger' | 'warning' | 'info' | 'success' }> = {
    CRITICAL: { label: 'Critical', variant: 'danger' },
    HIGH: { label: 'High', variant: 'danger' },
    MEDIUM: { label: 'Medium', variant: 'warning' },
    LOW: { label: 'Low', variant: 'info' },
  }
  const { label, variant } = map[severity]
  return <Badge variant={variant}>{label}</Badge>
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const map: Record<ShipmentStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'default' }> = {
    LABEL_CREATED: { label: 'Label Created', variant: 'gray' },
    PICKUP_SCHEDULED: { label: 'Pickup Scheduled', variant: 'warning' },
    PICKED_UP: { label: 'Picked Up', variant: 'info' },
    IN_TRANSIT: { label: 'In Transit', variant: 'info' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', variant: 'warning' },
    DELIVERED: { label: 'Delivered', variant: 'success' },
    RTO_INITIATED: { label: 'RTO Initiated', variant: 'danger' },
    RTO_DELIVERED: { label: 'RTO Delivered', variant: 'danger' },
    LOST: { label: 'Lost', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function PaymentMethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; variant: 'cod' | 'upi' | 'card' | 'prepaid' | 'info' | 'gray' }> = {
    COD: { label: 'COD', variant: 'cod' },
    UPI: { label: 'UPI', variant: 'upi' },
    CARD: { label: 'Card', variant: 'card' },
    NETBANKING: { label: 'Netbanking', variant: 'info' },
    WALLET: { label: 'Wallet', variant: 'gray' },
    PREPAID: { label: 'Prepaid', variant: 'prepaid' },
  }
  const { label, variant } = map[method] ?? { label: method, variant: 'gray' }
  return <Badge variant={variant}>{label}</Badge>
}
