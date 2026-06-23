import { differenceInDays, parseISO } from 'date-fns'
import type { Customer, Order } from '../types'

export type ChurnLevel = 'ACTIVE' | 'AT_RISK' | 'CHURNING' | 'LOST'

export interface ReorderNudge {
  customer_id: string
  customer_name: string
  customer_phone: string
  total_orders: number
  total_spent: number
  last_order_date: string
  days_since_last_order: number
  avg_order_cycle_days: number
  overdue_by_days: number
  churn_level: ChurnLevel
  churn_probability: number
  top_category: string
  nudge_message: string
}

const CATEGORY_CYCLE_DAYS: Record<string, number> = {
  'Skincare':         30,
  'Supplements':      28,
  'Food & Beverage':  21,
  'Fashion':          60,
  'Electronics':      90,
  'Home & Kitchen':   45,
  'Other':            45,
}

export function buildReorderNudgeList(
  customers: Customer[],
  orders: Order[],
): ReorderNudge[] {
  const today = new Date()

  // Build a per-customer paid orders Map in one pass — avoids O(customers × orders)
  const paidOrdersByCustomer = new Map<string, Order[]>()
  for (const order of orders) {
    if (order.payment_status !== 'PAID' || !order.customer_id) continue
    const list = paidOrdersByCustomer.get(order.customer_id) ?? []
    list.push(order)
    paidOrdersByCustomer.set(order.customer_id, list)
  }

  return customers
    .map(customer => {
      const customerOrders = (paidOrdersByCustomer.get(customer.id) ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))

      if (customerOrders.length === 0) return null

      const lastOrder = customerOrders[customerOrders.length - 1]
      const lastOrderDate = parseISO(lastOrder.created_at)
      const daysSinceLast = differenceInDays(today, lastOrderDate)

      // Compute average cycle from actual order history
      let avgCycleDays = 30
      if (customerOrders.length >= 2) {
        const gaps: number[] = []
        for (let i = 1; i < customerOrders.length; i++) {
          const gap = differenceInDays(
            parseISO(customerOrders[i].created_at),
            parseISO(customerOrders[i - 1].created_at),
          )
          if (gap > 0) gaps.push(gap)
        }
        if (gaps.length > 0) {
          avgCycleDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
        }
      } else {
        // Single-order customer — use category default
        const topCat = getTopCategory(customerOrders)
        avgCycleDays = CATEGORY_CYCLE_DAYS[topCat] ?? 45
      }

      const overdueDays = daysSinceLast - avgCycleDays

      let churnLevel: ChurnLevel
      let churnProbability: number
      if (overdueDays < 0) {
        churnLevel = 'ACTIVE'
        churnProbability = Math.max(5, Math.round((daysSinceLast / avgCycleDays) * 20))
      } else if (overdueDays < avgCycleDays * 0.5) {
        churnLevel = 'AT_RISK'
        churnProbability = Math.min(90, 40 + Math.round((overdueDays / avgCycleDays) * 30))
      } else if (overdueDays < avgCycleDays * 1.5) {
        churnLevel = 'CHURNING'
        churnProbability = Math.min(90, 65 + Math.round((overdueDays / avgCycleDays) * 20))
      } else {
        churnLevel = 'LOST'
        churnProbability = 90
      }

      const topCategory = getTopCategory(customerOrders)
      const nudgeMessage = buildNudgeMessage(customer.name, topCategory, daysSinceLast, churnLevel)

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        total_orders: customer.total_orders,
        total_spent: customer.total_spent,
        last_order_date: lastOrder.created_at.slice(0, 10),
        days_since_last_order: daysSinceLast,
        avg_order_cycle_days: avgCycleDays,
        overdue_by_days: Math.max(0, overdueDays),
        churn_level: churnLevel,
        churn_probability: churnProbability,
        top_category: topCategory,
        nudge_message: nudgeMessage,
      }
    })
    .filter((n): n is ReorderNudge => n !== null)
    .sort((a, b) => {
      const order: ChurnLevel[] = ['LOST', 'CHURNING', 'AT_RISK', 'ACTIVE']
      const levelDiff = order.indexOf(a.churn_level) - order.indexOf(b.churn_level)
      if (levelDiff !== 0) return levelDiff
      return b.churn_probability - a.churn_probability
    })
}

function getTopCategory(orders: Order[]): string {
  const catCount = new Map<string, number>()
  for (const o of orders) {
    for (const item of o.items ?? []) {
      const cat = item.product?.category ?? 'Other'
      catCount.set(cat, (catCount.get(cat) ?? 0) + item.quantity)
    }
  }
  let top = 'Other', topCount = 0
  catCount.forEach((count, cat) => {
    if (count > topCount) { top = cat; topCount = count }
  })
  return top
}

function buildNudgeMessage(
  name: string,
  category: string,
  daysSince: number,
  level: ChurnLevel,
): string {
  const firstName = name.split(' ')[0]
  if (level === 'LOST') {
    return `Hi ${firstName}! We miss you 💙 It's been ${daysSince} days — come back and get 10% off your next ${category} order.`
  }
  if (level === 'CHURNING') {
    return `Hey ${firstName}, your ${category} supply might be running low! Order now and we'll deliver in 2 days.`
  }
  if (level === 'AT_RISK') {
    return `Hi ${firstName}! Time to restock your ${category}? Your last order was ${daysSince} days ago.`
  }
  return `Hi ${firstName}! Hope you're enjoying your ${category} products. Your next order is due soon!`
}
