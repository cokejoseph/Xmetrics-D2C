import type { Customer, Order, ReorderNudge, ChurnLevel } from '../types'

const CATEGORY_CYCLE_DAYS: Record<string, number> = {
  'Food & Beverage': 15,
  Supplements: 30,
  Skincare: 28,
  Fashion: 60,
  Electronics: 90,
  'Home & Kitchen': 45,
  Other: 30,
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function churnLevelFromRatio(ratio: number): ChurnLevel {
  if (ratio < 0.8)  return 'ACTIVE'
  if (ratio < 1.2)  return 'AT_RISK'
  if (ratio < 2.0)  return 'CHURNING'
  return 'LOST'
}

function churnProbability(level: ChurnLevel, ratio: number): number {
  const base: Record<ChurnLevel, [number, number]> = {
    ACTIVE:   [0.03, 0.15],
    AT_RISK:  [0.20, 0.45],
    CHURNING: [0.55, 0.80],
    LOST:     [0.82, 0.97],
  }
  const [lo, hi] = base[level]
  const clamped = Math.min(Math.max(ratio, 0), 3)
  const t = clamped / 3
  return Math.round((lo + (hi - lo) * t) * 100)
}

function buildNudgeMessage(name: string, productName: string, daysSince: number): string {
  const firstName = name.split(' ')[0]
  if (daysSince < 35) {
    return `Hi ${firstName}! 👋 Hope you're loving your ${productName}. Time to restock? We've got it ready for you! 🛒`
  }
  if (daysSince < 60) {
    return `Hey ${firstName}! It's been a while since your last order of ${productName}. Don't run out — order now and get priority delivery! ⚡`
  }
  return `Hi ${firstName}, we miss you! 😊 Your last order was ${daysSince} days ago. Come back and grab your ${productName} — special offer waiting for you! 🎁`
}

export function buildReorderNudgeList(
  customers: Customer[],
  orders: Order[],
): ReorderNudge[] {
  const now = new Date().toISOString().slice(0, 10)
  const result: ReorderNudge[] = []

  for (const customer of customers) {
    const custOrders = orders
      .filter(o => o.customer_id === customer.id && o.fulfillment_status === 'DELIVERED')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    if (custOrders.length === 0) continue

    const lastOrder = custOrders[custOrders.length - 1]
    const daysSince = daysBetween(lastOrder.created_at, now)

    // Average order cycle from historical gap between delivered orders
    let avgCycle = 30
    if (custOrders.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < custOrders.length; i++) {
        gaps.push(daysBetween(custOrders[i - 1].created_at, custOrders[i].created_at))
      }
      avgCycle = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
    } else {
      // Single order — use product category default if we can infer it
      const item = lastOrder.items?.[0]
      if (item?.product?.category) {
        avgCycle = CATEGORY_CYCLE_DAYS[item.product.category] ?? 30
      }
    }

    if (avgCycle <= 0) avgCycle = 30

    const ratio = daysSince / avgCycle
    const churnLevel = churnLevelFromRatio(ratio)

    // Delivery success rate across ALL orders (not just delivered)
    const totalOrders = orders.filter(o => o.customer_id === customer.id).length
    const rtoOrders = orders.filter(
      o => o.customer_id === customer.id && o.fulfillment_status === 'RTO_INITIATED'
    ).length
    const deliverySuccessRate =
      totalOrders > 0
        ? Math.round(((totalOrders - rtoOrders) / totalOrders) * 100)
        : 100

    const lastItem = lastOrder.items?.[0]
    const lastProductName = lastItem?.product_name ?? lastItem?.product?.name ?? 'your last product'
    const lastProductSku = lastItem?.sku ?? '—'

    result.push({
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      last_product_name: lastProductName,
      last_product_sku: lastProductSku,
      days_since_last_order: daysSince,
      avg_order_cycle: avgCycle,
      churn_level: churnLevel,
      churn_probability: churnProbability(churnLevel, ratio),
      delivery_success_rate: deliverySuccessRate,
      suggested_message: buildNudgeMessage(customer.name, lastProductName, daysSince),
    })
  }

  // Sort: LOST → CHURNING → AT_RISK → ACTIVE, then by churn_probability desc
  const levelOrder: Record<ChurnLevel, number> = { LOST: 0, CHURNING: 1, AT_RISK: 2, ACTIVE: 3 }
  return result.sort((a, b) => {
    const lo = levelOrder[a.churn_level] - levelOrder[b.churn_level]
    if (lo !== 0) return lo
    return b.churn_probability - a.churn_probability
  })
}
