import type { Order, Customer } from '../types'

// ─── Discount Leakage ────────────────────────────────────────────────────────
//
// Discounting is the silent margin killer no analytics tool examines. Two
// unaddressed questions:
//   1. Which customers ONLY ever buy on discount? (You're "buying" loyalty you
//      may already have — they'd churn the moment codes stop, or they'd have
//      paid full price anyway.)
//   2. Which coupons cannibalize full-price sales? A code redeemed mostly by
//      existing repeat customers is margin handed to people who'd have bought
//      regardless — not acquisition.

export interface DiscountCustomer {
  id: string
  name: string
  city: string
  totalOrders: number
  discountedOrders: number
  dependencyPct: number     // discounted / total
  totalSpent: number        // net
  totalDiscount: number
  neverFullPrice: boolean    // ≥2 orders, every one discounted
}

export interface CouponStat {
  code: string
  redemptions: number
  toExisting: number         // redeemed by a customer who had a prior order
  toNew: number
  discountGiven: number
  cannibalizedDiscount: number // discount given to existing (repeat) customers
  cannibalizationPct: number
}

export interface DiscountSummary {
  totalDiscount: number
  discountedOrders: number
  totalOrders: number
  discountOrderPct: number
  grossOrderValue: number    // gross before discount
  discountAsPctOfGmv: number
  dependentCustomers: number
  cannibalizedTotal: number
}

export interface DiscountInsight {
  severity: 'critical' | 'warning' | 'good'
  title: string
  detail: string
  value?: string
}

export interface DiscountAnalysis {
  summary: DiscountSummary
  dependentCustomers: DiscountCustomer[]
  coupons: CouponStat[]
  insights: DiscountInsight[]
}

function isDiscounted(o: Order): boolean {
  return (o.discount_amount ?? 0) > 0 || !!(o.coupon_code && o.coupon_code.trim())
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export function buildDiscountAnalysis(orders: Order[], customers: Customer[]): DiscountAnalysis {
  const custById = new Map(customers.map(c => [c.id, c]))

  // Per-customer order history, chronological (to tell acquisition from repeat).
  const byCustomer = new Map<string, Order[]>()
  for (const o of orders) {
    if (!o.customer_id) continue
    const list = byCustomer.get(o.customer_id) ?? []
    list.push(o)
    byCustomer.set(o.customer_id, list)
  }
  for (const list of byCustomer.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at))

  // ── Discount-dependent customers ──
  const dependentCustomers: DiscountCustomer[] = []
  for (const [cid, list] of byCustomer) {
    const discounted = list.filter(isDiscounted).length
    if (discounted === 0) continue
    const c = custById.get(cid)
    dependentCustomers.push({
      id: cid,
      name: c?.name ?? 'Unknown',
      city: c?.city ?? '',
      totalOrders: list.length,
      discountedOrders: discounted,
      dependencyPct: (discounted / list.length) * 100,
      totalSpent: list.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0),
      totalDiscount: list.reduce((s, o) => s + o.discount_amount, 0),
      neverFullPrice: list.length >= 2 && discounted === list.length,
    })
  }
  dependentCustomers.sort((a, b) => b.dependencyPct - a.dependencyPct || b.totalDiscount - a.totalDiscount)

  // ── Coupon cannibalization ──
  const couponMap = new Map<string, { redemptions: number; toExisting: number; discountGiven: number; cannibalized: number }>()
  for (const list of byCustomer.values()) {
    list.forEach((o, idx) => {
      if (!o.coupon_code) return
      const code = o.coupon_code.trim().toUpperCase()
      const s = couponMap.get(code) ?? { redemptions: 0, toExisting: 0, discountGiven: 0, cannibalized: 0 }
      s.redemptions += 1
      s.discountGiven += o.discount_amount
      if (idx > 0) { // had an earlier order → existing customer, not acquisition
        s.toExisting += 1
        s.cannibalized += o.discount_amount
      }
      couponMap.set(code, s)
    })
  }
  const coupons: CouponStat[] = [...couponMap.entries()]
    .map(([code, s]) => ({
      code,
      redemptions: s.redemptions,
      toExisting: s.toExisting,
      toNew: s.redemptions - s.toExisting,
      discountGiven: s.discountGiven,
      cannibalizedDiscount: s.cannibalized,
      cannibalizationPct: s.redemptions > 0 ? (s.toExisting / s.redemptions) * 100 : 0,
    }))
    .sort((a, b) => b.cannibalizedDiscount - a.cannibalizedDiscount)

  // ── Summary ──
  const all = orders.filter(o => o.customer_id)
  const totalDiscount = all.reduce((s, o) => s + o.discount_amount, 0)
  const discountedOrders = all.filter(isDiscounted).length
  const grossOrderValue = all.reduce((s, o) => s + o.gross_amount, 0)
  const cannibalizedTotal = coupons.reduce((s, c) => s + c.cannibalizedDiscount, 0)
  const dependent = dependentCustomers.filter(c => c.neverFullPrice || (c.totalOrders >= 2 && c.dependencyPct >= 80))

  const summary: DiscountSummary = {
    totalDiscount,
    discountedOrders,
    totalOrders: all.length,
    discountOrderPct: all.length > 0 ? (discountedOrders / all.length) * 100 : 0,
    grossOrderValue,
    discountAsPctOfGmv: grossOrderValue > 0 ? (totalDiscount / grossOrderValue) * 100 : 0,
    dependentCustomers: dependent.length,
    cannibalizedTotal,
  }

  // ── Insights ──
  const insights: DiscountInsight[] = []
  const neverFull = dependentCustomers.filter(c => c.neverFullPrice)
  if (neverFull.length > 0) {
    insights.push({
      severity: 'warning',
      title: `${neverFull.length} customer${neverFull.length > 1 ? 's' : ''} never pay full price`,
      value: String(neverFull.length),
      detail: `These repeat customers have only ever ordered with a discount. You're discounting loyalty you may already have — test holding codes back and see who still buys.`,
    })
  }
  const topCannibal = coupons.find(c => c.cannibalizationPct >= 40 && c.cannibalizedDiscount > 0)
  if (topCannibal) {
    insights.push({
      severity: 'critical',
      title: `${topCannibal.code} is cannibalizing full-price sales`,
      value: inr(topCannibal.cannibalizedDiscount),
      detail: `${Math.round(topCannibal.cannibalizationPct)}% of ${topCannibal.code} redemptions went to existing repeat customers — ${inr(topCannibal.cannibalizedDiscount)} of margin handed to people who'd likely have paid full price.`,
    })
  }
  if (summary.discountAsPctOfGmv >= 8) {
    insights.push({
      severity: summary.discountAsPctOfGmv >= 15 ? 'critical' : 'warning',
      title: 'Discount load is heavy',
      value: `${Math.round(summary.discountAsPctOfGmv)}%`,
      detail: `${Math.round(summary.discountAsPctOfGmv)}% of gross order value is given away as discounts (${inr(totalDiscount)}). On thin D2C margins, a few points here is the difference between profit and loss.`,
    })
  }
  if (insights.length === 0) {
    insights.push({
      severity: 'good',
      title: 'Discounting looks healthy',
      detail: `Low dependency and little cannibalization — coupons are mostly acquiring new customers rather than subsidizing existing ones.`,
    })
  }

  return {
    summary,
    dependentCustomers: dependentCustomers.filter(c => c.discountedOrders > 0),
    coupons,
    insights,
  }
}
