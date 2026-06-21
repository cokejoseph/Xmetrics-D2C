import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card } from '../../components/ui'
import { FulfillmentBadge, PaymentBadge, ChannelBadge } from '../../components/shared/StatusBadge'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { customers, orders } = useAppStore()
  const customer = customers.find(c => c.id === id)

  useEffect(() => {
    document.title = customer ? `${customer.name} · Xmetrics` : 'Customer · Xmetrics'
  }, [customer])

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Customer not found</p>
        <Link to="/customers" className="text-brand-600 mt-2 inline-block hover:underline">← Back</Link>
      </div>
    )
  }

  const customerOrders = orders
    .filter(o => o.customer_id === customer.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const avgOrderValue = customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0
  const rtoCount = customerOrders.filter(o => o.fulfillment_status === 'RTO_INITIATED').length
  const rtoRate = customerOrders.length > 0 ? (rtoCount / customerOrders.length) * 100 : 0

  const lastOrder = customerOrders[0]
  const daysSinceLastOrder = lastOrder
    ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000)
    : null
  const showNudge = daysSinceLastOrder !== null && daysSinceLastOrder >= 14

  const nudgeMessage = `Hi ${customer.name}! 👋 It's been ${daysSinceLastOrder} days since your last order with us. We'd love to have you back — check out what's new! 😊`

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link to="/customers" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">Customers</Link>
        <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
        <span className="text-gray-700 dark:text-gray-200 font-medium">{customer.name}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{customer.name}</h1>
        <div className="flex gap-1 mt-0.5">
          {customer.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          {/* Contact */}
          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Contact</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone size={14} className="text-gray-400" /> {customer.phone}
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={14} className="text-gray-400" /> {customer.email}
                </div>
              )}
              {(customer.address || customer.city) && (
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin size={14} className="text-gray-400 mt-0.5" />
                  <div>
                    {customer.address && <p>{customer.address}</p>}
                    <p>{customer.city}, {customer.state} — {customer.pincode}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Stats */}
          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Orders" value={String(customer.total_orders)} />
              <Stat label="Lifetime Value" value={`₹${customer.total_spent.toLocaleString('en-IN')}`} />
              <Stat label="Avg Order Value" value={`₹${Math.round(avgOrderValue).toLocaleString('en-IN')}`} />
              <Stat label="RTO Rate" value={`${Math.round(rtoRate)}%`} />
            </div>
          </Card>

          {/* Reorder nudge */}
          {showNudge && (
            <Card className="p-4 bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={15} className="text-gray-400" />
                <h2 className="text-sm font-medium text-gray-700">Reorder Nudge</h2>
              </div>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Last ordered <strong>{daysSinceLastOrder} days ago</strong>. A WhatsApp nudge may bring them back.
              </p>
              <button
                onClick={() => window.open(
                  `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(nudgeMessage)}`,
                  '_blank'
                )}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <MessageCircle size={13} />
                Send WhatsApp nudge
              </button>
            </Card>
          )}

        </div>

        {/* Order History */}
        <div className="lg:col-span-2">
          <Card>
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Order History ({customerOrders.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Order</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Channel</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Payment</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ChannelBadge channel={order.channel} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        ₹{(order.gross_amount - order.discount_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <PaymentBadge status={order.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        <FulfillmentBadge status={order.fulfillment_status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-medium text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
