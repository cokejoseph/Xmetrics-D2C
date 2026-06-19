import type {
  FulfillmentStatus, PaymentStatus, OrderChannel,
  ExceptionSeverity, ShipmentStatus,
} from '../../types'

function Dot({ color }: { color: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
}

export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  const map: Record<FulfillmentStatus, { label: string; dot: string; text: string }> = {
    CONFIRMED:        { label: 'Confirmed',        dot: 'bg-blue-400',   text: 'text-blue-600' },
    PROCESSING:       { label: 'Processing',       dot: 'bg-blue-400',   text: 'text-blue-600' },
    PACKING:          { label: 'Packing',          dot: 'bg-amber-400',  text: 'text-amber-600' },
    READY_TO_SHIP:    { label: 'Ready',            dot: 'bg-amber-400',  text: 'text-amber-600' },
    SHIPPED:          { label: 'Shipped',          dot: 'bg-sky-400',    text: 'text-sky-600' },
    IN_TRANSIT:       { label: 'In Transit',       dot: 'bg-sky-400',    text: 'text-sky-600' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', dot: 'bg-violet-400', text: 'text-violet-600' },
    DELIVERED:        { label: 'Delivered',        dot: 'bg-green-400',  text: 'text-green-600' },
    RTO_INITIATED:    { label: 'RTO Initiated',    dot: 'bg-red-400',    text: 'text-red-500' },
    CANCELLED:        { label: 'Cancelled',        dot: 'bg-gray-300',   text: 'text-gray-400' },
  }
  const { label, dot, text } = map[status] ?? { label: status, dot: 'bg-gray-300', text: 'text-gray-400' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={dot} />
      <span className={`text-[11px] font-medium ${text}`}>{label}</span>
    </span>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; dot: string; text: string }> = {
    PAID:             { label: 'Paid',     dot: 'bg-green-400',  text: 'text-green-600' },
    PENDING:          { label: 'Pending',  dot: 'bg-amber-400',  text: 'text-amber-600' },
    AWAITING_PAYMENT: { label: 'Awaiting', dot: 'bg-amber-300',  text: 'text-amber-500' },
    FAILED:           { label: 'Failed',   dot: 'bg-red-400',    text: 'text-red-500' },
  }
  const { label, dot, text } = map[status] ?? { label: status, dot: 'bg-gray-300', text: 'text-gray-400' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={dot} />
      <span className={`text-[11px] font-medium ${text}`}>{label}</span>
    </span>
  )
}

export function ChannelBadge({ channel }: { channel: OrderChannel }) {
  const labels: Record<OrderChannel, string> = {
    SHOPIFY:     'Shopify',
    WHATSAPP:    'WhatsApp',
    MANUAL:      'Manual',
    AMAZON:      'Amazon',
    FLIPKART:    'Flipkart',
    WOOCOMMERCE: 'WooCommerce',
    MEESHO:      'Meesho',
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-[11px] font-medium text-gray-600">
      {labels[channel] ?? channel}
    </span>
  )
}

export function RTOScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-red-400' : score >= 30 ? 'bg-amber-400' : 'bg-green-400'
  const textColor = score >= 60 ? 'text-red-500' : score >= 30 ? 'text-amber-500' : 'text-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[11px] font-medium ${textColor}`}>{score}</span>
    </div>
  )
}

export function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  const map: Record<ExceptionSeverity, { label: string; dot: string; text: string }> = {
    CRITICAL: { label: 'Critical', dot: 'bg-red-500',    text: 'text-red-600' },
    HIGH:     { label: 'High',     dot: 'bg-red-400',    text: 'text-red-500' },
    MEDIUM:   { label: 'Medium',   dot: 'bg-amber-400',  text: 'text-amber-600' },
    LOW:      { label: 'Low',      dot: 'bg-blue-300',   text: 'text-blue-500' },
  }
  const { label, dot, text } = map[severity]
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={dot} />
      <span className={`text-[11px] font-medium ${text}`}>{label}</span>
    </span>
  )
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const map: Record<ShipmentStatus, { label: string; dot: string; text: string }> = {
    LABEL_CREATED:    { label: 'Label Created',    dot: 'bg-gray-300',   text: 'text-gray-500' },
    PICKUP_SCHEDULED: { label: 'Pickup Scheduled', dot: 'bg-amber-400',  text: 'text-amber-600' },
    PICKED_UP:        { label: 'Picked Up',        dot: 'bg-sky-400',    text: 'text-sky-600' },
    IN_TRANSIT:       { label: 'In Transit',       dot: 'bg-sky-400',    text: 'text-sky-600' },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', dot: 'bg-violet-400', text: 'text-violet-600' },
    DELIVERED:        { label: 'Delivered',        dot: 'bg-green-400',  text: 'text-green-600' },
    RTO_INITIATED:    { label: 'RTO Initiated',    dot: 'bg-red-400',    text: 'text-red-500' },
    RTO_DELIVERED:    { label: 'RTO Delivered',    dot: 'bg-red-500',    text: 'text-red-600' },
    LOST:             { label: 'Lost',             dot: 'bg-red-600',    text: 'text-red-700' },
  }
  const { label, dot, text } = map[status] ?? { label: status, dot: 'bg-gray-300', text: 'text-gray-400' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={dot} />
      <span className={`text-[11px] font-medium ${text}`}>{label}</span>
    </span>
  )
}

export function PaymentMethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    COD:        'COD',
    UPI:        'UPI',
    CARD:       'Card',
    NETBANKING: 'Netbanking',
    WALLET:     'Wallet',
    PREPAID:    'Prepaid',
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-[11px] font-medium text-gray-600">
      {labels[method] ?? method}
    </span>
  )
}
