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
    NDR:              { label: 'NDR',              dot: 'bg-orange-400', text: 'text-orange-600' },
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
  const config: Record<OrderChannel, { label: string; bg: string; text: string }> = {
    SHOPIFY:     { label: 'Shopify',     bg: 'bg-[#96BF48]/12 dark:bg-[#96BF48]/15', text: 'text-[#4a7c14] dark:text-[#7ab833]' },
    WHATSAPP:    { label: 'WhatsApp',    bg: 'bg-[#25D366]/12 dark:bg-[#25D366]/15', text: 'text-[#15813d] dark:text-[#1db954]' },
    AMAZON:      { label: 'Amazon',      bg: 'bg-[#FF9900]/12 dark:bg-[#FF9900]/15', text: 'text-[#b36a00] dark:text-[#e08000]' },
    FLIPKART:    { label: 'Flipkart',    bg: 'bg-[#2874F0]/12 dark:bg-[#2874F0]/15', text: 'text-[#1455c0] dark:text-[#4d90f5]' },
    MANUAL:      { label: 'Manual',      bg: 'bg-gray-100 dark:bg-white/[0.07]',      text: 'text-gray-500 dark:text-gray-400' },
    WOOCOMMERCE: { label: 'WooCommerce', bg: 'bg-[#7F54B3]/12 dark:bg-[#7F54B3]/15', text: 'text-[#5a3a8a] dark:text-[#a07dd0]' },
    MEESHO:      { label: 'Meesho',      bg: 'bg-[#F43397]/12 dark:bg-[#F43397]/15', text: 'text-[#b01065] dark:text-[#f05cb0]' },
  }
  const { label, bg, text } = config[channel] ?? { label: channel, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${bg} text-[11px] font-semibold ${text}`}>
      {label}
    </span>
  )
}

export function RTOScoreBar({ score }: { score: number }) {
  const level = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low'
  const color = score >= 60 ? 'bg-red-400' : score >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
  const trackColor = score >= 60 ? 'bg-red-50 dark:bg-red-900/20' : score >= 30 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
  const textColor = score >= 60 ? 'text-red-500 dark:text-red-400' : score >= 30 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  const tooltip = `RTO Risk Score: ${score}/100 (${level} risk). Scores above 60 require manual review before shipping.`
  return (
    <div
      className="flex items-center gap-2"
      title={tooltip}
      aria-label={tooltip}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`w-16 h-1.5 ${trackColor} rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>{score}</span>
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
  const config: Record<string, { label: string; bg: string; text: string }> = {
    COD:        { label: 'COD',        bg: 'bg-amber-50 dark:bg-amber-400/10',  text: 'text-amber-700 dark:text-amber-400' },
    UPI:        { label: 'UPI',        bg: 'bg-violet-50 dark:bg-violet-400/10', text: 'text-violet-700 dark:text-violet-400' },
    CARD:       { label: 'Card',       bg: 'bg-blue-50 dark:bg-blue-400/10',    text: 'text-blue-700 dark:text-blue-400' },
    NETBANKING: { label: 'Netbanking', bg: 'bg-teal-50 dark:bg-teal-400/10',   text: 'text-teal-700 dark:text-teal-400' },
    WALLET:     { label: 'Wallet',     bg: 'bg-indigo-50 dark:bg-indigo-400/10', text: 'text-indigo-700 dark:text-indigo-400' },
    PREPAID:    { label: 'Prepaid',    bg: 'bg-emerald-50 dark:bg-emerald-400/10', text: 'text-emerald-700 dark:text-emerald-400' },
  }
  const { label, bg, text } = config[method] ?? { label: method, bg: 'bg-gray-100 dark:bg-white/[0.07]', text: 'text-gray-600 dark:text-gray-400' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${bg} text-[11px] font-semibold ${text}`}>
      {label}
    </span>
  )
}
