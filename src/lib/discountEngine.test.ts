import { describe, it, expect } from 'vitest'
import { buildDiscountAnalysis } from './discountEngine'
import type { Order, Customer } from '../types'

let seq = 0
function order(p: Partial<Order> & Pick<Order, 'customer_id' | 'created_at'>): Order {
  seq += 1
  return {
    id: `o${seq}`,
    brand_id: 'b1',
    order_number: `o${seq}`,
    channel: 'SHOPIFY',
    gross_amount: 1000,
    discount_amount: 0,
    payment_status: 'PAID',
    payment_method: 'UPI',
    fulfillment_status: 'DELIVERED',
    rto_risk_score: 0,
    rto_review_status: 'APPROVED',
    shipping_address: { name: 'X', phone: '9', address: 'a', city: 'c', state: 'KA', pincode: '560001' },
    warehouse_id: 'w1',
    notes: null,
    ...p,
  } as Order
}

const customers: Customer[] = [
  { id: 'c1', brand_id: 'b1', name: 'Repeat Rita', phone: '1', email: null, address: '', city: 'Pune', state: 'MH', pincode: '411001', total_orders: 0, total_spent: 0, tags: [], created_at: '2024-01-01' },
  { id: 'c2', brand_id: 'b1', name: 'New Neha', phone: '2', email: null, address: '', city: 'Delhi', state: 'DL', pincode: '110001', total_orders: 0, total_spent: 0, tags: [], created_at: '2024-01-01' },
]

describe('discountEngine', () => {
  it('counts a coupon on a repeat order as cannibalized, first order as acquisition', () => {
    const orders: Order[] = [
      // Rita: full-price first order, then a coupon on her 2nd → cannibalized
      order({ customer_id: 'c1', created_at: '2026-06-01T00:00:00Z' }),
      order({ customer_id: 'c1', created_at: '2026-06-10T00:00:00Z', coupon_code: 'SAVE20', discount_amount: 200 }),
      // Neha: coupon on her FIRST order → acquisition, not cannibalized
      order({ customer_id: 'c2', created_at: '2026-06-05T00:00:00Z', coupon_code: 'SAVE20', discount_amount: 200 }),
    ]
    const a = buildDiscountAnalysis(orders, customers)
    const save20 = a.coupons.find(c => c.code === 'SAVE20')!
    expect(save20.redemptions).toBe(2)
    expect(save20.toExisting).toBe(1)         // Rita's 2nd order
    expect(save20.toNew).toBe(1)              // Neha's first order
    expect(save20.cannibalizedDiscount).toBe(200) // only Rita's discount
  })

  it('flags a customer who has only ever bought on discount', () => {
    const orders: Order[] = [
      order({ customer_id: 'c1', created_at: '2026-06-01T00:00:00Z', coupon_code: 'A', discount_amount: 100 }),
      order({ customer_id: 'c1', created_at: '2026-06-08T00:00:00Z', coupon_code: 'B', discount_amount: 100 }),
    ]
    const a = buildDiscountAnalysis(orders, customers)
    const rita = a.dependentCustomers.find(c => c.id === 'c1')!
    expect(rita.neverFullPrice).toBe(true)
    expect(rita.dependencyPct).toBe(100)
    expect(a.summary.dependentCustomers).toBe(1)
  })

  it('computes discount as % of gross order value', () => {
    const orders: Order[] = [
      order({ customer_id: 'c1', created_at: '2026-06-01T00:00:00Z', gross_amount: 1000, coupon_code: 'X', discount_amount: 100 }),
      order({ customer_id: 'c2', created_at: '2026-06-02T00:00:00Z', gross_amount: 1000 }),
    ]
    const a = buildDiscountAnalysis(orders, customers)
    // 100 discount / 2000 gross = 5%
    expect(Math.round(a.summary.discountAsPctOfGmv)).toBe(5)
    expect(a.summary.totalDiscount).toBe(100)
  })
})
