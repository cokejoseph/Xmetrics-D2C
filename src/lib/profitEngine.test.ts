import { describe, it, expect } from 'vitest'
import { buildProfitAnalysis, computeOrderEconomics, DEFAULT_PROFIT_CONFIG } from './profitEngine'
import type { Order, Product } from '../types'

const cfg = DEFAULT_PROFIT_CONFIG

function order(p: Partial<Order> & Pick<Order, 'id' | 'channel' | 'payment_method' | 'fulfillment_status' | 'gross_amount'>): Order {
  return {
    brand_id: 'b1',
    customer_id: 'c1',
    order_number: p.id,
    discount_amount: 0,
    payment_status: 'PAID',
    rto_risk_score: 0,
    rto_review_status: 'APPROVED',
    shipping_address: { name: 'X', phone: '9', address: 'a', city: 'c', state: 'KA', pincode: '560001' },
    warehouse_id: 'w1',
    notes: null,
    created_at: new Date().toISOString(),
    items: [{ id: 'i1', order_id: p.id, product_id: 'p1', sku: 'SKU1', quantity: 1, unit_price: p.gross_amount, cost_price: 200 }],
    ...p,
  } as Order
}

const products: Product[] = [
  { id: 'p1', brand_id: 'b1', name: 'P1', sku: 'SKU1', category: 'Supplements', selling_price: 1000, cost_price: 200, inventory_count: 100, reorder_threshold: 10, weight_grams: 100, is_active: true, created_at: '2024-01-01' },
]

describe('profitEngine', () => {
  it('delivered prepaid order: contribution = value - cogs - fwd - fee', () => {
    const o = order({ id: 'o1', channel: 'SHOPIFY', payment_method: 'UPI', fulfillment_status: 'DELIVERED', gross_amount: 1000 })
    const e = computeOrderEconomics(o, new Map([['p1', 200]]), cfg)
    // 1000 - 200 cogs - 65 fwd - 20 fee(2%) = 715
    expect(Math.round(e.contribution)).toBe(715)
    expect(e.realized).toBe(true)
  })

  it('RTO order is a pure loss of round-trip shipping + handling', () => {
    const o = order({ id: 'o2', channel: 'WHATSAPP', payment_method: 'COD', fulfillment_status: 'RTO_INITIATED', gross_amount: 800 })
    const e = computeOrderEconomics(o, new Map([['p1', 200]]), cfg)
    // -(65 fwd + 65 rev + 20 handling) = -150
    expect(Math.round(e.contribution)).toBe(-150)
    expect(e.revenue).toBe(0)
  })

  it('in-flight orders are not counted as realized profit', () => {
    const o = order({ id: 'o3', channel: 'SHOPIFY', payment_method: 'COD', fulfillment_status: 'PROCESSING', gross_amount: 500 })
    const e = computeOrderEconomics(o, new Map([['p1', 200]]), cfg)
    expect(e.realized).toBe(false)
  })

  it('flags a margin-negative channel when RTO losses exceed delivered margin', () => {
    const orders: Order[] = [
      // One delivered (+~715) ...
      order({ id: 'd1', channel: 'WHATSAPP', payment_method: 'COD', fulfillment_status: 'DELIVERED', gross_amount: 1000 }),
      // ... but many RTOs (-150 each) drag the channel negative
      ...Array.from({ length: 6 }, (_, i) =>
        order({ id: `r${i}`, channel: 'WHATSAPP', payment_method: 'COD', fulfillment_status: 'RTO_INITIATED', gross_amount: 1000 })),
    ]
    const a = buildProfitAnalysis(orders, products, [])
    const whatsapp = a.byChannel.find(g => g.key === 'WHATSAPP')!
    expect(whatsapp.contribution).toBeLessThan(0)
    expect(whatsapp.negative).toBe(true)
    expect(a.insights.some(i => i.title.includes('WHATSAPP') && i.severity === 'critical')).toBe(true)
  })

  it('summary contribution margin nets delivered revenue against all costs incl RTO', () => {
    const orders: Order[] = [
      order({ id: 'd1', channel: 'SHOPIFY', payment_method: 'UPI', fulfillment_status: 'DELIVERED', gross_amount: 1000 }),
      order({ id: 'r1', channel: 'SHOPIFY', payment_method: 'COD', fulfillment_status: 'RTO_INITIATED', gross_amount: 1000 }),
    ]
    const a = buildProfitAnalysis(orders, products, [])
    // delivered contribution 715, minus RTO loss 150 = 565
    expect(Math.round(a.summary.contributionMargin)).toBe(565)
    expect(a.summary.delivered).toBe(1)
    expect(a.summary.rto).toBe(1)
  })
})
