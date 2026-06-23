import { format, isToday, isYesterday, parseISO, isSameDay } from 'date-fns'
import type {
  Order,
  Customer,
  Product,
  Exception,
  BriefData,
  BriefAction,
} from '../types'

export function dayLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'dd MMM yyyy')
}

export function getOrderDates(orders: Order[]): string[] {
  const dateSet = new Set<string>()
  for (const order of orders) {
    dateSet.add(order.created_at.slice(0, 10))
  }
  return Array.from(dateSet).sort((a, b) => b.localeCompare(a))
}

export function generateDailyBrief(
  dateStr: string,
  orders: Order[],
  _customers: Customer[],
  products: Product[],
  _exceptions: Exception[]
): BriefData {
  const targetDate = parseISO(dateStr)

  // Filter orders for target date
  const dayOrders = orders.filter(o => isSameDay(parseISO(o.created_at), targetDate))

  // Headline
  const totalRevenue = dayOrders.reduce((sum, o) => sum + o.gross_amount - o.discount_amount, 0)
  const rtoOrders = dayOrders.filter(o => o.fulfillment_status === 'RTO_INITIATED')
  const paidOrders = dayOrders.filter(o => o.payment_status === 'PAID')
  const codOrders = dayOrders.filter(o => o.payment_method === 'COD')

  // Build a product lookup Map once — avoids O(orders × items × products)
  const productMap = new Map(products.map(p => [p.id, p]))

  // COGS estimate
  let cogs = 0
  for (const order of dayOrders) {
    for (const item of order.items ?? []) {
      const product = productMap.get(item.product_id)
      if (product) {
        cogs += product.cost_price * item.quantity
      }
    }
  }

  const totalShippingCost = dayOrders.reduce(
    (sum, o) => sum + (o.shipping_cost ?? o.shipping_charge ?? 60),
    0
  )
  const trueProfit = totalRevenue - cogs - totalShippingCost
  const trueMargin = totalRevenue > 0 ? (trueProfit / totalRevenue) * 100 : 0

  // Delivery health
  const rtoRate = dayOrders.length > 0 ? rtoOrders.length / dayOrders.length : 0
  const avgRtoScore =
    dayOrders.length > 0
      ? dayOrders.reduce((sum, o) => sum + o.rto_risk_score, 0) / dayOrders.length
      : 0
  const highRiskOrders = dayOrders
    .filter(o => o.rto_risk_score >= 60)
    .map(o => ({ order_number: o.order_number, score: o.rto_risk_score }))
    .slice(0, 5)

  // Channel performance
  const channelMap = new Map<string, { orders: number; revenue: number }>()
  for (const order of dayOrders) {
    const existing = channelMap.get(order.channel) ?? { orders: 0, revenue: 0 }
    channelMap.set(order.channel, {
      orders: existing.orders + 1,
      revenue: existing.revenue + order.gross_amount - order.discount_amount,
    })
  }
  const channelPerformance = Array.from(channelMap.entries()).map(
    ([channel, data]) => ({ channel, ...data })
  )

  // Product performance (top 5 by revenue)
  const productRevMap = new Map<string, { units: number; revenue: number }>()
  for (const order of dayOrders) {
    for (const item of order.items ?? []) {
      if (!item.product_id) continue
      const existing = productRevMap.get(item.product_id) ?? { units: 0, revenue: 0 }
      productRevMap.set(item.product_id, {
        units: existing.units + item.quantity,
        revenue: existing.revenue + item.unit_price * item.quantity,
      })
    }
  }
  const productPerformance = Array.from(productRevMap.entries())
    .map(([pid, data]) => {
      const product = productMap.get(pid)
      return {
        name: product?.name ?? 'Unknown',
        sku: product?.sku ?? '',
        units: data.units,
        revenue: data.revenue,
        low_stock: product
          ? product.inventory_count < product.reorder_threshold
          : false,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Customer health
  const existingCustomerIds = new Set(
    orders
      .filter(o => !isSameDay(parseISO(o.created_at), targetDate))
      .map(o => o.customer_id)
  )
  const dayCustomerIds = new Set(dayOrders.map(o => o.customer_id))
  const newCustomers = [...dayCustomerIds].filter(id => !existingCustomerIds.has(id)).length
  const returningCustomers = dayCustomerIds.size - newCustomers
  const repeatRate =
    dayCustomerIds.size > 0 ? (returningCustomers / dayCustomerIds.size) * 100 : 0

  // Action items
  const actions: BriefAction[] = []

  const failedPaymentsToday = dayOrders.filter(o => o.payment_status === 'FAILED').length
  if (failedPaymentsToday > 0) {
    actions.push({
      priority: 'HIGH',
      text: `${failedPaymentsToday} payment failure${failedPaymentsToday > 1 ? 's' : ''} today — review and retry collection`,
    })
  }

  if (rtoRate > 0.15) {
    actions.push({
      priority: 'HIGH',
      text: `RTO rate spiked to ${Math.round(rtoRate * 100)}% (threshold: 15%) — review high-risk orders`,
    })
  }

  const pendingHighRisk = orders.filter(
    o => o.rto_risk_score >= 60 && o.rto_review_status === 'PENDING'
  ).length
  if (pendingHighRisk > 0) {
    actions.push({
      priority: 'MEDIUM',
      text: `${pendingHighRisk} high-RTO order${pendingHighRisk > 1 ? 's' : ''} pending review in the Review Queue`,
    })
  }

  const lowStockProducts = products.filter(
    p => p.is_active && p.inventory_count < p.reorder_threshold
  )
  if (lowStockProducts.length > 0) {
    actions.push({
      priority: 'MEDIUM',
      text: `${lowStockProducts.length} SKU${lowStockProducts.length > 1 ? 's' : ''} below reorder threshold — ${lowStockProducts[0].name}${lowStockProducts.length > 1 ? ` and ${lowStockProducts.length - 1} more` : ''}`,
    })
  }

  const deliveredToday = dayOrders.filter(o => o.fulfillment_status === 'DELIVERED').length
  if (deliveredToday > 0) {
    actions.push({
      priority: 'LOW',
      text: `${deliveredToday} order${deliveredToday > 1 ? 's' : ''} delivered today — ${Math.round((1 - rtoRate) * 100)}% delivery success rate`,
    })
  }

  if (dayOrders.length > 0 && rtoRate <= 0.15) {
    actions.push({
      priority: 'LOW',
      text: `Today's revenue ₹${Math.round(totalRevenue).toLocaleString('en-IN')} across ${dayOrders.length} orders — margin ${Math.round(trueMargin)}%`,
    })
  }

  return {
    date: dateStr,
    headline: {
      total_orders: dayOrders.length,
      total_revenue: totalRevenue,
      cogs,
      shipping_cost: totalShippingCost,
      true_profit: trueProfit,
      true_margin: trueMargin,
      paid_count: paidOrders.length,
      cod_count: codOrders.length,
      rto_count: rtoOrders.length,
    },
    delivery_health: {
      rto_rate: rtoRate,
      spiked: rtoRate > 0.15,
      avg_rto_score: avgRtoScore,
      high_risk_orders: highRiskOrders,
    },
    channel_performance: channelPerformance,
    product_performance: productPerformance,
    customer_health: {
      new_customers: newCustomers,
      returning_customers: returningCustomers,
      repeat_rate: repeatRate,
    },
    actions: actions.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return order[a.priority] - order[b.priority]
    }),
  }
}

export function buildWhatsAppText(brief: BriefData): string {
  const h = brief.headline
  const d = brief.delivery_health
  const lines: string[] = []

  lines.push(`📊 *Xmetrics Daily Brief — ${dayLabel(brief.date)}*`)
  lines.push('')
  lines.push(`📦 Orders: ${h.total_orders}  |  💰 Revenue: ₹${Math.round(h.total_revenue).toLocaleString('en-IN')}`)
  lines.push(`✅ Paid: ${h.paid_count}  |  🔄 COD: ${h.cod_count}  |  🔁 RTO: ${h.rto_count}`)
  lines.push(`📈 Profit: ₹${Math.round(h.true_profit).toLocaleString('en-IN')} (${Math.round(h.true_margin)}% margin)`)
  lines.push('')

  if (d.spiked) {
    lines.push(`⚠️ *RTO ALERT: ${Math.round(d.rto_rate * 100)}% rate (above 15% threshold)*`)
    lines.push('')
  }

  if (brief.channel_performance.length > 0) {
    lines.push('📡 *Channels:*')
    for (const ch of brief.channel_performance) {
      lines.push(`  ${ch.channel}: ${ch.orders} orders, ₹${Math.round(ch.revenue).toLocaleString('en-IN')}`)
    }
    lines.push('')
  }

  lines.push('🎯 *Actions:*')
  for (const action of brief.actions) {
    const dot = action.priority === 'HIGH' ? '🔴' : action.priority === 'MEDIUM' ? '🟡' : '🟢'
    lines.push(`  ${dot} ${action.text}`)
  }

  return lines.join('\n')
}
