import { describe, it, expect } from 'vitest'
import { buildSKUForecast } from './forecastEngine'
import type { Product, Order } from '../types'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1', brand_id: 'brand-1', name: 'Test Product', sku: 'SKU-001',
    category: 'Food & Beverage' as const, selling_price: 299, cost_price: 120,
    inventory_count: 100, reorder_threshold: 20, weight_grams: 500, is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeOrder(daysAgo: number, productId: string, qty = 1): Order {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return {
    id: `order-${Math.random()}`, brand_id: 'brand-1',
    order_number: '#1001', customer_id: 'cust-1',
    channel: 'SHOPIFY', payment_method: 'UPI', payment_status: 'PAID',
    fulfillment_status: 'DELIVERED', rto_review_status: 'NOT_REQUIRED',
    gross_amount: 299, discount_amount: 0, shipping_charge: 60,
    shipping_cost: 60, rto_risk_score: 10,
    shipping_address: { name: 'Test', phone: '9999999999', address: '1 Test St', city: 'Mumbai', state: 'MH', pincode: '400001' },
    items: [{ id: 'item-1', order_id: 'o-1', product_id: productId, sku: 'SKU-001', quantity: qty, unit_price: 299 }],
    created_at: date.toISOString(),
  } as Order
}

describe('buildSKUForecast', () => {
  it('returns a forecast entry per active product', () => {
    const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2', is_active: false })]
    const { forecasts } = buildSKUForecast(products, [])
    expect(forecasts).toHaveLength(1)
    expect(forecasts[0].product_id).toBe('p1')
  })

  it('marks zero-inventory product as OUT_OF_STOCK', () => {
    const p = makeProduct({ inventory_count: 0 })
    const { forecasts } = buildSKUForecast([p], [makeOrder(2, p.id)])
    expect(forecasts[0].status).toBe('OUT_OF_STOCK')
  })

  it('marks no-sales product as DEAD_STOCK', () => {
    const p = makeProduct({ inventory_count: 50 })
    const { forecasts } = buildSKUForecast([p], [])
    expect(forecasts[0].status).toBe('DEAD_STOCK')
  })

  it('marks fast-moving low-stock product as REORDER_NOW', () => {
    const p = makeProduct({ inventory_count: 3, reorder_threshold: 20 })
    const orders = Array.from({ length: 10 }, (_, i) => makeOrder(i, p.id, 2))
    const { forecasts } = buildSKUForecast([p], orders)
    expect(['REORDER_NOW', 'OUT_OF_STOCK']).toContain(forecasts[0].status)
  })

  it('summary counts match forecast statuses', () => {
    const p1 = makeProduct({ id: 'p1', inventory_count: 0 })
    const p2 = makeProduct({ id: 'p2', inventory_count: 200 })
    const orders = [makeOrder(2, p2.id, 2)]
    const { forecasts, summary } = buildSKUForecast([p1, p2], orders)
    const outCount = forecasts.filter(f => f.status === 'OUT_OF_STOCK').length
    expect(summary.out_of_stock_count).toBe(outCount)
  })
})
